import { getCatalogByExt } from '@/constants/fileTypes'
import type { FileCategory } from '@/constants/fileTypes'

export function getFileExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index < 0) return ''
  return filename.slice(index + 1).toLowerCase()
}

export function getFileCategory(filename: string): FileCategory {
  const ext = getFileExtension(filename)
  return getCatalogByExt(ext)?.category ?? 'other'
}

export function getFileMimeType(file: File): string {
  return file.type?.trim() || 'application/octet-stream'
}

export interface FileMetadata {
  extension: string
  mimeType: string
  category: FileCategory
}

export function extractFileMetadata(file: File): FileMetadata {
  const extension = getFileExtension(file.name)
  return {
    extension,
    mimeType: getFileMimeType(file),
    category: getFileCategory(file.name),
  }
}
