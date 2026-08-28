import { getAccessUrl } from '@/services/fileList'
import { createLimiter } from '@/utils/concurrency'
import { appEnv } from '@/config/env'

export interface VideoAlbumThumbResult {
  key: string
  /** 签名播放地址（用于 <video> 首帧预览） */
  url: string
}

type CacheEntry = {
  url: string
  refs: number
  expiresAt: number
  lastUsed: number
}

const SIGNED_URL_TTL_SEC = 3600
const SIGNED_REFRESH_MARGIN_MS = 60_000
const MAX_IDLE_CACHE = 32

const limiter = createLimiter(Math.max(2, Math.min(appEnv.albumThumbConcurrency, 3)))
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<VideoAlbumThumbResult>>()

function isUsable(entry: CacheEntry, now = Date.now()): boolean {
  return entry.expiresAt - SIGNED_REFRESH_MARGIN_MS > now
}

function touch(entry: CacheEntry) {
  entry.lastUsed = Date.now()
}

function toResult(key: string, entry: CacheEntry): VideoAlbumThumbResult {
  return { key, url: entry.url }
}

function evictIdle() {
  const idle: Array<{ key: string; entry: CacheEntry }> = []
  for (const [key, entry] of cache) {
    if (entry.refs <= 0) idle.push({ key, entry })
  }
  if (idle.length <= MAX_IDLE_CACHE) return
  idle.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed)
  const overflow = idle.length - MAX_IDLE_CACHE
  for (let i = 0; i < overflow; i += 1) {
    const item = idle[i]
    if (!item) continue
    cache.delete(item.key)
  }
}

async function loadFresh(key: string): Promise<VideoAlbumThumbResult> {
  return limiter.run(async () => {
    const url = await getAccessUrl(key, { expires: SIGNED_URL_TTL_SEC })
    const entry: CacheEntry = {
      url,
      refs: 0,
      expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
      lastUsed: Date.now(),
    }
    const old = cache.get(key)
    if (old) entry.refs = old.refs
    cache.set(key, entry)
    return toResult(key, entry)
  })
}

/**
 * 获取相册视频缩略图用的签名 URL。
 * 组件须成对调用 `releaseVideoAlbumThumb`。
 */
export async function acquireVideoAlbumThumb(
  key: string,
  options?: { force?: boolean },
): Promise<VideoAlbumThumbResult> {
  const force = Boolean(options?.force)
  const existing = cache.get(key)

  if (!force && existing && isUsable(existing)) {
    existing.refs += 1
    touch(existing)
    return toResult(key, existing)
  }

  let pending = inflight.get(key)
  if (force || !pending) {
    pending = loadFresh(key).finally(() => {
      if (inflight.get(key) === pending) inflight.delete(key)
    })
    inflight.set(key, pending)
  }

  const result = await pending
  const entry = cache.get(key)
  if (entry) {
    entry.refs += 1
    touch(entry)
    evictIdle()
    return toResult(key, entry)
  }
  return result
}

export function releaseVideoAlbumThumb(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  touch(entry)
  evictIdle()
}

export function clearVideoAlbumThumbCache() {
  cache.clear()
  inflight.clear()
}
