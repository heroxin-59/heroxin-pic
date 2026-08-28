import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useImageAlbumQuery } from './useImageAlbumQuery'
import type { FileRecord } from '@/types/file'

function record(partial: Partial<FileRecord> & Pick<FileRecord, 'key' | 'name' | 'category'>): FileRecord {
  return {
    id: partial.key,
    size: 1,
    url: '',
    uploadedAt: '2026-08-25T10:00:00.000Z',
    mimeType: partial.category === 'video' ? 'video/mp4' : 'image/jpeg',
    extension: partial.category === 'video' ? 'mp4' : 'jpg',
    ...partial,
  }
}

describe('useImageAlbumQuery mediaFilter', () => {
  const records = ref<FileRecord[]>([
    record({ key: 'a.jpg', name: 'a.jpg', category: 'image' }),
    record({ key: 'b.mp4', name: 'b.mp4', category: 'video' }),
    record({ key: 'c.pdf', name: 'c.pdf', category: 'pdf' }),
  ])

  it('filters image and video only in albumRecords', () => {
    const { albumRecords } = useImageAlbumQuery(() => records.value)
    expect(albumRecords.value.map((item) => item.key)).toEqual(['a.jpg', 'b.mp4'])
  })

  it('filters by media type', () => {
    const { filteredRecords, mediaFilter } = useImageAlbumQuery(() => records.value)

    mediaFilter.value = 'image'
    expect(filteredRecords.value.map((item) => item.key)).toEqual(['a.jpg'])

    mediaFilter.value = 'video'
    expect(filteredRecords.value.map((item) => item.key)).toEqual(['b.mp4'])

    mediaFilter.value = 'all'
    expect(filteredRecords.value.map((item) => item.key)).toEqual(['a.jpg', 'b.mp4'])
  })
})
