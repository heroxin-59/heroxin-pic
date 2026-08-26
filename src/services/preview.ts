import { getAccessUrl, downloadOssFile, getObjectBlob } from '@/services/fileList'
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
  if (!fileStore.loaded && !fileStore.loading) {
    try {
      await fileStore.loadFromOss()
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

export async function refreshSignedUrl(key: string): Promise<string> {
  return getAccessUrl(key)
}

/** 拉取图片对象并转为本地 Object URL（需在不再使用时 revoke） */
export async function loadImageObjectUrl(key: string): Promise<string> {
  const blob = await getObjectBlob(key)
  return URL.createObjectURL(blob)
}

/** 预览内下载：SDK Blob 本地下载，避开桶 Referer 防盗链 */
export async function openPreviewDownload(record: FileRecord) {
  await downloadOssFile(record.key, record.name)
}
