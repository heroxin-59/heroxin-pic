import exifr from 'exifr'
import { getObjectBlob } from '@/services/fileList'

/** 相册图片元数据（EXIF + 可选逆地理） */
export interface AlbumImageMeta {
  key: string
  /** 拍摄时间 ISO；无 EXIF 时为空，分组回退 uploadedAt */
  captureAt?: string
  latitude?: number
  longitude?: number
  /** 地点文案；逆地理失败时可能为坐标文案 */
  locationLabel?: string
}

const metaCache = new Map<string, AlbumImageMeta>()
const geocodeCache = new Map<string, string>()
const geocodeInflight = new Map<string, Promise<string | undefined>>()

function toIsoFromExifDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }
  if (typeof value === 'string' && value.trim()) {
    // EXIF 常见 "2026:08:21 12:30:00"
    const normalized = value.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    const date = new Date(normalized)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  return undefined
}

function formatGpsLabel(lat: number, lng: number): string {
  const latHem = lat >= 0 ? 'N' : 'S'
  const lngHem = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}°${latHem}, ${Math.abs(lng).toFixed(4)}°${lngHem}`
}

function geocodeCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

/** 浏览器端逆地理（BigDataCloud 免 key 客户端接口）；失败则返回 undefined */
async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  const key = geocodeCacheKey(lat, lng)
  const cached = geocodeCache.get(key)
  if (cached) return cached

  const inflight = geocodeInflight.get(key)
  if (inflight) return inflight

  const task = (async () => {
    try {
      const url =
        `https://api.bigdatacloud.net/data/reverse-geocode-client` +
        `?latitude=${encodeURIComponent(String(lat))}` +
        `&longitude=${encodeURIComponent(String(lng))}` +
        `&localityLanguage=zh`
      const response = await fetch(url)
      if (!response.ok) return undefined
      const data = (await response.json()) as {
        locality?: string
        city?: string
        principalSubdivision?: string
        countryName?: string
      }
      const parts = [data.locality, data.city, data.principalSubdivision].filter(
        (item): item is string => Boolean(item && item.trim()),
      )
      const unique = [...new Set(parts)]
      const label = unique.slice(0, 2).join(' ') || data.countryName?.trim()
      if (label) {
        geocodeCache.set(key, label)
        return label
      }
    } catch {
      // ignore network / CORS
    }
    return undefined
  })()

  geocodeInflight.set(key, task)
  try {
    return await task
  } finally {
    geocodeInflight.delete(key)
  }
}

async function parseExifMeta(key: string, blob: Blob): Promise<AlbumImageMeta> {
  const cached = metaCache.get(key)
  if (cached && (cached.captureAt || cached.latitude != null || cached.locationLabel)) {
    return cached
  }

  const meta: AlbumImageMeta = { key }

  try {
    const exif = await exifr.parse(blob, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'GPSLatitude',
        'GPSLongitude',
        'latitude',
        'longitude',
      ],
      translateKeys: false,
      reviveValues: true,
      sanitize: false,
    })

    if (exif) {
      meta.captureAt =
        toIsoFromExifDate(exif.DateTimeOriginal) ||
        toIsoFromExifDate(exif.CreateDate) ||
        toIsoFromExifDate(exif.ModifyDate)

      const lat =
        typeof exif.latitude === 'number'
          ? exif.latitude
          : typeof exif.GPSLatitude === 'number'
            ? exif.GPSLatitude
            : undefined
      const lng =
        typeof exif.longitude === 'number'
          ? exif.longitude
          : typeof exif.GPSLongitude === 'number'
            ? exif.GPSLongitude
            : undefined

      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        meta.latitude = lat
        meta.longitude = lng
      }
    }
  } catch {
    // 无 EXIF / 不支持的格式：静默回退
  }

  if (meta.latitude != null && meta.longitude != null) {
    const place = await reverseGeocode(meta.latitude, meta.longitude)
    meta.locationLabel = place || formatGpsLabel(meta.latitude, meta.longitude)
  }

  metaCache.set(key, meta)
  return meta
}

/** 供相册缩略图缓存层复用：从 Blob 解析并缓存 EXIF */
export async function parseAlbumMetaFromBlob(key: string, blob: Blob): Promise<AlbumImageMeta> {
  return parseExifMeta(key, blob)
}

export function getCachedAlbumMeta(key: string): AlbumImageMeta | undefined {
  return metaCache.get(key)
}

export function clearAlbumMetaCache() {
  metaCache.clear()
}

/**
 * @deprecated 请优先使用 `acquireAlbumThumb`（含并发限流与 URL 缓存）
 * 拉取图片 Blob：生成 Object URL，并解析 EXIF。调用方负责 revoke objectUrl。
 */
export async function loadAlbumImageWithMeta(key: string): Promise<{
  objectUrl: string
  meta: AlbumImageMeta
}> {
  const blob = await getObjectBlob(key)
  const meta = await parseExifMeta(key, blob)
  const objectUrl = URL.createObjectURL(blob)
  return { objectUrl, meta }
}
