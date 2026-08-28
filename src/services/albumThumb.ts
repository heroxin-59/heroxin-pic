import { appEnv } from '@/config/env'
import {
  getAccessUrl,
  getObjectBlob,
} from '@/services/fileList'
import {
  clearAlbumMetaCache,
  getCachedAlbumMeta,
  parseAlbumMetaFromBlob,
  type AlbumImageMeta,
} from '@/services/imageMeta'
import { cacheAspectFromBlob, clearAlbumAspectCache } from '@/services/imageAspect'
import { createLimiter } from '@/utils/concurrency'

export type AlbumThumbKind = 'blob' | 'signed'

export interface AlbumThumbResult {
  key: string
  url: string
  kind: AlbumThumbKind
  meta: AlbumImageMeta
}

type CacheEntry = {
  url: string
  kind: AlbumThumbKind
  meta: AlbumImageMeta
  refs: number
  /** signed URL 过期时间戳（ms）；blob 模式无 */
  expiresAt?: number
  lastUsed: number
}

const SIGNED_URL_TTL_SEC = 3600
/** 签名 URL 提前刷新余量 */
const SIGNED_REFRESH_MARGIN_MS = 60_000
const MAX_IDLE_CACHE = 192

const limiter = createLimiter(appEnv.albumThumbConcurrency)
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<AlbumThumbResult>>()

function thumbProcess(): string {
  return appEnv.ossThumbProcess
}

function isUsable(entry: CacheEntry, now = Date.now()): boolean {
  if (entry.kind === 'blob') return Boolean(entry.url)
  if (!entry.expiresAt) return false
  return entry.expiresAt - SIGNED_REFRESH_MARGIN_MS > now
}

function touch(entry: CacheEntry) {
  entry.lastUsed = Date.now()
}

function toResult(key: string, entry: CacheEntry): AlbumThumbResult {
  return {
    key,
    url: entry.url,
    kind: entry.kind,
    meta: entry.meta,
  }
}

function revokeBlobUrl(entry: CacheEntry) {
  if (entry.kind === 'blob' && entry.url) {
    URL.revokeObjectURL(entry.url)
  }
}

function storeEntry(key: string, entry: CacheEntry) {
  const old = cache.get(key)
  if (old) {
    entry.refs = old.refs
    // 仍有引用时不要立刻 revoke，避免 img 还在用旧 Object URL
    if (old.kind === 'blob' && old.url !== entry.url && old.refs <= 0) {
      revokeBlobUrl(old)
    }
  }
  cache.set(key, entry)
}

/** 淘汰无引用的旧缓存，控制内存 */
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
    revokeBlobUrl(item.entry)
    cache.delete(item.key)
  }
}

async function loadViaBlob(key: string): Promise<AlbumThumbResult> {
  const blob = await getObjectBlob(key)
  const [meta] = await Promise.all([
    parseAlbumMetaFromBlob(key, blob),
    cacheAspectFromBlob(key, blob),
  ])
  const url = URL.createObjectURL(blob)
  const entry: CacheEntry = {
    url,
    kind: 'blob',
    meta,
    refs: 0,
    lastUsed: Date.now(),
  }
  storeEntry(key, entry)
  return toResult(key, entry)
}

async function loadViaSignedProcess(key: string): Promise<AlbumThumbResult> {
  const process = thumbProcess()
  const cachedMeta = getCachedAlbumMeta(key)

  const [url, meta] = await Promise.all([
    getAccessUrl(key, { expires: SIGNED_URL_TTL_SEC, process }),
    cachedMeta
      ? Promise.resolve(cachedMeta)
      : getObjectBlob(key).then(async (blob) => {
          void cacheAspectFromBlob(key, blob)
          return parseAlbumMetaFromBlob(key, blob)
        }),
  ])

  const entry: CacheEntry = {
    url,
    kind: 'signed',
    meta,
    refs: 0,
    expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
    lastUsed: Date.now(),
  }
  storeEntry(key, entry)
  return toResult(key, entry)
}

async function loadFresh(key: string): Promise<AlbumThumbResult> {
  return limiter.run(async () => {
    if (thumbProcess()) {
      try {
        return await loadViaSignedProcess(key)
      } catch {
        // 图片处理未开通 / 签名失败时回退原图 Blob
        return loadViaBlob(key)
      }
    }
    return loadViaBlob(key)
  })
}

/**
 * 获取相册缩略图 URL + EXIF 元数据（带并发限流与内存缓存）。
 * 组件挂载成功后须成对调用 `releaseAlbumThumb`。
 */
export async function acquireAlbumThumb(
  key: string,
  options?: { force?: boolean },
): Promise<AlbumThumbResult> {
  const force = Boolean(options?.force)
  const existing = cache.get(key)

  if (!force && existing && isUsable(existing)) {
    existing.refs += 1
    touch(existing)
    return toResult(key, existing)
  }

  // Blob Object URL 不会过期；force 主要用于刷新签名 URL
  if (force && existing?.kind === 'blob' && isUsable(existing)) {
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

/** 释放一次引用；无引用且超出闲置上限时淘汰 Object URL */
export function releaseAlbumThumb(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  touch(entry)
  evictIdle()
}

/** 读取已缓存缩略图（不增加引用；用于切页后即时展示，须再 acquire） */
export function peekAlbumThumb(key: string): AlbumThumbResult | null {
  const entry = cache.get(key)
  if (!entry || !isUsable(entry)) return null
  touch(entry)
  return toResult(key, entry)
}

/** 缩略图解码失败时淘汰缓存，便于强制走 blob 重载 */
export function invalidateAlbumThumb(key: string) {
  const entry = cache.get(key)
  if (!entry) return
  revokeBlobUrl(entry)
  cache.delete(key)
  inflight.delete(key)
}

export function clearAlbumThumbCache() {
  for (const entry of cache.values()) {
    revokeBlobUrl(entry)
  }
  cache.clear()
  inflight.clear()
  clearAlbumMetaCache()
  clearAlbumAspectCache()
}

export function getAlbumThumbCacheSize() {
  return cache.size
}
