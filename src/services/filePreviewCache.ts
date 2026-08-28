import { getAccessUrl, getObjectBlob } from '@/services/fileList'
import type { TextPreviewResult } from '@/services/text'

const SIGNED_URL_TTL_SEC = 3600
const SIGNED_REFRESH_MARGIN_MS = 60_000
const MAX_IDLE_SIGNED = 48
const MAX_IDLE_BLOB_ENTRIES = 24
const MAX_IDLE_BLOB_BYTES = 80 * 1024 * 1024
const MAX_IDLE_TEXT = 32

type SignedEntry = {
  url: string
  refs: number
  expiresAt: number
  lastUsed: number
}

type BlobEntry = {
  blob: Blob
  objectUrl: string | null
  refs: number
  lastUsed: number
}

type TextEntry = {
  result: TextPreviewResult
  extension: string
  refs: number
  lastUsed: number
}

const signedCache = new Map<string, SignedEntry>()
const blobCache = new Map<string, BlobEntry>()
const textCache = new Map<string, TextEntry>()
const signedInflight = new Map<string, Promise<string>>()
const blobInflight = new Map<string, Promise<Blob>>()

function touchSigned(entry: SignedEntry) {
  entry.lastUsed = Date.now()
}

function touchBlob(entry: BlobEntry) {
  entry.lastUsed = Date.now()
}

function touchText(entry: TextEntry) {
  entry.lastUsed = Date.now()
}

function isSignedUsable(entry: SignedEntry, now = Date.now()): boolean {
  return entry.expiresAt - SIGNED_REFRESH_MARGIN_MS > now
}

function revokeBlobObjectUrl(entry: BlobEntry) {
  if (entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl)
    entry.objectUrl = null
  }
}

function totalBlobBytes(): number {
  let total = 0
  for (const entry of blobCache.values()) {
    total += entry.blob.size
  }
  return total
}

function evictIdleSigned() {
  const idle: Array<{ key: string; entry: SignedEntry }> = []
  for (const [key, entry] of signedCache) {
    if (entry.refs <= 0) idle.push({ key, entry })
  }
  if (idle.length <= MAX_IDLE_SIGNED) return
  idle.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed)
  const overflow = idle.length - MAX_IDLE_SIGNED
  for (let i = 0; i < overflow; i += 1) {
    const item = idle[i]
    if (!item) continue
    signedCache.delete(item.key)
  }
}

function evictIdleBlobs() {
  const idle: Array<{ key: string; entry: BlobEntry }> = []
  for (const [key, entry] of blobCache) {
    if (entry.refs <= 0) idle.push({ key, entry })
  }

  const overCount = idle.length > MAX_IDLE_BLOB_ENTRIES
  const overBytes = totalBlobBytes() > MAX_IDLE_BLOB_BYTES
  if (!overCount && !overBytes) return

  idle.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed)
  for (const item of idle) {
    if (idle.length <= MAX_IDLE_BLOB_ENTRIES && totalBlobBytes() <= MAX_IDLE_BLOB_BYTES) break
    revokeBlobObjectUrl(item.entry)
    blobCache.delete(item.key)
    const idx = idle.findIndex((x) => x.key === item.key)
    if (idx >= 0) idle.splice(idx, 1)
  }
}

function evictIdleText() {
  const idle: Array<{ key: string; entry: TextEntry }> = []
  for (const [key, entry] of textCache) {
    if (entry.refs <= 0) idle.push({ key, entry })
  }
  if (idle.length <= MAX_IDLE_TEXT) return
  idle.sort((a, b) => a.entry.lastUsed - b.entry.lastUsed)
  const overflow = idle.length - MAX_IDLE_TEXT
  for (let i = 0; i < overflow; i += 1) {
    const item = idle[i]
    if (!item) continue
    textCache.delete(item.key)
  }
}

async function loadSignedUrl(key: string): Promise<string> {
  let pending = signedInflight.get(key)
  if (!pending) {
    pending = getAccessUrl(key, { expires: SIGNED_URL_TTL_SEC }).finally(() => {
      if (signedInflight.get(key) === pending) signedInflight.delete(key)
    })
    signedInflight.set(key, pending)
  }
  const url = await pending
  const old = signedCache.get(key)
  signedCache.set(key, {
    url,
    refs: old?.refs ?? 0,
    expiresAt: Date.now() + SIGNED_URL_TTL_SEC * 1000,
    lastUsed: Date.now(),
  })
  return url
}

async function loadBlob(key: string): Promise<Blob> {
  let pending = blobInflight.get(key)
  if (!pending) {
    pending = getObjectBlob(key).finally(() => {
      if (blobInflight.get(key) === pending) blobInflight.delete(key)
    })
    blobInflight.set(key, pending)
  }
  const blob = await pending
  const old = blobCache.get(key)
  blobCache.set(key, {
    blob,
    objectUrl: old?.objectUrl ?? null,
    refs: old?.refs ?? 0,
    lastUsed: Date.now(),
  })
  return blob
}

/**
 * 获取预览用签名 URL（视频直链等）。须成对调用 `releasePreviewSignedUrl`。
 */
