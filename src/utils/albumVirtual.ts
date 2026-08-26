import type { AlbumDayGroup } from '@/utils/albumGroup'
import type { FileRecord } from '@/types/file'
import { BREAKPOINTS } from '@/constants/breakpoints'
import { getAlbumAspectOrDefault } from '@/services/imageAspect'

/** 日期头（通栏） */
export interface AlbumVirtualHeaderItem {
  type: 'header'
  key: string
  dateKey: string
  label: string
  locationLabel?: string
  count: number
  /** 相对相册根的 top */
  offset: number
  height: number
  left: number
  width: number
}

/** 瀑布流单张 */
export interface AlbumVirtualTileItem {
  type: 'tile'
  key: string
  dateKey: string
  record: FileRecord
  offset: number
  height: number
  left: number
  width: number
}

export type AlbumVirtualItem = AlbumVirtualHeaderItem | AlbumVirtualTileItem

export interface AlbumVirtualLayout {
  items: AlbumVirtualItem[]
  totalHeight: number
  columns: number
  gap: number
  columnWidth: number
}

const HEADER_HEIGHT = 32
const HEADER_WITH_LOCATION_HEIGHT = 52
const AFTER_HEADER_GAP = 10
const SECTION_GAP = 20

/** 瀑布流列数（比等分方格略少，单列更易看出高低差） */
export function albumColumnCount(viewportWidth: number): number {
  if (viewportWidth >= BREAKPOINTS.lg) return 4
  if (viewportWidth >= BREAKPOINTS.sm) return 3
  return 2
}

export function albumGridGap(viewportWidth: number): number {
  return viewportWidth >= BREAKPOINTS.sm ? 8 : 6
}

function shortestColumnIndex(heights: number[]): number {
  let best = 0
  for (let i = 1; i < heights.length; i += 1) {
    if (heights[i]! < heights[best]!) best = i
  }
  return best
}

/**
 * 按日分组后的瀑布流布局：组内最短列优先放置。
 * `aspectByKey` 可选；缺省读内存缓存，未知时按 1:1。
 */
export function buildAlbumWaterfallLayout(
  groups: AlbumDayGroup[],
  containerWidth: number,
  viewportWidth: number,
  aspectByKey?: Map<string, number> | Record<string, number>,
  collapsedDateKeys?: ReadonlySet<string>,
): AlbumVirtualLayout {
  const columns = albumColumnCount(viewportWidth)
  const gap = albumGridGap(viewportWidth)
  const width = Math.max(0, containerWidth)
  const columnWidth =
    width > 0 ? Math.max(1, (width - gap * Math.max(0, columns - 1)) / columns) : 120

  const items: AlbumVirtualItem[] = []
  let cursorY = 0

  function readAspect(key: string): number {
    if (aspectByKey instanceof Map) {
      const v = aspectByKey.get(key)
      if (v != null && v > 0) return v
    } else if (aspectByKey && typeof aspectByKey[key] === 'number' && aspectByKey[key]! > 0) {
      return aspectByKey[key]!
    }
    return getAlbumAspectOrDefault(key)
  }

  groups.forEach((group, groupIndex) => {
    const headerHeight = group.locationLabel ? HEADER_WITH_LOCATION_HEIGHT : HEADER_HEIGHT
    const collapsed = collapsedDateKeys?.has(group.dateKey) ?? false
    items.push({
      type: 'header',
      key: `h:${group.dateKey}`,
      dateKey: group.dateKey,
      label: group.label,
      locationLabel: group.locationLabel,
      count: group.records.length,
      offset: cursorY,
      height: headerHeight,
      left: 0,
      width,
    })
    cursorY += headerHeight + AFTER_HEADER_GAP

    const colHeights = Array.from({ length: columns }, () => 0)
    const masonryTop = cursorY

    for (const record of collapsed ? [] : group.records) {
      const aspect = readAspect(record.key)
      const tileHeight = Math.max(48, columnWidth / aspect)
      const col = shortestColumnIndex(colHeights)
      const left = col * (columnWidth + gap)
      const topInMasonry = colHeights[col]!
      const top = masonryTop + topInMasonry

      items.push({
        type: 'tile',
        key: `tile:${record.key}`,
        dateKey: group.dateKey,
        record,
        offset: top,
        height: tileHeight,
        left,
        width: columnWidth,
      })

      colHeights[col] = topInMasonry + tileHeight + gap
    }

    const masonryHeight = Math.max(0, ...colHeights)
    // 最后一列多算了一个 gap，去掉
    cursorY = masonryTop + Math.max(0, masonryHeight - (masonryHeight > 0 ? gap : 0))

    if (groupIndex < groups.length - 1) {
      cursorY += SECTION_GAP
    }
  })

  // 按纵向排序，便于虚拟列表二分
  items.sort((a, b) => a.offset - b.offset || a.left - b.left)

  return {
    items,
    totalHeight: cursorY,
    columns,
    gap,
    columnWidth,
  }
}

/** @deprecated 使用 buildAlbumWaterfallLayout */
export function buildAlbumVirtualLayout(
  groups: AlbumDayGroup[],
  containerWidth: number,
  viewportWidth: number,
): AlbumVirtualLayout {
  return buildAlbumWaterfallLayout(groups, containerWidth, viewportWidth)
}

/** 某日日期头在虚拟列表中的 offset；未找到返回 null */
export function findAlbumDateOffset(items: AlbumVirtualItem[], dateKey: string): number | null {
  const header = items.find((item) => item.type === 'header' && item.dateKey === dateKey)
  return header ? header.offset : null
}

export function findVirtualStartIndex(
  rows: Array<{ offset: number; height: number }>,
  top: number,
): number {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const row = rows[mid]!
    if (row.offset + row.height <= top) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function sliceVisibleVirtualRows<T extends { offset: number; height: number }>(
  rows: T[],
  scrollTop: number,
  viewportHeight: number,
  overscan = 3,
): { start: number; end: number; visible: T[] } {
  if (rows.length === 0) {
    return { start: 0, end: 0, visible: [] }
  }
  const top = Math.max(0, scrollTop)
  const bottom = top + Math.max(0, viewportHeight)
  let start = findVirtualStartIndex(rows, top)
  let end = start
  while (end < rows.length && rows[end]!.offset < bottom) {
    end += 1
  }
  start = Math.max(0, start - overscan)
  end = Math.min(rows.length, end + overscan)
  return {
    start,
    end,
    visible: rows.slice(start, end),
  }
}
