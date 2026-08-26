/** OSS 访问凭证（STS 临时凭证或本地调试密钥） */
export interface OssCredentials {
  accessKeyId: string
  accessKeySecret: string
  /** STS 必填；长期 Key 本地调试时可省略 */
  stsToken?: string
}

/** 创建客户端时的连接配置 */
export interface OssClientConfig {
  region: string
  bucket: string
  /** 自定义域名 / endpoint，可选 */
  endpoint?: string
  /** 上传对象前缀，如 uploads/ */
  dir?: string
  credentials: OssCredentials
}

/** README / 对外文档中的 OssConfig，与 OssClientConfig 同义 */
export type OssConfig = OssClientConfig

export interface OssUploadOptions {
  /** 对象完整 Key；不传则由调用方自行拼好再传入 key */
  key: string
  file: File | Blob
  /** 0–100 进度回调；第二参数为分片断点，可用于取消/续传 */
  onProgress?: (percent: number, checkpoint?: unknown) => void
  /** 分片上传断点（续传 / 取消时使用） */
  abortCheckpoint?: unknown
  /** 取消信号：abort 后会调用 ali-oss cancel */
  signal?: AbortSignal
}

export interface OssUploadResult {
  name: string
  url: string
  res: unknown
}

export interface OssListOptions {
  prefix?: string
  marker?: string
  /** 单次最多条数，默认 100 */
  maxKeys?: number
  delimiter?: string
}

export interface OssListedObject {
  name: string
  url?: string
  size?: number
  lastModified?: string
  etag?: string
}

export interface OssListResult {
  objects: OssListedObject[]
  prefixes: string[]
  nextMarker: string | null
  isTruncated: boolean
}

export interface OssSignedUrlOptions {
  /** 过期秒数，默认 3600 */
  expires?: number
  /**
   * 阿里云图片处理参数（签名进 URL），如 `image/resize,m_lfit,w_480`。
   * 需 Bucket 开通图片处理；未开通时不要配置。
   */
  process?: string
  /** 下载时建议的文件名 */
  response?: {
    'content-disposition'?: string
  }
}