export async function acquirePreviewSignedUrl(
  key: string,
  options?: { force?: boolean },
): Promise<string> {
  const force = Boolean(options?.force)
  const existing = signedCache.get(key)
  if (!force && existing && isSignedUsable(existing)) {
    existing.refs += 1
    touchSigned(existing)
    return existing.url
  }

  const url = await loadSignedUrl(key)
  const entry = signedCache.get(key)
  if (entry) {
    entry.refs += 1
    touchSigned(entry)
    evictIdleSigned()
  }
  return url
}

export function releasePreviewSignedUrl(key: string) {
  const entry = signedCache.get(key)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  touchSigned(entry)
  evictIdleSigned()
}

export function peekPreviewSignedUrl(key: string): string | undefined {
  const entry = signedCache.get(key)
  if (!entry || !isSignedUsable(entry)) return undefined
  return entry.url
}

/**
 * 获取预览用 Blob（PDF / Word / 文本等）。须成对调用 `releasePreviewBlob`。
 */
export async function acquirePreviewBlob(
  key: string,
  options?: { force?: boolean },
): Promise<Blob> {
  const force = Boolean(options?.force)
  const existing = blobCache.get(key)
  if (!force && existing) {
    existing.refs += 1
    touchBlob(existing)
    return existing.blob
  }

  const blob = await loadBlob(key)
  const entry = blobCache.get(key)
  if (entry) {
    entry.refs += 1
    touchBlob(entry)
    evictIdleBlobs()
  }
  return blob
}

export function releasePreviewBlob(key: string) {
  const entry = blobCache.get(key)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  touchBlob(entry)
  evictIdleBlobs()
}

/** 基于缓存 Blob 生成 Object URL（图片预览等） */
export async function acquirePreviewObjectUrl(
  key: string,
  options?: { force?: boolean },
): Promise<string> {
  const force = Boolean(options?.force)
  const existing = blobCache.get(key)
  if (!force && existing?.objectUrl) {
    existing.refs += 1
    touchBlob(existing)
    return existing.objectUrl
  }

  if (!existing || force) {
    await acquirePreviewBlob(key, options)
  } else {
    existing.refs += 1
    touchBlob(existing)
  }

  const entry = blobCache.get(key)
  if (!entry) {
    throw new Error('预览缓存异常')
  }

  if (entry.objectUrl && force) {
    revokeBlobObjectUrl(entry)
  }
  if (!entry.objectUrl) {
    entry.objectUrl = URL.createObjectURL(entry.blob)
  }
  return entry.objectUrl
}

export function releasePreviewObjectUrl(key: string) {
  releasePreviewBlob(key)
}

function textCacheKey(key: string, extension: string): string {
  return `${key}::${extension.toLowerCase()}`
}

export function peekCachedTextPreview(
  key: string,
  extension: string,
): TextPreviewResult | undefined {
  return textCache.get(textCacheKey(key, extension))?.result
}

/** 命中缓存时递增引用并返回结果 */
export function tryAcquireCachedTextPreview(
  key: string,
  extension: string,
): TextPreviewResult | null {
  const cacheKey = textCacheKey(key, extension)
  const entry = textCache.get(cacheKey)
  if (!entry) return null
  entry.refs += 1
  touchText(entry)
  return entry.result
}

/**
 * 缓存解码后的文本预览结果。须成对调用 `releaseCachedTextPreview`。
 */
export function acquireCachedTextPreview(
  key: string,
  extension: string,
  result: TextPreviewResult,
): TextPreviewResult {
  const cacheKey = textCacheKey(key, extension)
  const existing = textCache.get(cacheKey)
  if (existing) {
    existing.refs += 1
    touchText(existing)
    return existing.result
  }
  textCache.set(cacheKey, {
    result,
    extension,
    refs: 1,
    lastUsed: Date.now(),
  })
  evictIdleText()
  return result
}

export function releaseCachedTextPreview(key: string, extension: string) {
  const cacheKey = textCacheKey(key, extension)
  const entry = textCache.get(cacheKey)
  if (!entry) return
  entry.refs = Math.max(0, entry.refs - 1)
  touchText(entry)
  evictIdleText()
}

export function invalidatePreviewCache(key: string) {
  const signed = signedCache.get(key)
  if (signed) signedCache.delete(key)

  const blob = blobCache.get(key)
  if (blob) {
    revokeBlobObjectUrl(blob)
    blobCache.delete(key)
  }

  for (const cacheKey of [...textCache.keys()]) {
    if (cacheKey.startsWith(`${key}::`)) {
      textCache.delete(cacheKey)
    }
  }
}

export function clearPreviewCache() {
  signedCache.clear()
  signedInflight.clear()
  for (const entry of blobCache.values()) {
    revokeBlobObjectUrl(entry)
  }
  blobCache.clear()
  blobInflight.clear()
  textCache.clear()
}

/** @internal 测试用 */
export function getPreviewCacheStats() {
  return {
    signed: signedCache.size,
    blob: blobCache.size,
    text: textCache.size,
    blobBytes: totalBlobBytes(),
  }
}
