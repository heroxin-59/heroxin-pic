import { getCatalogByExt } from '@/constants/fileTypes'
import { getUploadLimits } from '@/config/oss'
import { AppError } from '@/types/error'
import { formatBytes, formatMb } from '@/utils/format'

export interface FileRejectReason {
  file: File
  message: string
  code: 'FILE_EMPTY' | 'FILE_SIZE' | 'FILE_BATCH_SIZE' | 'FILE_TYPE' | 'FILE_MIME'
}

export interface FileFilterResult {
  accepted: File[]
  rejected: FileRejectReason[]
}

export interface FileFilterOptions {
  /** 队列中已有文件占用体积（字节），用于总体积校验 */
  existingBatchBytes?: number
}

function getExtension(filename: string): string {
  const index = filename.lastIndexOf('.')
  if (index < 0) return ''
  return filename.slice(index + 1).toLowerCase()
}

function isMimeCompatible(ext: string, mime: string): boolean {
  const normalizedMime = mime.trim().toLowerCase()
  if (!normalizedMime || normalizedMime === 'application/octet-stream') {
    return true
  }

  const catalog = getCatalogByExt(ext)
  if (!catalog || catalog.mimeTypes.length === 0) {
    return true
  }

  return catalog.mimeTypes.some((item) => item.toLowerCase() === normalizedMime)
}

function validateFile(file: File): FileRejectReason | null {
  const { maxSizeBytes, maxSizeMb, allowedExt } = getUploadLimits()

  if (!file || file.size <= 0) {
    return {
      file,
      code: 'FILE_EMPTY',
      message: `${file.name || '文件'}：不能上传空文件。`,
    }
  }

  if (file.size > maxSizeBytes) {
    return {
      file,
      code: 'FILE_SIZE',
      message: `${file.name}：单文件过大（${formatBytes(file.size)}），上限 ${maxSizeMb} MB。`,
    }
  }

  const ext = getExtension(file.name)
  if (!ext || !allowedExt.includes(ext)) {
    return {
      file,
      code: 'FILE_TYPE',
      message: `${file.name}：不支持的扩展名${ext ? ` .${ext}` : ''}。允许：${allowedExt.join(', ')}`,
    }
  }

  if (!isMimeCompatible(ext, file.type)) {
    const catalog = getCatalogByExt(ext)
    const expected = catalog?.mimeTypes.join(' / ') ?? '未知'
    return {
      file,
      code: 'FILE_MIME',
      message: `${file.name}：MIME 类型不匹配（当前 ${file.type || '空'}，期望 ${expected}）。`,
    }
  }

  return null
}

function applyBatchSizeLimit(
  files: File[],
  existingBatchBytes: number,
): { accepted: File[]; rejected: FileRejectReason[] } {
  const { maxTotalBytes, maxTotalSizeMb } = getUploadLimits()
  const accepted: File[] = []
  const rejected: FileRejectReason[] = []
  let accumulated = existingBatchBytes

  for (const file of files) {
    if (accumulated + file.size > maxTotalBytes) {
      rejected.push({
        file,
        code: 'FILE_BATCH_SIZE',
        message: `${file.name}：本批总体积超限（当前已选 ${formatMb(accumulated)} MB，再加 ${formatBytes(file.size)} 将超过上限 ${maxTotalSizeMb} MB）。`,
      })
      continue
    }

    accumulated += file.size
    accepted.push(file)
  }

  return { accepted, rejected }
}

/** 批量筛选：单文件 + 类型 + 本批总体积 */
export function filterAllowedFiles(
  files: File[],
  options: FileFilterOptions = {},
): FileFilterResult {
  const accepted: File[] = []
  const rejected: FileRejectReason[] = []

  for (const file of files) {
    const reason = validateFile(file)
    if (reason) {
      rejected.push(reason)
    } else {
      accepted.push(file)
    }
  }

  const batchResult = applyBatchSizeLimit(accepted, options.existingBatchBytes ?? 0)

  return {
    accepted: batchResult.accepted,
    rejected: [...rejected, ...batchResult.rejected],
  }
}

/**
 * 上传前文件校验。失败时抛出 AppError。
 * @param existingBatchBytes 同批已选文件体积（不含当前文件）
 */
export function assertFileAllowed(file: File, existingBatchBytes = 0): void {
  const reason = validateFile(file)
  if (reason) {
    throw new AppError(reason.code, reason.message)
  }

  const { maxTotalBytes, maxTotalSizeMb } = getUploadLimits()
  if (existingBatchBytes + file.size > maxTotalBytes) {
    throw new AppError(
      'FILE_BATCH_SIZE',
      `${file.name}：本批总体积超限（当前已选 ${formatMb(existingBatchBytes)} MB，上限 ${maxTotalSizeMb} MB）。`,
    )
  }
}

export function isFileAllowed(file: File): boolean {
  return validateFile(file) === null
}

export function getFileCategoryByName(filename: string) {
  const ext = getExtension(filename)
  return getCatalogByExt(ext)?.category ?? 'other'
}

export function sumFileSizes(files: Array<{ size: number }>): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

/** 检测同批中重复的文件名（不区分大小写） */
export function findDuplicateFilenames(files: File[]): string[] {
  const seen = new Map<string, number>()
  const duplicates: string[] = []

  for (const file of files) {
    const normalized = file.name.toLowerCase()
    const count = (seen.get(normalized) ?? 0) + 1
    seen.set(normalized, count)
    if (count === 2) {
      duplicates.push(file.name)
    }
  }

  return duplicates
}
