import type { FileRecord } from '@/types/file'
import type { AlbumImageMeta } from '@/services/imageMeta'
import { parseArchiveDateFromObjectKey } from '@/utils/archiveDate'

export type AlbumGroupGranularity = 'day' | 'month' | 'year'

/** 相册按日期分组（日 / 月 / 年视图共用） */
export interface AlbumDayGroup {
  /** 分组键：日 YYYY-MM-DD；月 YYYY-MM；年 YYYY */
  dateKey: string
  /** 展示标题 */
  label: string
  /** 组内代表性地点（有则展示） */
  locationLabel?: string
  records: FileRecord[]
}

export type AlbumMetaMap = Map<string, AlbumImageMeta> | Record<string, AlbumImageMeta>

function toDateParts(iso: string): { y: number; m: number; d: number; key: string } | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { y, m, d, key }
}

export function formatAlbumDateLabel(y: number, m: number, d: number): string {
  return `${y}年${m}月${d}日`
}

export function formatAlbumMonthLabel(y: number, m: number): string {
  return `${y}年${m}月`
}

export function formatAlbumYearLabel(y: number): string {
  return `${y}年`
}

export function getAlbumJumpPlaceholder(granularity: AlbumGroupGranularity): string {
  if (granularity === 'year') return '定位到某年'
  if (granularity === 'month') return '定位到某月'
  return '定位到某日'
}

export function getAlbumSelectGroupLabel(granularity: AlbumGroupGranularity): string {
  if (granularity === 'year') return '选当年'
  if (granularity === 'month') return '选当月'
  return '选当日'
}

function buildGroupKeyAndLabel(
  parts: { y: number; m: number; d: number; key: string },
  granularity: AlbumGroupGranularity,
): { key: string; label: string } {
  if (granularity === 'year') {
    return { key: String(parts.y), label: formatAlbumYearLabel(parts.y) }
  }
  if (granularity === 'month') {
    const key = `${parts.y}-${String(parts.m).padStart(2, '0')}`
    return { key, label: formatAlbumMonthLabel(parts.y, parts.m) }
  }
  return { key: parts.key, label: formatAlbumDateLabel(parts.y, parts.m, parts.d) }
}

function readMeta(map: AlbumMetaMap | undefined, key: string): AlbumImageMeta | undefined {
  if (!map) return undefined
  if (map instanceof Map) return map.get(key)
  return map[key]
}

/**
 * 组内排序用时间：优先 EXIF 拍摄时间，否则 uploadedAt。
 * （不影响日期标题分组键）
 */
export function getAlbumSortTime(record: FileRecord, meta?: AlbumImageMeta): string {
  return meta?.captureAt || record.uploadedAt
}

/**
 * 相册日期标题用：优先 Object Key 中的归档目录日 `yyyy/MM/dd`，
 * 再 EXIF 拍摄日，再上传日。
 */
export function getAlbumGroupDateParts(
  record: FileRecord,
  meta?: AlbumImageMeta,
): { y: number; m: number; d: number; key: string } | null {
  const fromKey = parseArchiveDateFromObjectKey(record.key)
  if (fromKey) {
    return {
      y: fromKey.year,
      m: fromKey.month,
      d: fromKey.day,
      key: `${fromKey.year}-${String(fromKey.month).padStart(2, '0')}-${String(fromKey.day).padStart(2, '0')}`,
    }
  }
  return toDateParts(getAlbumSortTime(record, meta))
}

function pickGroupLocation(items: FileRecord[], metaMap?: AlbumMetaMap): string | undefined {
  const counts = new Map<string, number>()
  for (const item of items) {
    const label = readMeta(metaMap, item.key)?.locationLabel?.trim()
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  let best: string | undefined
  let bestCount = 0
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  }
  return best
}

/**
 * 将图片记录按日期分组（日 / 月 / 年）。
 * 日期标题：优先 OSS 归档目录日 → EXIF → 上传日；组内仍按拍摄/上传时间新→旧。
 */
export function groupRecordsByDate(
  records: FileRecord[],
  metaMap?: AlbumMetaMap,
  granularity: AlbumGroupGranularity = 'day',
): AlbumDayGroup[] {
  const map = new Map<string, { label: string; items: FileRecord[] }>()

  for (const record of records) {
    const meta = readMeta(metaMap, record.key)
    const parts = getAlbumGroupDateParts(record, meta)
    const { key, label } = parts
      ? buildGroupKeyAndLabel(parts, granularity)
      : { key: 'unknown', label: '未知日期' }

    const bucket = map.get(key)
    if (bucket) {
      bucket.items.push(record)
    } else {
      map.set(key, { label, items: [record] })
    }
  }

  const groups: AlbumDayGroup[] = [...map.entries()].map(([dateKey, value]) => ({
    dateKey,
    label: value.label,
    locationLabel: pickGroupLocation(value.items, metaMap),
    records: [...value.items].sort((a, b) => {
      const ta = Date.parse(getAlbumSortTime(a, readMeta(metaMap, a.key)))
      const tb = Date.parse(getAlbumSortTime(b, readMeta(metaMap, b.key)))
      return tb - ta
    }),
  }))

  groups.sort((a, b) => {
    if (a.dateKey === 'unknown') return 1
    if (b.dateKey === 'unknown') return -1
    return b.dateKey.localeCompare(a.dateKey)
  })

  return groups
}

/**
 * 将图片记录按日分组。
 * @deprecated 使用 {@link groupRecordsByDate} 并传入 `granularity: 'day'`
 */
export function groupRecordsByUploadDay(
  records: FileRecord[],
  metaMap?: AlbumMetaMap,
): AlbumDayGroup[] {
  return groupRecordsByDate(records, metaMap, 'day')
}
