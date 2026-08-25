import { AppError, type AppErrorCode } from '@/types/error'

interface ErrorLike {
  code?: string | number
  name?: string
  message?: string
  status?: number
  statusCode?: number
}

function asErrorLike(error: unknown): ErrorLike {
  if (!error || typeof error !== 'object') {
    return { message: typeof error === 'string' ? error : String(error) }
  }
  return error as ErrorLike
}

function collectText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`
  }
  if (typeof error === 'string') {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function matchCode(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

/**
 * 将任意异常映射为带业务码的 AppError，并给出可读中文提示。
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  const like = asErrorLike(error)
  const text = collectText(error)
  const ossCode = String(like.code ?? '')
  const status = Number(like.status ?? like.statusCode ?? NaN)

  // ali-oss 浏览器直传常见：CORS 未配或预检失败时表现为 XHR status -1 / connected: false
  if (
    matchCode(text, [
      /XHR error/i,
      /connected:\s*false/i,
      /status:\s*-1/i,
      /-1\s*\(connected:\s*false/i,
    ])
  ) {
    return new AppError(
      'CORS',
      '上传请求未能建立连接（常见于 CORS）。请到 OSS 控制台为 Bucket 配置跨域：Origin 含当前页面地址（如 http://localhost:5173），Methods 含 GET/PUT/POST/HEAD，Allow-Headers 建议 *。保存后重试。',
      error,
    )
  }

  if (matchCode(text, [/Failed to fetch/i, /NetworkError/i, /ERR_NETWORK/i, /ECONNREFUSED/i])) {
    if (matchCode(text, [/cors/i, /access-control/i, /blocked by cors/i])) {
      return new AppError(
        'CORS',
        '跨域请求被拦截。请检查 OSS Bucket CORS 是否允许当前站点 Origin，以及 Methods / Headers。',
        error,
      )
    }
    return new AppError(
      'NETWORK',
      '网络请求失败，请检查网络连接、OSS Endpoint 或 STS 接口是否可达。',
      error,
    )
  }

  if (matchCode(text, [/cors/i, /access-control-allow-origin/i, /blocked by cors/i])) {
    return new AppError(
      'CORS',
      '跨域请求被拦截。请检查 OSS Bucket CORS 是否允许当前站点 Origin，以及 Methods / Headers。',
      error,
    )
  }

  // 分片上传需要读取响应头 ETag；未在 CORS「暴露 Headers」中配置时会报此错
  if (matchCode(text, [/expose-headers/i, /set the etag/i, /etag of expose/i])) {
    return new AppError(
      'CORS',
      '分片上传需要读取 ETag。请到 OSS 控制台 → Bucket → 跨域设置（CORS）→ 暴露 Headers 中加入 ETag（建议同时加 x-oss-request-id），保存后强制刷新再试。',
      error,
    )
  }
  if (
    matchCode(ossCode, [/AccessDenied/i, /AccessForbidden/i, /InvalidObjectState/i]) ||
    status === 403 ||
    matchCode(text, [/AccessDenied/i, /AccessDeniedError/i, /403/])
  ) {
    return new AppError(
      'PERMISSION',
      '没有操作权限。请检查 RAM / STS 策略是否包含上传、读取或列举所需权限。',
      error,
    )
  }

  if (
    matchCode(ossCode, [
      /InvalidAccessKeyId/i,
      /SecurityTokenExpired/i,
      /InvalidSecurityToken/i,
      /ExpiredToken/i,
    ]) ||
    matchCode(text, [
      /InvalidAccessKeyId/i,
      /SecurityTokenExpired/i,
      /InvalidSecurityToken/i,
      /ExpiredToken/i,
    ])
  ) {
    return new AppError('CREDENTIAL', '访问凭证无效或已过期，请刷新 STS 后重试。', error)
  }

  if (status === 404 || matchCode(ossCode, [/NoSuchKey/i, /NoSuchBucket/i])) {
    return new AppError('NOT_FOUND', '对象或 Bucket 不存在，请确认路径与配置是否正确。', error)
  }

  if (matchCode(text, [/abort/i, /cancel/i, /已取消/])) {
    return new AppError('CANCELLED', '操作已取消。', error)
  }

  if (error instanceof TypeError && /fetch/i.test(text)) {
    return new AppError('NETWORK', '网络请求失败，请检查网络连接或接口地址是否正确。', error)
  }

  const fallback =
    like.message?.trim() ||
    (error instanceof Error ? error.message : '') ||
    '操作失败，请稍后重试。'

  return new AppError('UNKNOWN', fallback, error)
}

export function getErrorMessage(error: unknown): string {
  return toAppError(error).message
}

export function getErrorCode(error: unknown): AppErrorCode {
  return toAppError(error).code
}
