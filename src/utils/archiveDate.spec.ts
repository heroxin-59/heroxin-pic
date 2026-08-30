import { describe, expect, it } from 'vitest'
import {
  formatArchiveDatePath,
  isValidArchiveCalendarDate,
  parseArchiveDateFromObjectKey,
  parseDateFromFilename,
  resolveArchiveDateParts,
  shouldUseContentArchiveDate,
} from './archiveDate'
import { buildObjectKey } from './objectKey'

const now = new Date(2026, 7, 25) // 2026-08-25 local

describe('shouldUseContentArchiveDate (3.12.1)', () => {
  it('accepts image extensions from catalog', () => {
    expect(shouldUseContentArchiveDate('a.jpg')).toBe(true)
    expect(shouldUseContentArchiveDate('a.JPEG')).toBe(true)
    expect(shouldUseContentArchiveDate('x/y/z.png')).toBe(true)
  })

  it('rejects non-image types', () => {
    expect(shouldUseContentArchiveDate('a.pdf')).toBe(false)
    expect(shouldUseContentArchiveDate('a.docx')).toBe(false)
    expect(shouldUseContentArchiveDate('a.txt')).toBe(false)
  })
})

describe('parseDateFromFilename (3.12.3)', () => {
  const cases: Array<[string, string | null]> = [
    ['IMG_20260315_120001.jpg', '2026/03/15'],
    ['photo-2026-03-15.jpg', '2026/03/15'],
    ['截图2026年3月15日.png', '2026/03/15'],
    ['2026_03_15_vacation.webp', '2026/03/15'],
    ['2026.03.15.gif', '2026/03/15'],
    ['shot-20260315120001.jpg', '2026/03/15'],
    ['2026-03-15_12-30-00.jpeg', '2026/03/15'],
    ['2026年03月15日-笔记.png', '2026/03/15'],
    // 扩展格式
    ['vacation 2026 03 15.jpg', '2026/03/15'],
    ['DSC_2026-03-15T12:30:00.jpg', '2026/03/15'],
    ['party_15-03-2026.jpg', '2026/03/15'],
    ['15/03/2026_scan.png', '2026/03/15'],
    ['15 03 2026 notes.jpg', '2026/03/15'],
    ['us_03-15-2026.jpg', '2026/03/15'],
    ['15032026.jpg', '2026/03/15'],
    ['03152026.jpg', '2026/03/15'],
    ['2026.03.15.12.30.00.jpg', '2026/03/15'],
    ['20260315 120001.jpg', '2026/03/15'],
    ['2024050116543345.jpg', '2024/05/01'],
    ['20230226201848458.jpg', '2023/02/26'],
    ['15-03-2026_120001.jpg', '2026/03/15'],
    ['no-date.png', null],
    ['report.pdf', null],
    ['IMG_20991231.jpg', null], // future
    ['photo-1990-01-01.jpg', '1990/01/01'],
    ['bad-2026-02-30.jpg', null],
  ]

  it.each(cases)('%s → %s', (name, expectPath) => {
    const parts = parseDateFromFilename(name, now)
    expect(parts ? formatArchiveDatePath(parts) : null).toBe(expectPath)
  })

  it('parses 17-digit compact datetime (YYYYMMDDHHmmss + milliseconds)', () => {
    expect(parseDateFromFilename('20230226201848458.jpg', now)).toEqual({
      year: 2023,
      month: 2,
      day: 26,
    })
    expect(parseDateFromFilename('IMG_20230226201848458.jpg', now)).toEqual({
      year: 2023,
      month: 2,
      day: 26,
    })
  })

  it('parses 16-digit compact datetime (YYYYMMDDHHmmss + suffix)', () => {
    expect(parseDateFromFilename('2024050116543345.jpg', now)).toEqual({
      year: 2024,
      month: 5,
      day: 1,
    })
    expect(parseDateFromFilename('IMG_2024050116543345.jpg', now)).toEqual({
      year: 2024,
      month: 5,
      day: 1,
    })
  })

  it('parses unix millisecond timestamps in filename', () => {
    const local = new Date(2024, 4, 6, 12, 0, 0)
    const name = `mmexport${local.getTime()}.jpg`
    const parts = parseDateFromFilename(name, now)
    expect(parts).toEqual({ year: 2024, month: 5, day: 6 })
  })

  it('parses unix second timestamps in filename', () => {
    const local = new Date(2023, 0, 15, 8, 30, 0)
    const sec = Math.floor(local.getTime() / 1000)
    const parts = parseDateFromFilename(`photo_${sec}.png`, now)
    expect(parts).toEqual({ year: 2023, month: 1, day: 15 })
  })

  it('parses millisecond timestamp with sequence suffix (WeChat-style)', () => {
    const local = new Date(2026, 6, 28, 15, 2, 39)
    const ms = local.getTime()
    expect(parseDateFromFilename(`${ms}_616.jpg`, now)).toEqual({
      year: 2026,
      month: 7,
      day: 28,
    })
    expect(parseDateFromFilename(`1785202559418_616.jpg`, now)).toEqual({
      year: 2026,
      month: 7,
      day: 28,
    })
    expect(parseDateFromFilename(`IMG_${ms}_616.png`, now)).toEqual({
      year: 2026,
      month: 7,
      day: 28,
    })
    expect(parseDateFromFilename('Video_1785202559418_616.mp4', now)).toEqual({
      year: 2026,
      month: 7,
      day: 28,
    })
  })

  it('parses unix second timestamp with sequence suffix', () => {
    const local = new Date(2023, 0, 15, 8, 30, 0)
    const sec = Math.floor(local.getTime() / 1000)
    const parts = parseDateFromFilename(`${sec}_616.jpg`, now)
    expect(parts).toEqual({ year: 2023, month: 1, day: 15 })
  })

  it('prefers calendar compact date over unix timestamp patterns', () => {
    const parts = parseDateFromFilename('微信图片_20260811094736_18_2.jpg', now)
    expect(parts).toEqual({ year: 2026, month: 8, day: 11 })
  })

  it('parses slash dates in filename (not OSS path)', () => {
    expect(parseDateFromFilename('2026/03/15.jpg', now)).toEqual({
      year: 2026,
      month: 3,
      day: 15,
    })
  })

  it('ignores date segments in OSS-style path when basename has no date', () => {
    expect(parseDateFromFilename('uploads/2026/03/15/cover.jpg', now)).toBeNull()
  })
})
describe('isValidArchiveCalendarDate (3.12.7)', () => {
  it('rejects future dates and invalid calendar days', () => {
    expect(isValidArchiveCalendarDate({ year: 2026, month: 8, day: 25 }, now)).toBe(true)
    expect(isValidArchiveCalendarDate({ year: 2026, month: 8, day: 26 }, now)).toBe(false)
    expect(isValidArchiveCalendarDate({ year: 1989, month: 12, day: 31 }, now)).toBe(false)
    expect(isValidArchiveCalendarDate({ year: 2026, month: 2, day: 30 }, now)).toBe(false)
  })
})

