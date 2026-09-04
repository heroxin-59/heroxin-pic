import { getOssConnectionConfig } from '@/config/oss'
import { withOssClient } from '@/services/oss'
import type { OssClient } from '@/services/ossClient'
import { AppError } from '@/types/error'
import { buildFileRecordFromKey, type FileRecord, type FolderEntry } from '@/types/file'
import { isAbortError } from '@/utils/error'

const OSS_LIST_BATCH_SIZE = 1000

export interface ListOssFilesResult {
  records: FileRecord[]
  nextMarker: string | null
  isTruncated: boolean
}

export interface ListAllOssFilesResult {
  records: FileRecord[]
  totalLoaded: number
}

export interface ListOssDirectoryResult {
  /** 当前列举前缀（规范化，以 / 结尾） */
  prefix: string
  folders: FolderEntry[]
  records: FileRecord[]
}

function normalizeListPrefix(prefix: string): string {
  const cleaned = prefix.replace(/^\/+/, '')
  if (!cleaned) return ''
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`
}

/** 相对父前缀的文件夹展示名，如 `24/` */
function folderNameFromPrefix(fullPrefix: string, parentPrefix: string): string {
  const rest = fullPrefix.startsWith(parentPrefix)
    ? fullPrefix.slice(parentPrefix.length)
    : fullPrefix
  return rest || fullPrefix
}

function toIsoTime(value?: string): string {
  if (!value) return new Date(0).toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

function mapObjectToRecord(
  client: OssClient,
  object: { name: string; size?: number; lastModified?: string },
): FileRecord {
  const key = object.name
  return buildFileRecordFromKey({
    key,
    size: object.size ?? 0,
    url: client.getSignedUrl(key),
    uploadedAt: toIsoTime(object.lastModified),
  })
}

/**
 * 列举配置前缀下的 OSS 对象，并转为 FileRecord（含签名 URL）。
 * 默认按 lastModified 从新到旧排序。
 */
export async function listOssFiles(
  options: {
    maxKeys?: number
    marker?: string
  } = {},
): Promise<ListOssFilesResult> {
  const connection = getOssConnectionConfig()

  return withOssClient(async (client) => {
    const result = await client.list({
      prefix: connection.dir,
      maxKeys: options.maxKeys ?? 100,
      marker: options.marker,
    })

    const records = result.objects
      .filter((item) => Boolean(item.name) && !item.name.endsWith('/'))
      .map((item) => mapObjectToRecord(client, item))
      .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))

    return {
      records,
      nextMarker: result.nextMarker,
      isTruncated: result.isTruncated,
    }
  })
}

/**
 * 分页拉取 OSS 前缀下全部对象（自动跟进 marker），用于列表全量加载。
 */
export async function listAllOssFiles(): Promise<ListAllOssFilesResult> {
  const connection = getOssConnectionConfig()

  return withOssClient(async (client) => {
    const records: FileRecord[] = []
    let marker: string | undefined
    let hasMore = true

    while (hasMore) {
      const result = await client.list({
        prefix: connection.dir,
        maxKeys: OSS_LIST_BATCH_SIZE,
        marker,
      })

      const batch = result.objects
        .filter((item) => Boolean(item.name) && !item.name.endsWith('/'))
        .map((item) => mapObjectToRecord(client, item))

      records.push(...batch)
      marker = result.nextMarker ?? undefined
      hasMore = Boolean(result.isTruncated && marker)
    }

    records.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))

    return {
      records,
      totalLoaded: records.length,
    }
  })
}

/**
 * 按「虚拟目录」列举：delimiter=/，返回当前层文件夹 + 文件（自动跟进 marker）。
 * @param prefix 完整 OSS 前缀；缺省为配置的上传根目录
 */
export async function listOssDirectory(prefix?: string): Promise<ListOssDirectoryResult> {
  const connection = getOssConnectionConfig()
  const listPrefix = normalizeListPrefix(prefix?.trim() || connection.dir)

  return withOssClient(async (client) => {
    const folderMap = new Map<string, FolderEntry>()
    const records: FileRecord[] = []
    let marker: string | undefined
    let hasMore = true

    while (hasMore) {
      const result = await client.list({
        prefix: listPrefix,
        delimiter: '/',
        maxKeys: OSS_LIST_BATCH_SIZE,
        marker,
      })

      for (const commonPrefix of result.prefixes) {
        if (!commonPrefix || folderMap.has(commonPrefix)) continue
        folderMap.set(commonPrefix, {
          prefix: commonPrefix,
          name: folderNameFromPrefix(commonPrefix, listPrefix),
        })
      }

      const batch = result.objects
        .filter(
          (item) => Boolean(item.name) && !item.name.endsWith('/') && item.name !== listPrefix,
        )
        .map((item) => mapObjectToRecord(client, item))

      records.push(...batch)
      marker = result.nextMarker ?? undefined
      hasMore = Boolean(result.isTruncated && marker)
    }

    const folders = [...folderMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base', numeric: true }),
    )
    records.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))

    return {
      prefix: listPrefix,
      folders,
      records,
    }
  })
}

/** 为下载签发带 Content-Disposition 的签名 URL（外链/复制用；站内点击下载请用 downloadOssFile） */
export async function getDownloadUrl(key: string, filename: string): Promise<string> {
  return withOssClient(async (client) => {
    const safeName = filename.replace(/["\r\n]/g, '_')
    return client.getSignedUrl(key, {
      expires: 3600,
      response: {
        'content-disposition': `attachment; filename="${encodeURIComponent(safeName)}"`,
      },
    })
  })
}

/** 重新签发预览/复制用签名 URL（可带图片处理 process） */
export async function getAccessUrl(
  key: string,
  options?: { expires?: number; process?: string },
): Promise<string> {
  return withOssClient(async (client) =>
    client.getSignedUrl(key, {
      expires: options?.expires,
      process: options?.process,
    }),
  )
}

/** 通过 SDK 或（带 signal 时）签名 URL + fetch 拉取对象 Blob */
export async function getObjectBlob(
  key: string,
  options?: { signal?: AbortSignal },
): Promise<Blob> {
  const signal = options?.signal
  if (signal?.aborted) {
    throw new AppError('CANCELLED', '操作已取消。')
  }

  // 可取消读取走独立 fetch，避免共享 OSS 客户端 cancel() 误伤其它并发请求
  if (signal) {
    const url = await getAccessUrl(key)
    if (signal.aborted) {
      throw new AppError('CANCELLED', '操作已取消。')
    }
    let response: Response
    try {
      response = await fetch(url, { signal })
    } catch (error) {
      if (isAbortError(error)) {
        throw new AppError('CANCELLED', '操作已取消。', error)
      }
      throw error
    }
    if (!response.ok) {
      throw new AppError('NETWORK', `读取对象失败（HTTP ${response.status}）。`)
    }
    return response.blob()
  }

  return withOssClient(async (client) => client.getObjectBlob(key))
}

/**
 * 站内下载：SDK 拉 Blob → 本地 Object URL 触发保存。
 * 避免签名 URL + 跨域 `<a download>` 失效后带 Referer 跳转，触发桶防盗链 AccessDenied。
 */
export async function downloadOssFile(key: string, filename: string): Promise<void> {
  const blob = await getObjectBlob(key)
  const objectUrl = URL.createObjectURL(blob)
  const safeName = (filename || key.split('/').pop() || 'download').replace(/[\\/:*?"<>|]/g, '_')
  try {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = safeName
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
  }
}

/** 删除 OSS 对象（需具备 DeleteObject 权限） */
export async function deleteOssFile(key: string): Promise<void> {
  await withOssClient(async (client) => {
    await client.delete(key)
  })
}
