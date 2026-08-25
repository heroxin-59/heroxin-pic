import { getOssConnectionConfig } from '@/config/oss'
import { withOssClient } from '@/services/oss'
import type { OssClient } from '@/services/ossClient'
import { buildFileRecordFromKey, type FileRecord } from '@/types/file'

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

/** 为下载签发带 Content-Disposition 的签名 URL */
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

/** 重新签发预览/复制用签名 URL */
export async function getAccessUrl(key: string): Promise<string> {
  return withOssClient(async (client) => client.getSignedUrl(key))
}

/** 通过 SDK 拉取对象 Blob（图片/文本预览更稳妥） */
export async function getObjectBlob(key: string): Promise<Blob> {
  return withOssClient(async (client) => client.getObjectBlob(key))
}

/** 删除 OSS 对象（需具备 DeleteObject 权限） */
export async function deleteOssFile(key: string): Promise<void> {
  await withOssClient(async (client) => {
    await client.delete(key)
  })
}
