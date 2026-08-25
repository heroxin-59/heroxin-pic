export type AppErrorCode =
  | 'CONFIG'
  | 'NETWORK'
  | 'CORS'
  | 'PERMISSION'
  | 'CREDENTIAL'
  | 'STS'
  | 'FILE_SIZE'
  | 'FILE_BATCH_SIZE'
  | 'FILE_TYPE'
  | 'FILE_MIME'
  | 'FILE_EMPTY'
  | 'NOT_FOUND'
  | 'CANCELLED'
  | 'UNKNOWN'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly cause?: unknown

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
