import { describe, expect, it } from 'vitest'
import { groupRecordsByDate, groupRecordsByUploadDay } from './albumGroup'
import type { FileRecord } from '@/types/file'

function record(partial: Partial<FileRecord> & Pick<FileRecord, 'key' | 'name'>): FileRecord {
  return {
    id: partial.key,
    size: 1,
    url: '',
    uploadedAt: partial.uploadedAt ?? '2026-08-25T10:00:00.000Z',
    mimeType: 'image/jpeg',
    extension: 'jpg',
    category: 'image',
    ...partial,
  }
}

describe('groupRecordsByUploadDay', () => {
  it('groups by OSS folder date over uploadedAt / EXIF', () => {
    const groups = groupRecordsByUploadDay(
      [
        record({
          key: 'uploads/2026/08/11/微信图片_20260811094738.jpg',
          name: '微信图片_20260811094738.jpg',
          uploadedAt: '2026-08-25T09:00:00.000Z',
        }),
        record({
          key: 'uploads/2026/08/25/Snipaste_2026-08-25.jpeg',
          name: 'Snipaste_2026-08-25.jpeg',
          uploadedAt: '2026-08-25T11:00:00.000Z',
        }),
      ],
      new Map([
        [
          'uploads/2026/08/11/微信图片_20260811094738.jpg',
          { key: 'uploads/2026/08/11/微信图片_20260811094738.jpg', captureAt: '2026-08-25T09:12:00.000Z' },
        ],
      ]),
    )

    expect(groups.map((g) => g.dateKey)).toEqual(['2026-08-25', '2026-08-11'])
    expect(groups.find((g) => g.dateKey === '2026-08-11')?.records).toHaveLength(1)
    expect(groups.find((g) => g.dateKey === '2026-08-25')?.records[0]?.name).toContain('Snipaste')
  })
})

describe('groupRecordsByDate', () => {
  const sampleRecords = [
    record({
      key: 'uploads/2026/08/11/a.jpg',
      name: 'a.jpg',
      uploadedAt: '2026-08-11T09:00:00.000Z',
    }),
    record({
      key: 'uploads/2026/08/25/b.jpg',
      name: 'b.jpg',
      uploadedAt: '2026-08-25T11:00:00.000Z',
    }),
    record({
      key: 'uploads/2021/12/17/c.jpg',
      name: 'c.jpg',
      uploadedAt: '2021-12-17T08:00:00.000Z',
    }),
  ]

  it('month view merges days in the same month', () => {
    const groups = groupRecordsByDate(sampleRecords, undefined, 'month')
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-08', '2021-12'])
    expect(groups.find((g) => g.dateKey === '2026-08')?.label).toBe('2026年8月')
    expect(groups.find((g) => g.dateKey === '2026-08')?.records).toHaveLength(2)
  })

  it('year view merges months in the same year', () => {
    const groups = groupRecordsByDate(sampleRecords, undefined, 'year')
    expect(groups.map((g) => g.dateKey)).toEqual(['2026', '2021'])
    expect(groups.find((g) => g.dateKey === '2026')?.label).toBe('2026年')
    expect(groups.find((g) => g.dateKey === '2026')?.records).toHaveLength(2)
  })
})
