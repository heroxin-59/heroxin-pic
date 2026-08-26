/**
 * 领域类型统一出口（阶段 7.4）。
 * 业务代码可 `import type { FileRecord, PreviewType } from '@/types'`。
 */

export type { AppErrorCode } from './error'
export { AppError, isAppError } from './error'

export type { FileItem, FileRecord, FolderEntry } from './file'
export { basenameFromKey, buildFileRecordFromKey, inferMimeType } from './file'

export type {
  OssClientConfig,
  OssConfig,
  OssCredentials,
  OssListOptions,
  OssListResult,
  OssListedObject,
  OssSignedUrlOptions,
  OssUploadOptions,
  OssUploadResult,
} from './oss'

export type { PreviewKind, PreviewType } from './preview'

export type { StsApiResponse, StsCredentialSet } from './sts'

export type { UploadBatchSummary, UploadStatus, UploadTask, UploadTaskStatus } from './upload'
