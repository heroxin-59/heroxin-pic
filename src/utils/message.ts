import { ElMessage } from 'element-plus'
import { getErrorMessage, toAppError } from '@/utils/error'
import type { AppErrorCode } from '@/types/error'

const warningCodes: AppErrorCode[] = [
  'CONFIG',
  'FILE_SIZE',
  'FILE_BATCH_SIZE',
  'FILE_TYPE',
  'FILE_MIME',
  'FILE_EMPTY',
  'CANCELLED',
]

/** 将错误以 ElMessage 友好展示；返回归一化后的 AppError 便于调用方继续处理 */
export function showAppError(error: unknown) {
  const appError = toAppError(error)
  const message = getErrorMessage(appError)

  if (warningCodes.includes(appError.code)) {
    ElMessage.warning(message)
  } else {
    ElMessage.error(message)
  }

  return appError
}

export function showAppSuccess(message: string) {
  ElMessage.success(message)
}

export function showAppWarning(message: string) {
  ElMessage.warning(message)
}
