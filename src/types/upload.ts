import type { UploadFileSuccess } from '@/services/upload'
import type { ArchiveDateSource } from '@/utils/archiveDate'

export type UploadTaskStatus = 'waiting' | 'uploading' | 'success' | 'error' | 'cancelled'

/** README / 对外文档中的 UploadStatus，与 UploadTaskStatus 同义 */
export type UploadStatus = UploadTaskStatus

export interface UploadTask {
  id: string
  file: File
  /** 入队时按重名策略预分配的 Object Key */
  objectKey: string
  /** 归档日目录片段 `yyyy/MM/dd` */
  archiveDatePath?: string
  /** 归档日来源（图片内容日期 / 上传当日） */
  archiveSource?: ArchiveDateSource
  status: UploadTaskStatus
  percent: number
  error?: string
  result?: UploadFileSuccess
}

export interface UploadBatchSummary {
  total: number
  waiting: number
  uploading: number
  success: number
  failed: number
  cancelled: number
}
