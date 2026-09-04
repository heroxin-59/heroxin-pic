import { appEnv } from '@/config/env'
import { formatAllowedTypeSummary, groupAllowedExtensions } from '@/constants/fileTypes'
import type { OssClientConfig, OssCredentials } from '@/types/oss'
import { AppError } from '@/types/error'

/** 不含凭证的 OSS 连接配置（来自环境变量） */
export interface OssConnectionConfig {
  region: string
  bucket: string
  endpoint: string
  dir: string
  stsUrl: string
}

function normalizeDir(dir: string): string {
  if (!dir.trim()) return 'uploads/'
  return dir.replace(/^\/+/, '').replace(/\/?$/, '/')
}

/** 从 appEnv 读取并规范化的 OSS 连接配置 */
export function getOssConnectionConfig(): OssConnectionConfig {
  return {
    region: appEnv.ossRegion.trim(),
    bucket: appEnv.ossBucket.trim(),
    endpoint: appEnv.ossEndpoint.trim(),
    dir: normalizeDir(appEnv.ossDir),
    stsUrl: appEnv.stsUrl.trim(),
  }
}

/** 连接级必填项是否齐全（不含凭证） */
export function isOssConnectionConfigured(config = getOssConnectionConfig()): boolean {
  return Boolean(config.region && config.bucket)
}

/** 是否已配置 STS 接口地址 */
export function hasStsUrl(config = getOssConnectionConfig()): boolean {
  return Boolean(config.stsUrl)
}

/**
 * 检查连接配置，返回缺失项文案列表。
 * 空数组表示连接配置就绪。
 */
export function getOssConnectionMissing(config = getOssConnectionConfig()): string[] {
  const missing: string[] = []
  if (!config.region) missing.push('VITE_OSS_REGION')
  if (!config.bucket) missing.push('VITE_OSS_BUCKET')
  return missing
}

/**
 * 将连接配置与凭证合并为 `createOssClient` 所需参数。
 * 凭证由 STS（2.4）或本地调试注入，本模块不读取长期 Key。
 */
export function buildOssClientConfig(
  credentials: OssCredentials,
  connection = getOssConnectionConfig(),
): OssClientConfig {
  const missing = getOssConnectionMissing(connection)
  if (missing.length > 0) {
    throw new AppError(
      'CONFIG',
      `OSS 连接配置不完整，请在 .env.local 中填写：${missing.join(', ')}`,
    )
  }

  return {
    region: connection.region,
    bucket: connection.bucket,
    endpoint: connection.endpoint || undefined,
    dir: connection.dir,
    credentials,
  }
}

/** 上传限制等业务侧配置（仍来自 appEnv） */
export function getUploadLimits() {
  const allowedExt = appEnv.allowedExt
  return {
    maxSizeMb: appEnv.maxSizeMb,
    maxSizeBytes: appEnv.maxSizeMb * 1024 * 1024,
    maxVideoSizeMb: appEnv.maxVideoSizeMb,
    maxVideoSizeBytes: appEnv.maxVideoSizeMb * 1024 * 1024,
    maxTotalSizeMb: appEnv.maxTotalSizeMb,
    maxTotalBytes: appEnv.maxTotalSizeMb * 1024 * 1024,
    allowedExt,
    allowedTypeGroups: groupAllowedExtensions(allowedExt),
    allowedTypeSummary: formatAllowedTypeSummary(allowedExt),
  }
}
