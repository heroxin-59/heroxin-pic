import { describe, expect, it } from 'vitest'
import { listDirectoryFromFullList, removeFullListRecordById, upsertFullListRecord } from './fileListCache'
import type { FileRecord } from '@/types/file'

function record(key: string, uploadedAt: string): FileRecord {
  return {
    id: key,
    key,
    name: key.split('/').pop() || key,
    size: 1,
    url: '',
    uploadedAt,
    mimeType: 'image/jpeg',
    extension: 'jpg',
    category: 'image',
  }
}

describe('listDirectoryFromFullList', () => {
  const root = 'uploads/'
  const all = [
    record('uploads/2026/08/11/a.jpg', '2026-08-11T09:00:00.000Z'),
    record('uploads/2026/08/25/b.jpg', '2026-08-25T11:00:00.000Z'),
    record('uploads/2021/12/17/c.jpg', '2021-12-17T08:00:00.000Z'),
  ]

  it('lists folders and direct files at root', () => {
    const result = listDirectoryFromFullList(all, root, root)
    expect(result.prefix).toBe('uploads/')
    expect(result.folders.map((item) => item.prefix).sort()).toEqual([
      'uploads/2021/',
      'uploads/2026/',
    ])
    expect(result.records).toHaveLength(0)
  })

  it('lists files under a date folder', () => {
    const result = listDirectoryFromFullList(all, 'uploads/2026/08/', root)
    expect(result.folders.map((item) => item.name)).toEqual(['11/', '25/'])
    expect(result.records).toHaveLength(0)
  })

  it('lists direct files in a leaf folder', () => {
    const result = listDirectoryFromFullList(all, 'uploads/2026/08/25/', root)
    expect(result.folders).toHaveLength(0)
    expect(result.records.map((item) => item.key)).toEqual(['uploads/2026/08/25/b.jpg'])
  })
})

describe('upsertFullListRecord', () => {
  it('prepends and dedupes by key', () => {
    const base = [record('a.jpg', '2026-01-01T00:00:00.000Z')]
    const next = upsertFullListRecord(base, record('b.jpg', '2026-02-01T00:00:00.000Z'))
    expect(next.map((item) => item.key)).toEqual(['b.jpg', 'a.jpg'])
  })
})

describe('removeFullListRecordById', () => {
  it('removes by id', () => {
    const base = [record('a.jpg', '2026-01-01T00:00:00.000Z')]
    expect(removeFullListRecordById(base, 'a.jpg')).toHaveLength(0)
  })
})
