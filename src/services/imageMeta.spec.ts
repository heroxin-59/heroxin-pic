import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const exifrParse = vi.fn()

vi.mock('exifr', () => ({
  default: {
    parse: (...args: unknown[]) => exifrParse(...args),
  },
}))

vi.mock('@/services/fileList', () => ({
  getObjectBlob: vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' })),
}))

describe('imageMeta reverse geocode deferral', () => {
  beforeEach(() => {
    vi.resetModules()
    exifrParse.mockReset()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ locality: '上海', city: '上海市' }),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows coordinate label first and defers fetch until scroll idle', async () => {
    exifrParse.mockResolvedValueOnce({
      latitude: 31.2304,
      longitude: 121.4737,
    })

    const {
      parseAlbumMetaFromBlob,
      subscribeAlbumMetaUpdate,
      flushDeferredGeocodeForTests,
      clearAlbumMetaCache,
    } = await import('@/services/imageMeta')

    clearAlbumMetaCache()
    flushDeferredGeocodeForTests({ scrollIdle: false })

    const updates: string[] = []
    const unsubscribe = subscribeAlbumMetaUpdate((meta) => {
      if (meta.locationLabel) updates.push(meta.locationLabel)
    })

    const meta = await parseAlbumMetaFromBlob('a.jpg', new Blob(['x']))
    expect(meta.locationLabel).toContain('°')
    expect(fetch).not.toHaveBeenCalled()

    flushDeferredGeocodeForTests({ scrollIdle: true })
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(updates.some((label) => label.includes('上海'))).toBe(true)
    })

    unsubscribe()
  })

  it('dedupes reverse geocode by rounded coordinates', async () => {
    exifrParse
      .mockResolvedValueOnce({ latitude: 31.23041, longitude: 121.47371 })
      .mockResolvedValueOnce({ latitude: 31.23043, longitude: 121.47373 })

    const { parseAlbumMetaFromBlob, flushDeferredGeocodeForTests, clearAlbumMetaCache } =
      await import('@/services/imageMeta')

    clearAlbumMetaCache()
    flushDeferredGeocodeForTests({ scrollIdle: false })

    await parseAlbumMetaFromBlob('a.jpg', new Blob(['a']))
    await parseAlbumMetaFromBlob('b.jpg', new Blob(['b']))
    expect(fetch).not.toHaveBeenCalled()

    flushDeferredGeocodeForTests({ scrollIdle: true })
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })
})
