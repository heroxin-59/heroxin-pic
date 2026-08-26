import { getOssConnectionConfig, hasStsUrl } from '@/config/oss'
import { AppError } from '@/types/error'
import type { OssCredentials } from '@/types/oss'
import type { StsApiResponse, StsCredentialSet } from '@/types/sts'
import { toAppError } from '@/utils/error'

/** 提前多久刷新（默认 60 秒） */
const REFRESH_AHEAD_MS = 60_000

/** 本地调试密钥没有真实过期时间时使用的占位（约 1 天） */
const LOCAL_DEBUG_TTL_MS = 24 * 60 * 60 * 1000

let cached: StsCredentialSet | null = null
let inflight: Promise<StsCredentialSet> | null = null

function pickString(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return ''
}

function unwrapPayload(raw: StsApiResponse): StsApiResponse {
  return raw.Credentials ?? raw.credentials ?? raw.data ?? raw
}

function parseExpiration(value: string | undefined): number {
  if (!value?.trim()) {
    // 未返回过期时间时，保守缓存 15 分钟
    return Date.now() + 15 * 60 * 1000
  }

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    throw new Error(`STS Expiration 无法解析：${value}`)
  }
  return parsed
}

export function normalizeStsResponse(raw: StsApiResponse): StsCredentialSet {
  const payload = unwrapPayload(raw)
  const accessKeyId = pickString(payload.AccessKeyId, payload.accessKeyId)
  const accessKeySecret = pickString(payload.AccessKeySecret, payload.accessKeySecret)
  const stsToken = pickString(payload.SecurityToken, payload.securityToken, payload.stsToken)
  const expiration = parseExpiration(
    pickString(payload.Expiration, payload.expiration) || undefined,
  )

  if (!accessKeyId || !accessKeySecret || !stsToken) {
    throw new AppError('STS', 'STS 响应缺少 AccessKeyId / AccessKeySecret / SecurityToken')
  }

  return { accessKeyId, accessKeySecret, stsToken, expiration }
}

function isFresh(credential: StsCredentialSet): boolean {
  return Date.now() < credential.expiration - REFRESH_AHEAD_MS
}

/**
 * 仅开发环境：从 .env.local 读取调试密钥。
 * 若填写了 VITE_OSS_STS_TOKEN，则按官方方式用临时凭证初始化（仍会过期，日常请用 VITE_STS_URL）。
 * 生产构建不会走此分支；且密钥不得提交仓库。
 */
function getLocalDebugCredentials(): StsCredentialSet | null {
  if (!import.meta.env.DEV) {
    return null
  }

  const accessKeyId = import.meta.env.VITE_OSS_ACCESS_KEY_ID?.trim() ?? ''
  const accessKeySecret = import.meta.env.VITE_OSS_ACCESS_KEY_SECRET?.trim() ?? ''
  const stsToken = import.meta.env.VITE_OSS_STS_TOKEN?.trim() ?? ''

  if (!accessKeyId || !accessKeySecret) {
    return null
  }

  return {
    accessKeyId,
    accessKeySecret,
    stsToken,
    expiration: Date.now() + LOCAL_DEBUG_TTL_MS,
  }
}

async function fetchStsCredentials(stsUrl: string): Promise<StsCredentialSet> {
  const response = await fetch(stsUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new AppError('STS', `STS 请求失败：HTTP ${response.status}`)
  }

  try {
    const data = (await response.json()) as StsApiResponse
    return normalizeStsResponse(data)
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('STS', 'STS 响应不是合法 JSON，或字段不完整。', error)
  }
}

async function loadCredentials(forceRefresh: boolean): Promise<StsCredentialSet> {
  if (!forceRefresh && cached && isFresh(cached)) {
    return cached
  }

  const connection = getOssConnectionConfig()

  if (hasStsUrl(connection)) {
    const next = await fetchStsCredentials(connection.stsUrl)
    cached = next
    return next
  }

  const local = getLocalDebugCredentials()
  if (local) {
    cached = local
    return local
  }

  throw new AppError(
    'CONFIG',
    '未配置凭证：请设置 VITE_STS_URL（推荐，见 docs/sts-setup.md），或在开发环境于 .env.local 填写临时 AccessKey + VITE_OSS_STS_TOKEN',
  )
}

/**
 * 获取可用 OSS 凭证（STS 优先；开发环境可回退本地调试 Key）。
 * 并发调用会合并为同一次请求。
 */
export async function getOssCredentials(forceRefresh = false): Promise<StsCredentialSet> {
  if (!forceRefresh && cached && isFresh(cached)) {
    return cached
  }

  if (!inflight) {
    inflight = loadCredentials(forceRefresh).finally(() => {
      inflight = null
    })
  }

  return inflight
}

export function clearStsCache(): void {
  cached = null
}

export function toOssCredentials(sts: StsCredentialSet): OssCredentials {
  const credentials: OssCredentials = {
    accessKeyId: sts.accessKeyId,
    accessKeySecret: sts.accessKeySecret,
  }
  if (sts.stsToken) {
    credentials.stsToken = sts.stsToken
  }
  return credentials
}

/** 当前凭证来源说明（用于 UI / 调试） */
export function getCredentialSourceLabel(): string {
  const connection = getOssConnectionConfig()
  if (hasStsUrl(connection)) return 'STS 接口'
  const local = getLocalDebugCredentials()
  if (local?.stsToken) return '本地临时 STS Token（仅 DEV）'
  if (local) return '本地调试 Key（仅 DEV，无 Token）'
  return '未配置'
}

export function isCredentialExpiredError(error: unknown): boolean {
  const appError = toAppError(error)
  if (appError.code === 'CREDENTIAL') {
    return true
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error ?? '')

  return /InvalidAccessKeyId|SecurityTokenExpired|InvalidSecurityToken|ExpiredToken/i.test(message)
}
