import { buildOssClientConfig } from '@/config/oss'
import { createOssClient, type OssClient } from '@/services/ossClient'
import { clearStsCache, getOssCredentials, isCredentialExpiredError, toOssCredentials } from '@/services/sts'
import type { StsCredentialSet } from '@/types/sts'
import { toAppError } from '@/utils/error'

let cachedClient: OssClient | null = null
let cachedCredentialKey: string | null = null

function credentialCacheKey(sts: StsCredentialSet): string {
  return `${sts.accessKeyId}:${sts.stsToken}:${sts.expiration}`
}

/** 凭证刷新或切换配置时清空客户端缓存 */
export function clearOssClientCache(): void {
  cachedClient = null
  cachedCredentialKey = null
}

export function invalidateOssSession(): void {
  clearStsCache()
  clearOssClientCache()
}

/** 使用最新可用凭证创建 OSS 客户端（同凭证复用实例） */
export async function getOssClient(forceRefresh = false): Promise<OssClient> {
  try {
    const sts = await getOssCredentials(forceRefresh)
    const key = credentialCacheKey(sts)

    if (!forceRefresh && cachedClient && cachedCredentialKey === key) {
      return cachedClient
    }

    cachedClient = createOssClient(buildOssClientConfig(toOssCredentials(sts)))
    cachedCredentialKey = key
    return cachedClient
  } catch (error) {
    throw toAppError(error)
  }
}

/**
 * 执行 OSS 操作；若判定为凭证过期，则强制刷新 STS 后重试一次。
 * 最终失败会抛出归一化后的 AppError。
 */
export async function withOssClient<T>(operation: (client: OssClient) => Promise<T>): Promise<T> {
  const client = await getOssClient()
  try {
    return await operation(client)
  } catch (error) {
    if (!isCredentialExpiredError(error)) {
      throw toAppError(error)
    }

    try {
      clearOssClientCache()
      const refreshed = await getOssClient(true)
      return await operation(refreshed)
    } catch (retryError) {
      throw toAppError(retryError)
    }
  }
}
