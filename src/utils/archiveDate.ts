import exifr from 'exifr'
import { getCatalogByExt } from '../constants/fileTypes'

/** 归档用的日历日（目录 `yyyy/MM/dd`，不含时分秒） */
export interface ArchiveDateParts {
  year: number
  month: number
  day: number
}

/**
 * 归档日来源（3.12.2 优先级）：
 * 1. filename — 文件名解析
 * 2. exif — EXIF 拍摄时间（后续 3.12.4）
 * 3. upload — 上传当天（回退）
 */
export type ArchiveDateSource = 'filename' | 'exif' | 'upload'

export const ARCHIVE_DATE_PRIORITY: readonly ArchiveDateSource[] = [
  'filename',
  'exif',
  'upload',
] as const

export interface ArchiveDateResolveResult {
  parts: ArchiveDateParts
  source: ArchiveDateSource
  /** `yyyy/MM/dd`，可直接拼进 Object Key */
  path: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatArchiveDatePath(parts: ArchiveDateParts): string {
  return `${parts.year}/${pad2(parts.month)}/${pad2(parts.day)}`
}

export function archiveDatePartsFromDate(date: Date): ArchiveDateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  }
}

/**
 * 3.12.1：是否按「内容日期」归档。
 * 仅图片类（与 `fileTypes` 目录中 category=image 一致）；PDF/Word/文本等返回 false。
 */
export function shouldUseContentArchiveDate(filename: string): boolean {
  const base = filename.split(/[/\\]/).pop() || filename
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
  return getCatalogByExt(ext)?.category === 'image'
}

/**
 * 合法日历日，且年份 ≥ 1990，且不晚于「今天」（本地日历）。
 * 时分秒不参与目录；非法日（如 2 月 30 日）视为无效。
 */
export function isValidArchiveCalendarDate(parts: ArchiveDateParts, now = new Date()): boolean {
  const { year, month, day } = parts
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false

  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return false
  }

  if (year < 1990) return false

  const today = archiveDatePartsFromDate(now)
  const candidateUtc = Date.UTC(year, month - 1, day)
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day)
  // 未来日期回退由上层走 upload；此处直接判无效
  return candidateUtc <= todayUtc
}

interface FilenameDateCandidate {
  parts: ArchiveDateParts
  /** 越高越优先（带完整日历日、带时间戳的更可信） */
  score: number
  index: number
}

function pushCandidate(
  list: FilenameDateCandidate[],
  year: number,
  month: number,
  day: number,
  score: number,
  index: number,
  now: Date,
) {
  const parts = { year, month, day }
  if (!isValidArchiveCalendarDate(parts, now)) return
  list.push({ parts, score, index })
}

/**
 * 3.12.3：从文件名解析归档日。
 * 支持多种常见格式；多候选时取分数更高、更靠前的合法日历日。
 * 无法判定返回 `null`（由上层回退 EXIF / 上传日）。
 */
export function parseDateFromFilename(
  filename: string,
  now = new Date(),
): ArchiveDateParts | null {
  const base = filename.split(/[/\\]/).pop() || filename
  const dot = base.lastIndexOf('.')
  const text = dot > 0 ? base.slice(0, dot) : base
  if (!text) return null

  const candidates: FilenameDateCandidate[] = []

  // 2026年3月15日 / 2026年03月15日
  for (const match of text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)) {
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      100,
      match.index ?? 0,
      now,
    )
  }

  // 2026-03-15、2026_03_15、2026.03.15；可选 _HH-mm-ss / T HH:mm:ss
  for (const match of text.matchAll(
    /(\d{4})([-_.])(\d{1,2})\2(\d{1,2})(?:[_\sT]-?(\d{2})[-:.](\d{2})[-:.](\d{2}))?/g,
  )) {
    const hasTime = Boolean(match[5])
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[3]),
      Number(match[4]),
      hasTime ? 95 : 90,
      match.index ?? 0,
      now,
    )
  }

  // 20260315120001（紧凑日期+时分秒 14 位）
  for (const match of text.matchAll(/(?<!\d)(\d{4})(\d{2})(\d{2})(\d{6})(?!\d)/g)) {
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      85,
      match.index ?? 0,
      now,
    )
  }

  // 20260315_120001 / 20260315-120001
  for (const match of text.matchAll(/(?<!\d)(\d{4})(\d{2})(\d{2})[_-](\d{6})(?!\d)/g)) {
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      88,
      match.index ?? 0,
      now,
    )
  }

  // 20260315（单独 8 位）；避免吃掉已被更长匹配覆盖的同起点时可靠分数竞争
  for (const match of text.matchAll(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/g)) {
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      70,
      match.index ?? 0,
      now,
    )
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.index - b.index
  })

  return candidates[0]?.parts ?? null
}

