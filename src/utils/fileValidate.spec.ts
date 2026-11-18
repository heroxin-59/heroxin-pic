import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** 构造带指定 size 的 File，避免为测大文件真分配内存 */
function makeFile(name: string, sizeBytes: number, type = 'video/mp4'): File {
  const file = new File([new Uint8Array(0)], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

describe('fileValidate video size limit', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_MAX_SIZE_MB', '50')
    vi.stubEnv('VITE_MAX_VIDEO_SIZE_MB', '1024')
    vi.stubEnv('VITE_ALLOWED_EXT', 'jpg,mp4')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses separate limits for image and video', async () => {
    const { filterAllowedFiles } = await import('@/utils/fileValidate')

    const acceptedVideo = filterAllowedFiles([makeFile('clip.mp4', 80 * 1024 * 1024)])
    expect(acceptedVideo.rejected).toHaveLength(0)

    const rejectedVideo = filterAllowedFiles([makeFile('big.mp4', 1100 * 1024 * 1024)])
    expect(rejectedVideo.accepted).toHaveLength(0)
    expect(rejectedVideo.rejected[0]?.code).toBe('FILE_SIZE')

    const rejectedImage = filterAllowedFiles([
      makeFile('big.jpg', 60 * 1024 * 1024, 'image/jpeg'),
    ])
    expect(rejectedImage.accepted).toHaveLength(0)
    expect(rejectedImage.rejected[0]?.code).toBe('FILE_SIZE')
  })
})
