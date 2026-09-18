import type { AlbumDayGroup } from '@/utils/albumGroup'
import type { FileRecord } from '@/types/file'
import { BREAKPOINTS } from '@/constants/breakpoints'
import { getAlbumAspectOrDefault, getCachedAlbumAspect } from '@/services/imageAspect'

/** 日期头（通栏 · 瀑布流模式） */
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

/** 时间脊：左侧日期栏，高度覆盖整段当日区块 */
export interface AlbumVirtualSpineItem {
  type: 'spine'
  key: string
  dateKey: string
  label: string
  locationLabel?: string
  count: number
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

export type AlbumVirtualItem = AlbumVirtualHeaderItem | AlbumVirtualSpineItem | AlbumVirtualTileItem

export interface AlbumVirtualLayout {
  items: AlbumVirtualItem[]
  totalHeight: number
  columns: number
  gap: number
  columnWidth: number
}

/** 天空口袋 · 瀑布流：日期头更醒目，组间断层更大 */
const HEADER_HEIGHT = 48
const HEADER_WITH_LOCATION_HEIGHT = 68
const AFTER_HEADER_GAP = 14
const SECTION_GAP = 36

/** 时间脊：左栏宽度与井内列数 */
const SPINE_WIDTH_DESKTOP = 88
const SPINE_WIDTH_MOBILE = 68
const SPINE_WELL_GAP = 12
const SPINE_SECTION_GAP = 52
const SPINE_SECTION_PAD_TOP = 2
const SPINE_MIN_SECTION_HEIGHT = 120
/** 井内未知比例时偏竖图，更接近「两列大图」 */
const SPINE_DEFAULT_ASPECT = 0.82
const SPINE_MIN_TILE_HEIGHT = 112

export function albumSpineWidth(viewportWidth: number): number {
  return viewportWidth >= BREAKPOINTS.sm ? SPINE_WIDTH_DESKTOP : SPINE_WIDTH_MOBILE
}

/** 时间脊井内固定两列大图 */
export function albumTimelineColumnCount(): number {
  return 2
}

/** 瀑布流列数（比等分方格略少，单列更易看出高低差） */
export function albumColumnCount(viewportWidth: number): number {
  if (viewportWidth >= BREAKPOINTS.lg) return 4
  if (viewportWidth >= BREAKPOINTS.sm) return 3
  return 2
}

export function albumGridGap(viewportWidth: number): number {
  return viewportWidth >= BREAKPOINTS.sm ? 10 : 8
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

/**
 * 时间脊布局：左侧日期脊 + 右侧两列瀑布井；按日纵向阅读。
 */
export function buildAlbumTimelineSpineLayout(
  groups: AlbumDayGroup[],
  containerWidth: number,
  viewportWidth: number,
  aspectByKey?: Map<string, number> | Record<string, number>,
  collapsedDateKeys?: ReadonlySet<string>,
): AlbumVirtualLayout {
  const spineWidth = albumSpineWidth(viewportWidth)
  const columns = albumTimelineColumnCount()
  const gap = albumGridGap(viewportWidth)
  const width = Math.max(0, containerWidth)
  const wellWidth = Math.max(0, width - spineWidth - SPINE_WELL_GAP)
  const columnWidth =
    wellWidth > 0 ? Math.max(1, (wellWidth - gap * Math.max(0, columns - 1)) / columns) : 120

  const items: AlbumVirtualItem[] = []
  let cursorY = 0

  function readAspect(key: string): number {
    if (aspectByKey instanceof Map) {
      const v = aspectByKey.get(key)
      if (v != null && v > 0) return v
    } else if (aspectByKey && typeof aspectByKey[key] === 'number' && aspectByKey[key]! > 0) {
      return aspectByKey[key]!
    }
    return getCachedAlbumAspect(key) ?? SPINE_DEFAULT_ASPECT
  }

  groups.forEach((group, groupIndex) => {
    const collapsed = collapsedDateKeys?.has(group.dateKey) ?? false
    const sectionStart = cursorY + SPINE_SECTION_PAD_TOP
    const masonryTop = sectionStart
    const colHeights = Array.from({ length: columns }, () => 0)
    const tileLeftBase = spineWidth + SPINE_WELL_GAP

    if (!collapsed) {
      for (const record of group.records) {
        const aspect = readAspect(record.key)
        const tileHeight = Math.max(SPINE_MIN_TILE_HEIGHT, columnWidth / aspect)
        const col = shortestColumnIndex(colHeights)
        const left = tileLeftBase + col * (columnWidth + gap)
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
    }

    let masonryHeight = Math.max(0, ...colHeights)
    if (masonryHeight > 0) masonryHeight -= gap
    const sectionHeight = Math.max(SPINE_MIN_SECTION_HEIGHT, masonryHeight)

    items.push({
      type: 'spine',
      key: `spine:${group.dateKey}`,
      dateKey: group.dateKey,
      label: group.label,
      locationLabel: group.locationLabel,
      count: group.records.length,
      offset: sectionStart,
      height: sectionHeight,
      left: 0,
      width: spineWidth,
    })

    cursorY = sectionStart + sectionHeight

    if (groupIndex < groups.length - 1) {
      cursorY += SPINE_SECTION_GAP
    }
  })

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
  const marker = items.find(
    (item) =>
      (item.type === 'header' || item.type === 'spine') && item.dateKey === dateKey,
  )
  return marker ? marker.offset : null
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
