import type { FileCategory } from '@/constants/fileTypes'
import { getCatalogByExt } from '@/constants/fileTypes'
import { getFileCategory, getFileExtension } from '@/utils/fileMeta'

/** 文件列表记录（OSS list 或上传成功回写） */
export interface FileRecord {
  id: string
  /** 展示用文件名（通常为 Object Key 的 basename） */
  name: string
  extension: string
  mimeType: string
  category: FileCategory
  size: number
  /** OSS Object Key */
  key: string
  /** 签名访问 URL */
  url: string
  /** ISO 时间（OSS lastModified 或上传时刻） */
  uploadedAt: string
}

export function inferMimeType(filename: string): string {
  const ext = getFileExtension(filename)
  const catalog = getCatalogByExt(ext)
  return catalog?.mimeTypes[0] ?? 'application/octet-stream'
}

export function basenameFromKey(key: string): string {
  const cleaned = key.replace(/\/+$/, '')
  const index = cleaned.lastIndexOf('/')
  return index >= 0 ? cleaned.slice(index + 1) : cleaned
}

export function buildFileRecordFromKey(params: {
  key: string
  size: number
  url: string
  uploadedAt: string
  /** 若已知原始文件名可覆盖 basename */
  originalName?: string
}): FileRecord {
  const name = params.originalName?.trim() || basenameFromKey(params.key)
  const extension = getFileExtension(name)
  return {
    id: params.key,
    name,
    extension,
    mimeType: inferMimeType(name),
    category: getFileCategory(name),
    size: params.size,
    key: params.key,
    url: params.url,
    uploadedAt: params.uploadedAt,
  }
}
