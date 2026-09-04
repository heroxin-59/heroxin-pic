import exifr from 'exifr'
import { getObjectBlob } from '@/services/fileList'
import { createLimiter } from '@/utils/concurrency'

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

/** 同一坐标待逆地理的对象 Key（按四位小数去重） */
const geocodeKeysByCoord = new Map<string, Set<string>>()
const geocodeQueue: string[] = []
const geocodeQueued = new Set<string>()

const geocodeLimiter = createLimiter(2)
const SCROLL_IDLE_MS = 400

let scrollIdle = true
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null
let scrollListenerAttached = false
let geocodePumpScheduled = false

type MetaUpdateListener = (meta: AlbumImageMeta) => void
const metaUpdateListeners = new Set<MetaUpdateListener>()

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

function notifyMetaUpdate(meta: AlbumImageMeta) {
  for (const listener of metaUpdateListeners) {
    listener(meta)
  }
}

function updateMetaLocationLabel(key: string, locationLabel: string) {
  const cached = metaCache.get(key)
  if (!cached || cached.locationLabel === locationLabel) return
  const next = { ...cached, locationLabel }
  metaCache.set(key, next)
  notifyMetaUpdate(next)
}

function applyGeocodeLabel(geoKey: string, place: string | undefined) {
  const keys = geocodeKeysByCoord.get(geoKey)
  if (!keys) return
  for (const key of keys) {
    const cached = metaCache.get(key)
    if (!cached) continue
    const locationLabel = place || cached.locationLabel || formatGpsLabel(cached.latitude!, cached.longitude!)
    updateMetaLocationLabel(key, locationLabel)
  }
  geocodeKeysByCoord.delete(geoKey)
}

function markScrolling() {
  scrollIdle = false
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer)
  scrollIdleTimer = setTimeout(() => {
    scrollIdle = true
    scheduleGeocodePump()
  }, SCROLL_IDLE_MS)
}

function ensureScrollListener() {
  if (scrollListenerAttached || typeof window === 'undefined') return
  scrollListenerAttached = true
  window.addEventListener('scroll', markScrolling, { passive: true, capture: true })
}

function enqueueGeocode(key: string, lat: number, lng: number) {
  const geoKey = geocodeCacheKey(lat, lng)

  const cachedPlace = geocodeCache.get(geoKey)
  if (cachedPlace) {
    updateMetaLocationLabel(key, cachedPlace)
    return
  }

  let keys = geocodeKeysByCoord.get(geoKey)
  if (!keys) {
    keys = new Set()
    geocodeKeysByCoord.set(geoKey, keys)
  }
  keys.add(key)

  if (geocodeQueued.has(geoKey) || geocodeInflight.has(geoKey)) {
    ensureScrollListener()
    return
  }

  geocodeQueued.add(geoKey)
  geocodeQueue.push(geoKey)

  ensureScrollListener()
  scheduleGeocodePump()
}

function scheduleGeocodePump() {
  if (geocodePumpScheduled) return
  geocodePumpScheduled = true
  queueMicrotask(() => {
    geocodePumpScheduled = false
    void pumpGeocodeQueue()
  })
}

async function pumpGeocodeQueue() {
  if (!scrollIdle) return

  while (scrollIdle && geocodeQueue.length > 0) {
    const geoKey = geocodeQueue.shift()
    if (!geoKey) break
    geocodeQueued.delete(geoKey)

    const keys = geocodeKeysByCoord.get(geoKey)
    const sampleKey = keys ? keys.values().next().value : undefined
    const sample = sampleKey ? metaCache.get(sampleKey) : undefined
    if (!sample || sample.latitude == null || sample.longitude == null) {
      geocodeKeysByCoord.delete(geoKey)
      continue
    }

    const { latitude: lat, longitude: lng } = sample
    void geocodeLimiter
      .run(async () => {
        const place = await reverseGeocode(lat, lng)
        applyGeocodeLabel(geoKey, place)
      })
      .catch(() => {
        applyGeocodeLabel(geoKey, undefined)
      })
  }
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
        `&localityLanguage=zh-Hans`
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
        meta.locationLabel = formatGpsLabel(lat, lng)
      }
    }
  } catch {
    // 无 EXIF / 不支持的格式：静默回退
  }

  metaCache.set(key, meta)

  if (meta.latitude != null && meta.longitude != null) {
    enqueueGeocode(key, meta.latitude, meta.longitude)
  }

  return meta
}

/** 逆地理完成后通知 UI 刷新地点文案 */
export function subscribeAlbumMetaUpdate(listener: MetaUpdateListener): () => void {
  metaUpdateListeners.add(listener)
  return () => {
    metaUpdateListeners.delete(listener)
  }
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
  geocodeCache.clear()
  geocodeInflight.clear()
  geocodeKeysByCoord.clear()
  geocodeQueue.length = 0
  geocodeQueued.clear()
}

/** 测试用：重置滚停状态并立即处理逆地理队列 */
export function flushDeferredGeocodeForTests(options?: { scrollIdle?: boolean }) {
  if (options?.scrollIdle !== undefined) {
    scrollIdle = options.scrollIdle
  }
  scheduleGeocodePump()
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
