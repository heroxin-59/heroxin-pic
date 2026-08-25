import { getAccessUrl, getDownloadUrl, getObjectBlob } from '@/services/fileList'
import { useFileStore } from '@/stores/files'
import { buildFileRecordFromKey, type FileRecord } from '@/types/file'
import { isDocxFile } from '@/services/word'

export type PreviewKind = 'image' | 'pdf' | 'word' | 'text' | 'unsupported'

export function getPreviewKind(record: FileRecord): PreviewKind {
  if (record.category === 'image') return 'image'
  if (record.category === 'pdf') return 'pdf'
  if (record.category === 'word') {
    // 仅支持 .docx；.doc 老格式走 Fallback
    return isDocxFile(record.extension || record.name) ? 'word' : 'unsupported'
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

  const name = params.name?.trim() || key.split('/').pop() || key
  const url = await getAccessUrl(key)
  return buildFileRecordFromKey({
    key,
    size: 0,
    url,
    uploadedAt: new Date().toISOString(),
    originalName: name,
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

export async function openPreviewDownload(record: FileRecord) {
  const url = await getDownloadUrl(record.key, record.name)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = record.name
  anchor.rel = 'noopener'
  anchor.target = '_blank'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}
