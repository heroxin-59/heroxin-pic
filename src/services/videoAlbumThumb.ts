import { appEnv } from '@/config/env'
import { getAccessUrl } from '@/services/fileList'
import { createLimiter } from '@/utils/concurrency'

export interface VideoAlbumThumbResult {
  key: string
  /** 签名播放地址（无 poster 时用于 <video> 解码首帧） */
  url: string
  /** 已提取的首帧封面（blob: / https 签名 URL） */
  posterUrl?: string
}

type VideoThumbEntry = {
  url: string
  posterUrl: string | null
  refs: number
  expiresAt: number
  lastUsed: number
}

const SIGNED_URL_TTL_SEC = 3600
const SIGNED_REFRESH_MARGIN_MS = 60_000
/** 无引用时仍保留的闲置封面数（与图片缩略图策略一致） */
const MAX_IDLE_CACHE = 96

const limiter = createLimiter(appEnv.albumThumbConcurrency)
const cache = new Map<string, VideoThumbEntry>()
const inflight = new Map<string, Promise<VideoThumbEntry>>()

function videoSnapshotProcess(): string {
  return appEnv.ossVideoSnapshotProcess
}

function isUsable(entry: VideoThumbEntry, now = Date.now()): boolean {
  return entry.expiresAt - SIGNED_REFRESH_MARGIN_MS > now
}

function touch(entry: VideoThumbEntry) {
  entry.lastUsed = Date.now()
}

function revokePosterUrl(url: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function toResult(key: string, entry: VideoThumbEntry): VideoAlbumThumbResult {
  return {
    key,
    url: entry.url,
    posterUrl: entry.posterUrl ?? undefined,
  }
}

function evictIdle() {
  const idle: Array<{ key: string; entry: VideoThumbEntry }> = []
  for (const [key, entry] of cache) {
    if (entry.refs <= 0) idle.push({ key, entry })
  }
  if (idle.length <= MAX_IDLE_CACHE) return

  idle.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed)
  const overflow = idle.length - MAX_IDLE_CACHE
  for (let i = 0; i < overflow; i += 1) {
    const item = idle[i]
    if (!item) continue
    revokePosterUrl(item.entry.posterUrl)
    cache.delete(item.key)
  }
}

async function loadFresh(key: string, keepPoster: string | null): Promise<VideoThumbEntry> {
  const snapshot = videoSnapshotProcess()
  const url = await getAccessUrl(key, { expires: SIGNED_URL_TTL_SEC })

  let posterUrl = keepPoster
  if (!posterUrl && snapshot) {
    try {
      posterUrl = await getAccessUrl(key, { expires: SIGNED_URL_TTL_SEC, process: snapshot })
    } catch {
      // 未开通视频截帧 / 签名失败时回退 <video> 首帧
    }
  }

  return {
    url,
    posterUrl,
    refs: 0,
    expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
    lastUsed: Date.now(),
  }
}

/**
 * 获取相册视频缩略图（签名 URL + 可选 OSS 截帧 / 首帧 poster 缓存）。
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

  const keepPoster = existing?.posterUrl ?? null

  let pending = inflight.get(key)
  if (force || !pending) {
    pending = limiter
      .run(() => loadFresh(key, keepPoster))
      .then((entry) => {
        cache.set(key, entry)
        return entry
      })
      .finally(() => {
        if (inflight.get(key) === pending) inflight.delete(key)
      })
    inflight.set(key, pending)
  }

  const entry = await pending
  entry.refs += 1
  touch(entry)
  evictIdle()
  return toResult(key, entry)
}

/** 视频首帧提取成功后写入缓存，切换 Tab 后可立即展示 */
export function setVideoAlbumPoster(key: string, posterUrl: string) {
  const entry = cache.get(key)
  if (!entry || !posterUrl) return
  if (entry.posterUrl && entry.posterUrl !== posterUrl) {
    revokePosterUrl(entry.posterUrl)
  }
  entry.posterUrl = posterUrl
  touch(entry)
}

export function peekVideoAlbumPoster(key: string): string | undefined {
  return cache.get(key)?.posterUrl ?? undefined
}

/** 释放一次引用；poster 在无引用且超出闲置上限时淘汰 */
export function releaseVideoAlbumThumb(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  touch(entry)
  evictIdle()
}

export function clearVideoAlbumThumbCache() {
  for (const entry of cache.values()) {
    revokePosterUrl(entry.posterUrl)
  }
  cache.clear()
  inflight.clear()
}

export function getVideoAlbumThumbCacheSize() {
  return cache.size
}