/**
 * 3.12.1 + 3.12.2（当前仅落地 filename → upload；exif 见 3.12.4）。
 * 非图片一律 upload 当日。
 */
export function resolveArchiveDateParts(options: {
  filename: string
  /** 已解析的 EXIF 日；未读到则不传 */
  exifParts?: ArchiveDateParts | null
  now?: Date
}): ArchiveDateResolveResult {
  const now = options.now ?? new Date()
  const uploadParts = archiveDatePartsFromDate(now)

  if (!shouldUseContentArchiveDate(options.filename)) {
    return {
      parts: uploadParts,
      source: 'upload',
      path: formatArchiveDatePath(uploadParts),
    }
  }

  for (const source of ARCHIVE_DATE_PRIORITY) {
    if (source === 'filename') {
      const parts = parseDateFromFilename(options.filename, now)
      if (parts) {
        return { parts, source: 'filename', path: formatArchiveDatePath(parts) }
      }
      continue
    }
    if (source === 'exif') {
      if (options.exifParts && isValidArchiveCalendarDate(options.exifParts, now)) {
        return {
          parts: options.exifParts,
          source: 'exif',
          path: formatArchiveDatePath(options.exifParts),
        }
      }
      continue
    }
    // upload
    return {
      parts: uploadParts,
      source: 'upload',
      path: formatArchiveDatePath(uploadParts),
    }
  }

  return {
    parts: uploadParts,
    source: 'upload',
    path: formatArchiveDatePath(uploadParts),
  }
}

function toIsoLikeDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim().replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    const date = new Date(normalized)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

/**
 * 从 Object Key 中解析归档目录日（`…/yyyy/MM/dd/…`）。
 * 与上传归档路径一致，供相册分组优先使用。
 */
export function parseArchiveDateFromObjectKey(key: string): ArchiveDateParts | null {
  const match = /(?:^|\/)(\d{4})\/(\d{2})\/(\d{2})(?:\/|$)/.exec(key)
  if (!match) return null
  const parts: ArchiveDateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
  // 分组场景不套用「不得晚于今天」：历史 Key 仍应按目录日展示
  const { year, month, day } = parts
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(year, month - 1, day)
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null
  }
  if (year < 1990 || year > 2100) return null
  return parts
}

/**
 * 3.12.4：从图片 Blob 读取 EXIF 拍摄日（仅日历日）。
 * 失败 / 无 EXIF 返回 null，不抛错。
 */
export async function readExifArchiveDateParts(
  blob: Blob,
  now = new Date(),
): Promise<ArchiveDateParts | null> {
  try {
    const exif = await exifr.parse(blob, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
      translateKeys: false,
      reviveValues: true,
      sanitize: false,
    })
    if (!exif) return null

    const date =
      toIsoLikeDate(exif.DateTimeOriginal) ||
      toIsoLikeDate(exif.CreateDate) ||
      toIsoLikeDate(exif.ModifyDate)
    if (!date) return null

    const parts = archiveDatePartsFromDate(date)
    return isValidArchiveCalendarDate(parts, now) ? parts : null
  } catch {
    return null
  }
}

/**
 * 图片：文件名 → EXIF → 上传日；非图片：上传日。
 * 供上传队列在入队前调用（3.12.6）。
 */
export async function resolveArchiveDateForFile(
  file: File,
  now = new Date(),
): Promise<ArchiveDateResolveResult> {
  if (!shouldUseContentArchiveDate(file.name)) {
    return resolveArchiveDateParts({ filename: file.name, now })
  }

  const fromName = parseDateFromFilename(file.name, now)
  if (fromName) {
    return {
      parts: fromName,
      source: 'filename',
      path: formatArchiveDatePath(fromName),
    }
  }

  const exifParts = await readExifArchiveDateParts(file, now)
  return resolveArchiveDateParts({
    filename: file.name,
    exifParts,
    now,
  })
}
