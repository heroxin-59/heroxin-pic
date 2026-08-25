import type { UploadFileSuccess } from '@/services/upload'

export type UploadTaskStatus = 'waiting' | 'uploading' | 'success' | 'error' | 'cancelled'

export interface UploadTask {
  id: string
  file: File
  /** 入队时按重名策略预分配的 Object Key */
  objectKey: string
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
