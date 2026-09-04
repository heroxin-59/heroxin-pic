import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/types/error'

const getAccessUrl = vi.fn(async (key: string, options?: { process?: string }) => {
  const process = options?.process ? `&process=${options.process}` : ''
  return `https://example.com/${key}?sig=1${process}`
})
const getObjectBlob = vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' }))

vi.mock('@/services/fileList', () => ({
  getAccessUrl: (key: string, options?: { process?: string }) => getAccessUrl(key, options),
  getObjectBlob: (key: string, options?: { signal?: AbortSignal }) => getObjectBlob(key, options),
}))

vi.mock('@/services/imageMeta', () => ({
  clearAlbumMetaCache: vi.fn(),
  getCachedAlbumMeta: vi.fn(() => undefined),
  parseAlbumMetaFromBlob: vi.fn(async (key: string) => ({ key, captureAt: '2026-01-01T00:00:00.000Z' })),
}))

vi.mock('@/services/imageAspect', () => ({
  cacheAspectFromBlob: vi.fn(async () => undefined),
  clearAlbumAspectCache: vi.fn(),
}))

describe('albumThumb P0', () => {
  beforeEach(() => {
    vi.resetModules()
    getAccessUrl.mockClear()
    getObjectBlob.mockClear()
    vi.stubEnv('VITE_OSS_THUMB_PROCESS', 'image/resize,m_lfit,w_480/quality,q_80')
    vi.stubEnv('VITE_ALBUM_THUMB_CONCURRENCY', '4')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses signed process URL without pulling original blob for thumb display', async () => {
    const { acquireAlbumThumb, clearAlbumThumbCache, releaseAlbumThumb } = await import('@/services/albumThumb')

    clearAlbumThumbCache()
    const result = await acquireAlbumThumb('uploads/2026/01/01/a.jpg')

    expect(result.kind).toBe('signed')
    expect(result.url).toContain('process=image')
    expect(getAccessUrl).toHaveBeenCalledTimes(1)
    expect(getObjectBlob).not.toHaveBeenCalled()

    releaseAlbumThumb('uploads/2026/01/01/a.jpg')
  })

  it('ensureAlbumThumbMeta loads original blob separately', async () => {
    const { ensureAlbumThumbMeta, clearAlbumThumbCache } = await import('@/services/albumThumb')

    clearAlbumThumbCache()
    const meta = await ensureAlbumThumbMeta('uploads/2026/01/01/a.jpg')

    expect(meta.key).toBe('uploads/2026/01/01/a.jpg')
    expect(getObjectBlob).toHaveBeenCalledTimes(1)
  })

  it('aborts acquire when signal fires during thumb load', async () => {
    getAccessUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('https://example.com/k?sig=1&process=image'), 30)
        }),
    )

    const { acquireAlbumThumb, clearAlbumThumbCache } = await import('@/services/albumThumb')
    clearAlbumThumbCache()

    const controller = new AbortController()
    const pending = acquireAlbumThumb('uploads/k.jpg', { signal: controller.signal })
    controller.abort()

    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
  })
})

describe('isAbortError', () => {
  it('detects AppError CANCELLED and AbortError', async () => {
    const { isAbortError } = await import('@/utils/error')
    expect(isAbortError(new AppError('CANCELLED', '操作已取消。'))).toBe(true)
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true)
    expect(isAbortError(new Error('fail'))).toBe(false)
  })
})
