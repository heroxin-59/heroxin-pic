import OSS from 'ali-oss'
import type {
  OssClientConfig,
  OssListOptions,
  OssListResult,
  OssListedObject,
  OssSignedUrlOptions,
  OssUploadOptions,
  OssUploadResult,
} from '@/types/oss'
import { AppError } from '@/types/error'

function normalizeDir(dir?: string): string {
  if (!dir?.trim()) return ''
  return dir.replace(/^\/+/, '').replace(/\/?$/, '/')
}

const ALI_OSS_STS_WARN = 'Please use STS Token for safety'

let devLocalKeyHintLogged = false

/**
 * 开发环境用长期 Key（无 stsToken）时，ali-oss 每次 new 都会 warn。
 * 有 STS Token 时不会触发；无 Token 时仅抑制刷屏并提示一次。
 */
function createAliOssClient(options: OSS.Options, hasStsToken: boolean): OSS {
  if (hasStsToken || !import.meta.env.DEV) {
    return new OSS(options)
  }

  const originalWarn = console.warn
  console.warn = (...args: unknown[]) => {
    const first = args[0]
    if (typeof first === 'string' && first.includes(ALI_OSS_STS_WARN)) {
      if (!devLocalKeyHintLogged) {
        devLocalKeyHintLogged = true
        originalWarn.call(
          console,
          '[heroxin-pic] 当前未使用 STS Token。请配置 VITE_STS_URL（推荐）或本地临时凭证 VITE_OSS_STS_TOKEN。详见 docs/sts-setup.md',
        )
      }
      return
    }
    originalWarn.apply(console, args as Parameters<typeof console.warn>)
  }

  try {
    return new OSS(options)
  } finally {
    console.warn = originalWarn
  }
}

function createClientOptions(config: OssClientConfig): OSS.Options {
  const { region, bucket, endpoint, credentials } = config

  if (!region) {
    throw new Error('OSS region 未配置')
  }
  if (!bucket) {
    throw new Error('OSS bucket 未配置')
  }
  if (!credentials.accessKeyId || !credentials.accessKeySecret) {
    throw new Error('OSS 凭证不完整')
  }

  const options: OSS.Options = {
    region,
    bucket,
    accessKeyId: credentials.accessKeyId,
    accessKeySecret: credentials.accessKeySecret,
    secure: true,
  }

  if (credentials.stsToken) {
    options.stsToken = credentials.stsToken
  }

  if (endpoint?.trim()) {
    options.endpoint = endpoint.trim()
    // 自定义域名时通常关闭 bucket 子域名拼接
    options.cname = true
  }

  return options
}

/**
 * 封装 ali-oss：创建客户端、上传、列举、删除、签名 URL。
 * 凭证由外部注入（STS 或本地调试），本类不读取长期密钥。
 */
export class OssClient {
  private readonly client: OSS
  readonly dir: string

  constructor(config: OssClientConfig) {
    this.dir = normalizeDir(config.dir)
    const options = createClientOptions(config)
    this.client = createAliOssClient(options, Boolean(config.credentials.stsToken))
  }

  /** 将相对路径拼到配置的目录前缀下 */
  resolveKey(relativeKey: string): string {
    const cleaned = relativeKey.replace(/^\/+/, '')
    return `${this.dir}${cleaned}`
  }

  /**
   * 使用分片上传以支持进度回调（浏览器直传推荐）。
   * `progress` 回调参数为 0–1，此处转换为 0–100。
   * 传入 `signal` 可取消当前上传。
   */
  async upload(options: OssUploadOptions): Promise<OssUploadResult> {
    const { key, file, onProgress, abortCheckpoint, signal } = options

    if (signal?.aborted) {
      throw new AppError('CANCELLED', '操作已取消。')
    }

    const onAbort = () => {
      try {
        this.client.cancel()
      } catch {
        // ignore cancel race
      }
    }

    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const result = await this.client.multipartUpload(key, file, {
        checkpoint: abortCheckpoint as OSS.Checkpoint | undefined,
        progress: async (percent: number, checkpoint?: OSS.Checkpoint) => {
          if (signal?.aborted) {
            onAbort()
            throw new AppError('CANCELLED', '操作已取消。')
          }
          onProgress?.(Math.min(100, Math.round(percent * 100)), checkpoint)
        },
      })

      return {
        name: result.name,
        url: this.getSignedUrl(key),
        res: result.res,
      }
    } catch (error) {
      if (signal?.aborted) {
        throw new AppError('CANCELLED', '操作已取消。', error)
      }
      throw error
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  async list(options: OssListOptions = {}): Promise<OssListResult> {
    const prefix = options.prefix ?? this.dir
    const result = await this.client.list(
      {
        prefix,
        marker: options.marker,
        'max-keys': options.maxKeys ?? 100,
        delimiter: options.delimiter,
      },
      {},
    )

    const objects: OssListedObject[] = (result.objects ?? []).map((item) => ({
      name: item.name,
      url: item.url,
      size: item.size,
      lastModified: item.lastModified,
      etag: item.etag,
    }))

    return {
      objects,
      prefixes: result.prefixes ?? [],
      nextMarker: result.nextMarker ?? null,
      isTruncated: Boolean(result.isTruncated),
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(key)
  }

  /**
   * 读取对象为 Blob（浏览器预览用，走 SDK 鉴权，不依赖 img 直连签名 URL）。
   */
  async getObjectBlob(key: string): Promise<Blob> {
    const result = await this.client.get(key)
    const headers = (result.res?.headers ?? {}) as Record<string, string>
    const contentType =
      headers['content-type'] || headers['Content-Type'] || 'application/octet-stream'
    const content = result.content as BlobPart
    return new Blob([content], { type: contentType })
  }

  /**
   * 生成私有读签名 URL（默认 1 小时）。
   * 注意：签名在客户端用临时凭证生成，过期后需重新签发。
   */
  getSignedUrl(key: string, options: OssSignedUrlOptions = {}): string {
    const expires = options.expires ?? 3600
    return this.client.signatureUrl(key, {
      expires,
      response: options.response,
      process: options.process,
    })
  }

  /** 暴露底层实例，供高级用法或调试 */
  get raw(): OSS {
    return this.client
  }
}

/** 工厂方法，便于测试与后续 STS 刷新后重建客户端 */
export function createOssClient(config: OssClientConfig): OssClient {
  return new OssClient(config)
}
