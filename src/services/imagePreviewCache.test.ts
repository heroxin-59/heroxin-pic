import { describe, expect, it, vi } from 'vitest'
import {
  getCachedPreviewSlide,
  invalidatePreviewSlide,
  isPreviewSlideReady,
  resolvePreviewSlide,
} from '@/services/imagePreviewCache'
import type { FileRecord } from '@/types/file'

vi.mock('@/services/fileList', () => ({
  getAccessUrl: vi.fn(async (key: string) => `https://example.com/${key}?sig=1`),
}))

vi.mock('@/services/imageAspect', () => ({
  getAlbumAspectOrDefault: () => 1,
  getCachedAlbumAspect: () => 1,
}))

const record: FileRecord = {
  id: '1',
  key: 'file/photo.jpg',
  name: 'photo.jpg',
  extension: 'jpg',
  category: 'image',
  size: 1024,
  uploadedAt: '2026-01-01T00:00:00.000Z',
}

describe('imagePreviewCache', () => {
  it('caches resolved slide for repeat preview', async () => {
    invalidatePreviewSlide(record.key)

    const first = await resolvePreviewSlide(record, true)
    expect(first.src).toContain('photo.jpg')
    expect(isPreviewSlideReady(record.key)).toBe(true)

    const second = await resolvePreviewSlide(record, true)
    expect(second).toBe(first)
    expect(getCachedPreviewSlide(record.key)).toBe(first)
  })

  it('invalidates a single slide', async () => {
    await resolvePreviewSlide(record, true)
    expect(isPreviewSlideReady(record.key)).toBe(true)

    invalidatePreviewSlide(record.key)
    expect(getCachedPreviewSlide(record.key)).toBeUndefined()
  })
})
