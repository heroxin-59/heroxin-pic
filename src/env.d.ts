/// <reference types="vite/client" />

/** 仅 `VITE_` 前缀变量会暴露到客户端，见 .env.example */
interface ImportMetaEnv {
  /** OSS 地域，如 oss-cn-hangzhou */
  readonly VITE_OSS_REGION: string
  /** Bucket 名称 */
  readonly VITE_OSS_BUCKET: string
  /** 自定义 Endpoint / 域名（可选） */
  readonly VITE_OSS_ENDPOINT?: string
  /** 上传目录前缀，如 uploads/ */
  readonly VITE_OSS_DIR: string
  /** 获取 STS 临时凭证的接口地址（生产推荐） */
  readonly VITE_STS_URL?: string
  /**
   * 仅本地调试：AccessKeyId（禁止提交、禁止生产使用）
   * 有 VITE_STS_URL 时优先走 STS
   */
  readonly VITE_OSS_ACCESS_KEY_ID?: string
  /** 仅本地调试：AccessKeySecret */
  readonly VITE_OSS_ACCESS_KEY_SECRET?: string
  /** 仅本地调试：若使用 STS 临时 Key 可填 Token；长期 Key 可留空 */
  readonly VITE_OSS_STS_TOKEN?: string
  /** 单文件大小上限（MB） */
  readonly VITE_MAX_SIZE_MB: string
  /** 单次选择/队列总体积上限（MB） */
  readonly VITE_MAX_TOTAL_SIZE_MB: string
  /** 允许上传的扩展名，逗号分隔 */
  readonly VITE_ALLOWED_EXT: string
  /** 重名策略：uuid | timestamp | overwrite | suffix */
  readonly VITE_DUPLICATE_STRATEGY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
