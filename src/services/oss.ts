import { buildOssClientConfig } from '@/config/oss'
import { createOssClient, type OssClient } from '@/services/ossClient'
import { getOssCredentials, isCredentialExpiredError, toOssCredentials } from '@/services/sts'
import { toAppError } from '@/utils/error'

/** 使用最新可用凭证创建 OSS 客户端 */
export async function getOssClient(forceRefresh = false): Promise<OssClient> {
  try {
    const sts = await getOssCredentials(forceRefresh)
    return createOssClient(buildOssClientConfig(toOssCredentials(sts)))
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
      const refreshed = await getOssClient(true)
      return await operation(refreshed)
    } catch (retryError) {
      throw toAppError(retryError)
    }
  }
}
