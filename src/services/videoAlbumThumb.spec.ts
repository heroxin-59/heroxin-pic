import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquireVideoAlbumThumb,
  clearVideoAlbumThumbCache,
  releaseVideoAlbumThumb,
  setVideoAlbumPoster,
} from './videoAlbumThumb'

const getAccessUrl = vi.fn(async (key: string) => `https://example.com/${key}?sig=1`)

vi.mock('@/services/fileList', () => ({
  getAccessUrl: (key: string) => getAccessUrl(key),
}))

describe('videoAlbumThumb', () => {
  afterEach(() => {
    clearVideoAlbumThumbCache()
    getAccessUrl.mockClear()
  })

  it('caches signed url and poster across acquire/release', async () => {
    await acquireVideoAlbumThumb('videos/a.mp4')
    releaseVideoAlbumThumb('videos/a.mp4')

    setVideoAlbumPoster('videos/a.mp4', 'blob:poster-1')

    expect(getAccessUrl).toHaveBeenCalledTimes(1)

    const second = await acquireVideoAlbumThumb('videos/a.mp4')
    expect(second.posterUrl).toBe('blob:poster-1')
    expect(getAccessUrl).toHaveBeenCalledTimes(1)

    releaseVideoAlbumThumb('videos/a.mp4')
  })

  it('force refresh reloads signed url but keeps poster', async () => {
    await acquireVideoAlbumThumb('videos/a.mp4')
    releaseVideoAlbumThumb('videos/a.mp4')
    setVideoAlbumPoster('videos/a.mp4', 'blob:poster-1')

    await acquireVideoAlbumThumb('videos/a.mp4', { force: true })
    expect(getAccessUrl).toHaveBeenCalledTimes(2)

    releaseVideoAlbumThumb('videos/a.mp4')
  })
})
