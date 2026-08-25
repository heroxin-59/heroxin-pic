import type { FileCategory } from '@/constants/fileTypes'
import { getCatalogByExt } from '@/constants/fileTypes'
import { getFileCategory, getFileExtension } from '@/utils/fileMeta'
import { displayNameFromStoredFilename } from '@/utils/objectKey'

/** 文件列表记录（OSS list 或上传成功回写） */
export interface FileRecord {
  id: string
  /** 展示用源文件名（已去掉 Key 中的 UUID/时间戳后缀） */
  name: string
  extension: string
  mimeType: string
  category: FileCategory
  size: number
  /** OSS Object Key（完整，用于下载/预览/删除） */
  key: string
  /** 签名访问 URL */
  url: string
  /** ISO 时间（OSS lastModified 或上传时刻） */
  uploadedAt: string
}

/** OSS 虚拟目录（commonPrefixes） */
export interface FolderEntry {
  /** 完整前缀，以 / 结尾 */
  prefix: string
  /** 展示名，如 `08/` */
  name: string
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
  /** 若已知原始文件名可覆盖（上传成功回写） */
  originalName?: string
}): FileRecord {
  const basename = basenameFromKey(params.key)
  const rawName = params.originalName?.trim() || basename
  // 列表/预览展示用源文件名；Key 仍完整，不影响下载与预览
  const name = displayNameFromStoredFilename(rawName) || rawName
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
