import { describe, expect, it } from 'vitest'
import { getPreviewKind } from '@/services/preview'
import type { FileRecord } from '@/types/file'

function record(partial: Partial<FileRecord> & Pick<FileRecord, 'name' | 'extension' | 'category'>): FileRecord {
  return {
    id: partial.key ?? partial.name,
    key: partial.key ?? partial.name,
    url: '',
    size: 1,
    mimeType: 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
    ...partial,
  }
}

describe('getPreviewKind', () => {
  it('detects image / pdf / text / video', () => {
    expect(getPreviewKind(record({ name: 'a.jpg', extension: 'jpg', category: 'image' }))).toBe(
      'image',
    )
    expect(getPreviewKind(record({ name: 'a.pdf', extension: 'pdf', category: 'pdf' }))).toBe('pdf')
    expect(getPreviewKind(record({ name: 'a.txt', extension: 'txt', category: 'text' }))).toBe(
      'text',
    )
    expect(getPreviewKind(record({ name: 'a.mp4', extension: 'mp4', category: 'video' }))).toBe(
      'video',
    )
  })

  it('supports doc and docx for word preview', () => {
    expect(getPreviewKind(record({ name: 'a.docx', extension: 'docx', category: 'word' }))).toBe(
      'word',
    )
    expect(getPreviewKind(record({ name: 'a.doc', extension: 'doc', category: 'word' }))).toBe(
      'word',
    )
  })
})
