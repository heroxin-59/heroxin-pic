import { ElMessage, ElMessageBox } from 'element-plus'
import type { MessageHandler } from 'element-plus'
import { getErrorMessage, toAppError } from '@/utils/error'
import type { AppErrorCode } from '@/types/error'

/** 各类提示默认展示时长（毫秒） */
export const APP_MESSAGE_DURATION = {
  success: 2500,
  warning: 3500,
  error: 4500,
  info: 3000,
} as const

const warningCodes: AppErrorCode[] = [
  'CONFIG',
  'FILE_SIZE',
  'FILE_BATCH_SIZE',
  'FILE_TYPE',
  'FILE_MIME',
  'FILE_EMPTY',
  'CANCELLED',
]

type MessageType = keyof typeof APP_MESSAGE_DURATION

function showMessage(type: MessageType, message: string, duration?: number): MessageHandler {
  return ElMessage({
    type,
    message,
    duration: duration ?? APP_MESSAGE_DURATION[type],
    grouping: true,
    showClose: type === 'error',
  })
}

/** 将错误以 ElMessage 友好展示；校验类用 warning，其余用 error */
export function showAppError(error: unknown) {
  const appError = toAppError(error)
  const message = getErrorMessage(appError)

  if (warningCodes.includes(appError.code)) {
    showMessage('warning', message)
  } else {
    showMessage('error', message)
  }

  return appError
}

export function showAppSuccess(message: string, duration?: number) {
  return showMessage('success', message, duration)
}

export function showAppWarning(message: string, duration?: number) {
  return showMessage('warning', message, duration)
}

export function showAppInfo(message: string, duration?: number) {
  return showMessage('info', message, duration)
}

export interface ConfirmAppOptions {
  title?: string
  type?: 'warning' | 'info' | 'success' | 'error'
  confirmButtonText?: string
  cancelButtonText?: string
  /** 确认按钮使用危险样式（删除等不可逆操作） */
  danger?: boolean
}

/**
 * 统一确认框。返回是否点了确认（取消 / 关闭均为 false）。
 * 危险操作请设 `danger: true`，并写清不可恢复后果。
 */
export async function confirmApp(
  message: string,
  options: ConfirmAppOptions = {},
): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, options.title ?? '请确认', {
      type: options.type ?? 'warning',
      confirmButtonText: options.confirmButtonText ?? '确定',
      cancelButtonText: options.cancelButtonText ?? '取消',
      confirmButtonClass: options.danger ? 'el-button--danger' : undefined,
      closeOnClickModal: false,
      distinguishCancelAndClose: true,
    })
    return true
  } catch {
    return false
  }
}

/** 删除类确认的便捷封装 */
export async function confirmAppDelete(targetLabel: string): Promise<boolean> {
  return confirmApp(`确定从 OSS 删除「${targetLabel}」吗？此操作不可恢复。`, {
    title: '删除确认',
    confirmButtonText: '删除',
    danger: true,
  })
}
