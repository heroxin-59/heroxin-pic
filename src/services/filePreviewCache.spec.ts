import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  acquirePreviewSignedUrl,
  clearPreviewCache,
  getPreviewCacheStats,
  peekPreviewSignedUrl,
  releasePreviewSignedUrl,
} from './filePreviewCache'

const getAccessUrl = vi.fn(async (key: string) => `https://example.com/${key}?sig=1`)

vi.mock('@/services/fileList', () => ({
  getAccessUrl: (key: string) => getAccessUrl(key),
  getObjectBlob: vi.fn(),
}))

describe('filePreviewCache', () => {
  beforeEach(() => {
    clearPreviewCache()
    getAccessUrl.mockClear()
  })

  it('caches signed URL for repeat acquire', async () => {
    const first = await acquirePreviewSignedUrl('file/a.mp4')
    releasePreviewSignedUrl('file/a.mp4')

    expect(getAccessUrl).toHaveBeenCalledTimes(1)

    const second = await acquirePreviewSignedUrl('file/a.mp4')
    expect(second).toBe(first)
    expect(getAccessUrl).toHaveBeenCalledTimes(1)
    expect(peekPreviewSignedUrl('file/a.mp4')).toBe(first)

    releasePreviewSignedUrl('file/a.mp4')
  })

  it('force refresh bypasses cache', async () => {
    await acquirePreviewSignedUrl('file/a.mp4')
    releasePreviewSignedUrl('file/a.mp4')

    await acquirePreviewSignedUrl('file/a.mp4', { force: true })
    expect(getAccessUrl).toHaveBeenCalledTimes(2)
    releasePreviewSignedUrl('file/a.mp4')
  })

  it('clearPreviewCache resets state', async () => {
    await acquirePreviewSignedUrl('file/a.mp4')
    releasePreviewSignedUrl('file/a.mp4')
    clearPreviewCache()
    expect(getPreviewCacheStats().signed).toBe(0)
  })
})
