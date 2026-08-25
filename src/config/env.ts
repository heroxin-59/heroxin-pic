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
}

export type AppEnv = typeof appEnv
