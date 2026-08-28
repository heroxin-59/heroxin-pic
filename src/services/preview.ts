import { getAccessUrl, downloadOssFile } from '@/services/fileList'
import {
  acquirePreviewObjectUrl,
  acquirePreviewSignedUrl,
  releasePreviewObjectUrl,
  releasePreviewSignedUrl,
} from '@/services/filePreviewCache'
import { useFileStore } from '@/stores/files'
import { buildFileRecordFromKey, type FileRecord } from '@/types/file'
import type { PreviewType } from '@/types/preview'
import { isWordPreviewFile } from '@/services/word'

export type { PreviewKind, PreviewType } from '@/types/preview'

export function getPreviewKind(record: FileRecord): PreviewType {
  if (record.category === 'image') return 'image'
  if (record.category === 'pdf') return 'pdf'
  if (record.category === 'word') {
    return isWordPreviewFile(record.extension || record.name) ? 'word' : 'unsupported'
  }
  if (record.category === 'text') return 'text'
  if (record.category === 'video') return 'video'
  return 'unsupported'
}

/**
 * 根据 query key 解析预览目标：优先用已加载列表，否则签发 URL 构造记录。
 */
export async function resolvePreviewRecord(params: {
  key: string
  name?: string
}): Promise<FileRecord> {
  const key = params.key.trim()
  if (!key) {
    throw new Error('缺少文件 Key')
  }

  const fileStore = useFileStore()
  if (!fileStore.hasFullListCache && !fileStore.loading) {
    try {
      await fileStore.ensureFullListLoaded()
    } catch {
      // 列表加载失败时仍可凭 key 签发 URL 预览
    }
  }

  const existing = fileStore.getByKey(key)
  if (existing) {
    const url = await getAccessUrl(key)
    return { ...existing, url }
  }

  const url = await getAccessUrl(key)
  return buildFileRecordFromKey({
    key,
    size: 0,
    url,
    uploadedAt: new Date().toISOString(),
    // 有显式 name 时用其展示；否则从 Key 去掉 UUID/时间戳还原源文件名
    originalName: params.name?.trim() || undefined,
  })
}

export async function refreshSignedUrl(key: string, options?: { force?: boolean }): Promise<string> {
  return acquirePreviewSignedUrl(key, options)
}

/** 释放 `refreshSignedUrl` / 视频预览占用的签名 URL 引用 */
export function releaseSignedPreviewUrl(key: string) {
  releasePreviewSignedUrl(key)
}

/** 拉取图片对象并转为本地 Object URL（会话缓存；须在不用时 `releaseImageObjectUrl`） */
export async function loadImageObjectUrl(
  key: string,
  options?: { force?: boolean },
): Promise<string> {
  return acquirePreviewObjectUrl(key, options)
}

export function releaseImageObjectUrl(key: string) {
  releasePreviewObjectUrl(key)
}

/** 预览内下载：SDK Blob 本地下载，避开桶 Referer 防盗链 */
export async function openPreviewDownload(record: FileRecord) {
  await downloadOssFile(record.key, record.name)
}
