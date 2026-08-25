const DEFAULT_MAX_SIZE_MB = 50
const DEFAULT_MAX_TOTAL_SIZE_MB = 200
const DEFAULT_ALLOWED_EXT = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'pdf',
  'doc',
  'docx',
  'txt',
  'md',
]

function parseMaxSizeMb(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_SIZE_MB
}

function parseMaxTotalSizeMb(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOTAL_SIZE_MB
}

function parseAllowedExt(value: string | undefined): string[] {
  if (!value?.trim()) {
    return DEFAULT_ALLOWED_EXT
  }

  return value
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)
}

function parseThumbProcess(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''
  // 空 = 关闭；仅允许 image/ 开头，避免误配成任意 query
  if (!trimmed) return ''
  if (!trimmed.startsWith('image/')) return ''
  return trimmed
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/** 从 import.meta.env 读取并解析的应用配置（类型由 src/env.d.ts 保证） */
export const appEnv = {
  ossRegion: import.meta.env.VITE_OSS_REGION ?? '',
  ossBucket: import.meta.env.VITE_OSS_BUCKET ?? '',
  ossEndpoint: import.meta.env.VITE_OSS_ENDPOINT ?? '',
  ossDir: import.meta.env.VITE_OSS_DIR ?? 'uploads/',
  stsUrl: import.meta.env.VITE_STS_URL ?? '',
  maxSizeMb: parseMaxSizeMb(import.meta.env.VITE_MAX_SIZE_MB),
  maxTotalSizeMb: parseMaxTotalSizeMb(import.meta.env.VITE_MAX_TOTAL_SIZE_MB),
  allowedExt: parseAllowedExt(import.meta.env.VITE_ALLOWED_EXT),
  /**
   * 相册缩略图 OSS 图片处理（可选）。例：`image/resize,m_lfit,w_480/quality,q_80`
   * 需 Bucket 开通图片处理；留空则拉原图 Blob 生成 Object URL。
   */
  ossThumbProcess: parseThumbProcess(import.meta.env.VITE_OSS_THUMB_PROCESS),
  /** 相册缩略图并发拉取上限 */
  albumThumbConcurrency: parsePositiveInt(import.meta.env.VITE_ALBUM_THUMB_CONCURRENCY, 4),
}

export type AppEnv = typeof appEnv
