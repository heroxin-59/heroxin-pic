import { computed } from 'vue'
import {
  buildOssClientConfig,
  getOssConnectionConfig,
  getOssConnectionMissing,
  getUploadLimits,
  hasStsUrl,
  isOssConnectionConfigured,
  type OssConnectionConfig,
} from '@/config/oss'
import { withOssClient } from '@/services/oss'
import type { OssCredentials } from '@/types/oss'

/**
 * OSS 连接与客户端入口（阶段 7.5）。
 * 上传/列表等业务仍走 `services/*`；此处提供配置态与底层 `withOssClient`。
 */
export function useOss() {
  const connection = computed<OssConnectionConfig>(() => getOssConnectionConfig())
  const configured = computed(() => isOssConnectionConfigured(connection.value))
  const missingEnvKeys = computed(() => getOssConnectionMissing(connection.value))
  const stsConfigured = computed(() => hasStsUrl(connection.value))
  const uploadLimits = computed(() => getUploadLimits())

  return {
    connection,
    configured,
    missingEnvKeys,
    stsConfigured,
    uploadLimits,
    /** 将 STS/调试凭证与连接配置合并 */
    buildClientConfig: (credentials: OssCredentials) =>
      buildOssClientConfig(credentials, connection.value),
    /** 在有效客户端上执行操作（自动取 STS） */
    withClient: withOssClient,
  }
}
