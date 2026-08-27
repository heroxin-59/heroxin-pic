import { getAccessUrl } from '@/services/fileList'
import { getAlbumAspectOrDefault, getCachedAlbumAspect } from '@/services/imageAspect'
import { loadImageObjectUrl } from '@/services/preview'
import type { FileRecord } from '@/types/file'

const ESTIMATED_WIDTH = 1600
const SIGNED_TTL_SEC = 3600
const SIGNED_REFRESH_BUFFER_MS = 5 * 60 * 1000
const MAX_BLOB_CACHE = 32

export type CachedPreviewSlide = {
  src: string
  width: number
  height: number
  alt: string
  key: string
  measured: boolean
  /** 签名 URL 过期时间（毫秒）；blob: URL 无此项 */
  expiresAt?: number
}

const slideCache = new Map<string, CachedPreviewSlide>()
const blobCache = new Map<string, string>()

function estimateSlideSize(key: string) {
  const aspect = getAlbumAspectOrDefault(key)
  return {
    width: ESTIMATED_WIDTH,
    height: Math.max(1, Math.round(ESTIMATED_WIDTH / aspect)),
  }
}

function isCachedSrcValid(slide: CachedPreviewSlide): boolean {
  if (!slide.src) return false
  if (slide.src.startsWith('blob:')) return true
  if (slide.expiresAt != null) {
    return Date.now() < slide.expiresAt - SIGNED_REFRESH_BUFFER_MS
  }
  return slide.src.startsWith('http')
}

export function getCachedPreviewSlide(key: string): CachedPreviewSlide | undefined {
  const slide = slideCache.get(key)
  if (!slide || !isCachedSrcValid(slide)) return undefined
  return slide
}

export function isPreviewSlideReady(key: string): boolean {
  const slide = getCachedPreviewSlide(key)
  return Boolean(slide?.src && slide.measured)
}

function touchBlobKey(key: string) {
  const url = blobCache.get(key)
  if (!url) return
  blobCache.delete(key)
  blobCache.set(key, url)
}

function storeBlobUrl(key: string, url: string) {
  const prev = blobCache.get(key)
  if (prev && prev !== url) URL.revokeObjectURL(prev)
  blobCache.delete(key)
  blobCache.set(key, url)
  while (blobCache.size > MAX_BLOB_CACHE) {
    const oldest = blobCache.keys().next().value
    if (!oldest) break
    const oldUrl = blobCache.get(oldest)
    if (oldUrl) URL.revokeObjectURL(oldUrl)
    blobCache.delete(oldest)
    const slide = slideCache.get(oldest)
    if (slide?.src === oldUrl) slideCache.delete(oldest)
  }
}

function measureImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      resolve({
        width: Math.max(1, img.naturalWidth),
        height: Math.max(1, img.naturalHeight),
      })
    }
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = url
  })
}

async function resolveSlideSrc(record: FileRecord): Promise<{ src: string; expiresAt?: number }> {
  const cached = getCachedPreviewSlide(record.key)
  if (cached?.src.startsWith('blob:')) {
    touchBlobKey(record.key)
    return { src: cached.src }
  }
  if (cached?.src) {
    return { src: cached.src, expiresAt: cached.expiresAt }
  }

  try {
    const src = await getAccessUrl(record.key, { expires: SIGNED_TTL_SEC })
    return { src, expiresAt: Date.now() + SIGNED_TTL_SEC * 1000 }
  } catch {
    if (record.url) {
      return { src: record.url, expiresAt: Date.now() + SIGNED_TTL_SEC * 1000 }
    }
    const src = await loadImageObjectUrl(record.key)
    storeBlobUrl(record.key, src)
    return { src }
  }
}

/** 解析预览图 URL 与尺寸；命中会话缓存时不再重复请求 OSS */
export async function resolvePreviewSlide(
  record: FileRecord,
  measure = false,
): Promise<CachedPreviewSlide> {
  const cached = getCachedPreviewSlide(record.key)
  if (cached?.src && cached.measured) return cached
  if (cached?.src && !measure) return cached

  const { src, expiresAt } = await resolveSlideSrc(record)

  if (measure) {
    if (getCachedAlbumAspect(record.key) != null) {
      const { width, height } = estimateSlideSize(record.key)
      const slide: CachedPreviewSlide = {
        src,
        width,
        height,
        alt: record.name,
        key: record.key,
        measured: true,
        expiresAt,
      }
      slideCache.set(record.key, slide)
      return slide
    }

    const size = await measureImage(src)
    const slide: CachedPreviewSlide = {
      src,
      width: size.width,
      height: size.height,
      alt: record.name,
      key: record.key,
      measured: true,
      expiresAt,
    }
    slideCache.set(record.key, slide)
    return slide
  }

  const { width, height } = estimateSlideSize(record.key)
  const slide: CachedPreviewSlide = {
    src,
    width,
    height,
    alt: record.name,
    key: record.key,
    measured: false,
    expiresAt,
  }
  slideCache.set(record.key, slide)
  return slide
}

export function updatePreviewSlideDimensions(
  key: string,
  width: number,
  height: number,
  src?: string,
) {
  const cached = slideCache.get(key)
  if (!cached) return
  slideCache.set(key, {
    ...cached,
    width,
    height,
    measured: true,
    src: src ?? cached.src,
  })
}

export function invalidatePreviewSlide(key: string) {
  const cached = slideCache.get(key)
  if (cached?.src.startsWith('blob:')) {
    URL.revokeObjectURL(cached.src)
    blobCache.delete(key)
  }
  slideCache.delete(key)
}

export function clearPreviewSlideCache() {
  for (const url of blobCache.values()) {
    URL.revokeObjectURL(url)
  }
  blobCache.clear()
  slideCache.clear()
}

export function peekPreviewSlideCache(key: string): CachedPreviewSlide | undefined {
  return slideCache.get(key)
}

export function syncPreviewDataSourceFromCache<
  T extends { src?: string; width: number; height: number },
>(dataSource: T[], records: FileRecord[]) {
  records.forEach((record, index) => {
    const cached = getCachedPreviewSlide(record.key) ?? slideCache.get(record.key)
    const item = dataSource[index]
    if (!cached?.src || !item) return
    item.src = cached.src
    item.width = cached.width
    item.height = cached.height
  })
}