describe('resolveArchiveDateParts priority (3.12.2)', () => {
  it('uses filename over exif when both present', () => {
    const result = resolveArchiveDateParts({
      filename: 'IMG_20260315.jpg',
      exifParts: { year: 2020, month: 1, day: 1 },
      now,
    })
    expect(result.source).toBe('filename')
    expect(result.path).toBe('2026/03/15')
  })

  it('uses exif when filename has no date', () => {
    const result = resolveArchiveDateParts({
      filename: 'vacation.jpg',
      exifParts: { year: 2024, month: 5, day: 6 },
      now,
    })
    expect(result.source).toBe('exif')
    expect(result.path).toBe('2024/05/06')
  })

  it('falls back to upload day', () => {
    const result = resolveArchiveDateParts({
      filename: 'vacation.jpg',
      now,
    })
    expect(result.source).toBe('upload')
    expect(result.path).toBe('2026/08/25')
  })

  it('non-image always uses upload day', () => {
    const result = resolveArchiveDateParts({
      filename: 'a.pdf',
      exifParts: { year: 2020, month: 1, day: 1 },
      now,
    })
    expect(result.source).toBe('upload')
    expect(result.path).toBe('2026/08/25')
  })
})

describe('parseArchiveDateFromObjectKey (album folder date)', () => {
  it('reads yyyy/MM/dd from object key', () => {
    expect(parseArchiveDateFromObjectKey('uploads/2026/08/11/微信图片_x.jpg')).toEqual({
      year: 2026,
      month: 8,
      day: 11,
    })
    expect(parseArchiveDateFromObjectKey('uploads/2026/08/25/a.jpg')?.day).toBe(25)
    expect(parseArchiveDateFromObjectKey('no-date/file.jpg')).toBeNull()
  })
})

describe('buildObjectKey archiveDatePath (3.12.5)', () => {
  it('places file under provided archive path', () => {
    const key = buildObjectKey({
      filename: 'a.jpg',
      dir: 'uploads/',
      strategy: 'overwrite',
      archiveDatePath: '2026/03/15',
    })
    expect(key).toBe('uploads/2026/03/15/a.jpg')
  })

  it('ignores invalid archive path and uses today', () => {
    const key = buildObjectKey({
      filename: 'a.jpg',
      dir: 'uploads/',
      strategy: 'overwrite',
      archiveDatePath: 'not-a-date',
    })
    expect(key).toMatch(/^uploads\/\d{4}\/\d{2}\/\d{2}\/a\.jpg$/)
  })
})
