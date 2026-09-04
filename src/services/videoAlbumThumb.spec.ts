import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquireVideoAlbumThumb,
  clearVideoAlbumThumbCache,
  releaseVideoAlbumThumb,
  setVideoAlbumPoster,
} from './videoAlbumThumb'

const getAccessUrl = vi.fn(
  async (key: string, options?: { process?: string }) =>
    `https://example.com/${key}?sig=1${options?.process ? `&process=${options.process}` : ''}`,
)

vi.mock('@/services/fileList', () => ({
  getAccessUrl: (key: string, options?: { process?: string }) => getAccessUrl(key, options),
}))

describe('videoAlbumThumb', () => {
  afterEach(() => {
    clearVideoAlbumThumbCache()
    getAccessUrl.mockClear()
  })

  it('caches signed url and OSS snapshot poster across acquire/release', async () => {
    const first = await acquireVideoAlbumThumb('videos/a.mp4')
    expect(first.posterUrl).toContain('process=video/snapshot')
    releaseVideoAlbumThumb('videos/a.mp4')

    // 播放 URL + 截帧封面
    expect(getAccessUrl).toHaveBeenCalledTimes(2)

    const second = await acquireVideoAlbumThumb('videos/a.mp4')
    expect(second.posterUrl).toContain('process=video/snapshot')
    expect(getAccessUrl).toHaveBeenCalledTimes(2)

    releaseVideoAlbumThumb('videos/a.mp4')
  })

  it('force refresh reloads signed url but keeps poster', async () => {
    await acquireVideoAlbumThumb('videos/a.mp4')
    releaseVideoAlbumThumb('videos/a.mp4')
    setVideoAlbumPoster('videos/a.mp4', 'blob:poster-1')

    const refreshed = await acquireVideoAlbumThumb('videos/a.mp4', { force: true })
    expect(refreshed.posterUrl).toBe('blob:poster-1')
    // force 时仍会签播放 URL；已有 poster 不再请求截帧
    expect(getAccessUrl).toHaveBeenCalledTimes(3)

    releaseVideoAlbumThumb('videos/a.mp4')
  })
})
