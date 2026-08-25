import { getOssConnectionConfig } from '@/config/oss'
import { getDuplicateStrategy } from '@/config/upload'
import { withOssClient } from '@/services/oss'
import type { FileCategory } from '@/constants/fileTypes'
import type { OssUploadResult } from '@/types/oss'
import { extractFileMetadata } from '@/utils/fileMeta'
import { assertFileAllowed } from '@/utils/fileValidate'
import { buildObjectKey } from '@/utils/objectKey'

export interface UploadFileParams {
  file: File
  /** 预分配的 Object Key；未传则按策略即时生成 */
  objectKey?: string
  onProgress?: (percent: number, checkpoint?: unknown) => void
  /** 取消信号 */
  signal?: AbortSignal
}

export interface UploadFileSuccess extends OssUploadResult {
  key: string
  size: number
  originalName: string
  uploadedAt: string
  mimeType: string
  extension: string
  category: FileCategory
}

/** 校验 + 生成 Key + 直传 OSS（含凭证过期自动重试） */
export async function uploadFileToOss(params: UploadFileParams): Promise<UploadFileSuccess> {
  const { file, onProgress, objectKey, signal } = params
  assertFileAllowed(file)

  const meta = extractFileMetadata(file)
  const connection = getOssConnectionConfig()
  const key =
    objectKey ??
    buildObjectKey({
      filename: file.name,
      dir: connection.dir,
      strategy: getDuplicateStrategy(),
    })

  const result = await withOssClient((client) =>
    client.upload({
      key,
      file,
      onProgress,
      signal,
    }),
  )

  return {
    ...result,
    key,
    size: file.size,
    originalName: file.name,
    uploadedAt: new Date().toISOString(),
    mimeType: meta.mimeType,
    extension: meta.extension,
    category: meta.category,
  }
}
