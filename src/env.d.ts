/// <reference types="vite/client" />

/** 仅 `VITE_` 前缀变量会暴露到客户端，见 .env.example */
interface ImportMetaEnv {
  /** 部署子路径，如 /pic/；根路径为 /。由 Vite `base` 注入为 import.meta.env.BASE_URL */
  readonly VITE_BASE?: string
  /** OSS 地域，如 oss-cn-hangzhou */
  readonly VITE_OSS_REGION: string
  /** Bucket 名称 */
  readonly VITE_OSS_BUCKET: string
  /** 自定义 Endpoint / 域名（可选） */
  readonly VITE_OSS_ENDPOINT?: string
  /** 上传目录前缀，如 uploads/ */
  readonly VITE_OSS_DIR: string
  /** 获取 STS 临时凭证的接口（推荐）；本地可用 /api/sts 代理到 sts-server */
  readonly VITE_STS_URL?: string
  /**
   * 仅本地调试：AccessKeyId（禁止提交、禁止生产使用）
   * 有 VITE_STS_URL 时优先走 STS
   */
  readonly VITE_OSS_ACCESS_KEY_ID?: string
  /** 仅本地调试：AccessKeySecret */
  readonly VITE_OSS_ACCESS_KEY_SECRET?: string
  /** 仅本地调试：若使用 STS 临时 Key 必填 SecurityToken；长期 Key 可留空（会有 SDK 警告） */
  readonly VITE_OSS_STS_TOKEN?: string
  /** 单文件大小上限（MB） */
  readonly VITE_MAX_SIZE_MB: string
  /** 单次选择/队列总体积上限（MB） */
  readonly VITE_MAX_TOTAL_SIZE_MB: string
  /** 允许上传的扩展名，逗号分隔 */
  readonly VITE_ALLOWED_EXT: string
  /** 重名策略：uuid | timestamp | overwrite | suffix */
  readonly VITE_DUPLICATE_STRATEGY?: string
  /**
   * 相册缩略图 OSS 图片处理（可选），如 image/resize,m_lfit,w_480/quality,q_80
   * 需开通图片处理；留空则使用原图 Blob
   */
  readonly VITE_OSS_THUMB_PROCESS?: string
  /** 相册缩略图并发数，默认 4 */
  readonly VITE_ALBUM_THUMB_CONCURRENCY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
