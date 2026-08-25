/** 相册图片宽高比（width / height）缓存 */

const aspectCache = new Map<string, number>()

const DEFAULT_ASPECT = 1
/** 限制极端比例，避免瀑布流单格过高/过扁 */
const MIN_ASPECT = 0.4
const MAX_ASPECT = 2.8

export function clampAlbumAspectRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return DEFAULT_ASPECT
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, ratio))
}

export function getCachedAlbumAspect(key: string): number | undefined {
  return aspectCache.get(key)
}

export function getAlbumAspectOrDefault(key: string): number {
  return aspectCache.get(key) ?? DEFAULT_ASPECT
}

/** 写入缓存；若比例变化超过阈值返回 true（用于触发布局重算） */
export function setAlbumAspect(key: string, ratio: number): boolean {
  const next = clampAlbumAspectRatio(ratio)
  const prev = aspectCache.get(key)
  if (prev != null && Math.abs(prev - next) < 0.01) return false
  aspectCache.set(key, next)
  return prev == null || Math.abs(prev - next) >= 0.01
}

export function clearAlbumAspectCache() {
  aspectCache.clear()
}

/** 从 Blob 读取自然宽高比 */
export async function measureBlobAspectRatio(blob: Blob): Promise<number | undefined> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob)
      const ratio = bitmap.width > 0 && bitmap.height > 0 ? bitmap.width / bitmap.height : undefined
      bitmap.close()
      return ratio
    }
  } catch {
    // fallback below
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const ratio =
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : undefined
      URL.revokeObjectURL(url)
      resolve(ratio)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    }
    img.src = url
  })
}

export async function cacheAspectFromBlob(key: string, blob: Blob): Promise<number | undefined> {
  const existing = aspectCache.get(key)
  if (existing != null) return existing
  const ratio = await measureBlobAspectRatio(blob)
  if (ratio != null) setAlbumAspect(key, ratio)
  return aspectCache.get(key)
}
