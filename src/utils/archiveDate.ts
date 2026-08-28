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

function isLikelyDirectoryPath(segments: string[]): boolean {
  if (segments.length <= 1) return false
  const first = segments[0]
  if (!first) return false
  if (/^[a-zA-Z_]/.test(first)) return true
  if (
    segments.length >= 4 &&
    /^\d{4}$/.test(segments[0]) &&
    /^\d{1,2}$/.test(segments[1]) &&
    /^\d{1,2}$/.test(segments[2])
  ) {
    return true
  }
  return false
}

/** 去掉扩展名；含 `/` 时区分 OSS 路径与文件名内斜杠日期 */
function filenameTextWithoutExtension(filename: string): string {
  const normalized = filename.replace(/\\/g, '/')
  const segments = normalized.split('/')

  let stem: string
  if (isLikelyDirectoryPath(segments)) {
    const last = segments[segments.length - 1] ?? normalized
    stem = last
  } else if (segments.length > 1) {
    stem = normalized.replace(/\.[^./]+$/, '')
  } else {
    stem = normalized
  }

  const dot = stem.lastIndexOf('.')
  return dot > 0 ? stem.slice(0, dot) : stem
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

/** `{可选前缀_}{毫秒13位}_{序号}` 匹配结果 */
export interface MsSeqTimestampMatch {
  /** 如 `Video`、`IMG`；纯数字主体时为 null */
  prefix: string | null
  date: Date
}

/**
 * 从文件名主体解析 `{前缀_}{毫秒}_{序号}`。
 * 支持 `1785202559418_616`、`Video_1785202559418_616` 等。
 */
export function parseMsSeqTimestampFromStem(stem: string): MsSeqTimestampMatch | null {
  const match = /^(?:(.+?)_)?(\d{13})_(\d+)$/.exec(stem.trim())
  if (!match) return null

  const date = new Date(Number(match[2]))
  if (Number.isNaN(date.getTime())) return null

  const prefix = match[1]?.trim() || null
  return { prefix, date }
}

/** 将毫秒时间戳格式化为列表展示名（本地时区） */
export function formatTimestampFilenameDisplay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

/** 将 `{前缀_}{毫秒}_{序号}` 格式化为可读展示名 */
export function formatMsSeqFilenameDisplay(match: MsSeqTimestampMatch): string {
  const formatted = formatTimestampFilenameDisplay(match.date)
  return match.prefix ? `${match.prefix} ${formatted}` : formatted
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
 * `15-03-2026` / `03-15-2026` / `15032026`：日月在前、年在后。
 * 歧义（如 05-06-2026）时优先 DD-MM-YYYY。
 */
function pushTrailingYearCandidates(
  list: FilenameDateCandidate[],
  first: number,
  second: number,
  year: number,
  score: number,
  index: number,
  now: Date,
) {
  const asDayMonth: ArchiveDateParts = { year, month: second, day: first }
  const asMonthDay: ArchiveDateParts = { year, month: first, day: second }

  const dayMonthOk =
    first >= 1 && first <= 31 && second >= 1 && second <= 12 &&
    isValidArchiveCalendarDate(asDayMonth, now)
  const monthDayOk =
    first >= 1 && first <= 12 && second >= 1 && second <= 31 &&
    isValidArchiveCalendarDate(asMonthDay, now)

  if (dayMonthOk && monthDayOk) {
    const same =
      asDayMonth.month === asMonthDay.month && asDayMonth.day === asMonthDay.day
    if (same) {
      pushCandidate(list, year, asDayMonth.month, asDayMonth.day, score, index, now)
      return
    }
    // 05-06-2026 等歧义：优先 DD-MM
    pushCandidate(list, year, asDayMonth.month, asDayMonth.day, score, index, now)
    return
  }
  if (dayMonthOk) {
    pushCandidate(list, year, asDayMonth.month, asDayMonth.day, score, index, now)
    return
  }
  if (monthDayOk) {
    pushCandidate(list, year, asMonthDay.month, asMonthDay.day, score, index, now)
  }
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
  const text = filenameTextWithoutExtension(filename)
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

  // 2026-03-15、2026/03/15、2026_03_15、2026.03.15；可选时分秒
  for (const match of text.matchAll(
    /(\d{4})([-_.\\/])(\d{1,2})\2(\d{1,2})(?:(?:[_\sT])-?(\d{2})[-:.](\d{2})[-:.](\d{2}))?/g,
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

  // 2026 03 15、2026 03 15 12 30 00
  for (const match of text.matchAll(
    /(\d{4})\s+(\d{1,2})\s+(\d{1,2})(?:\s+(\d{2})[-:.](\d{2})[-:.](\d{2}))?/g,
  )) {
    const hasTime = Boolean(match[4])
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      hasTime ? 93 : 89,
      match.index ?? 0,
      now,
    )
  }

  // 2026.03.15.12.30.00
  for (const match of text.matchAll(
    /(?<!\d)(\d{4})\.(\d{1,2})\.(\d{1,2})\.(\d{2})\.(\d{2})\.(\d{2})(?!\d)/g,
  )) {
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      92,
      match.index ?? 0,
      now,
    )
  }

  // 15-03-2026、15/03/2026、03-15-2026（日月在前）；可选 _120001 / 时分秒
  for (const match of text.matchAll(
    /(?<!\d)(\d{1,2})([-_.\\/])(\d{1,2})\2(\d{4})(?:(?:[_\sT])-?(\d{2})[-:.](\d{2})[-:.](\d{2})|[_-](\d{6}))?/g,
  )) {
    const hasTime = Boolean(match[5] || match[8])
    pushTrailingYearCandidates(
      candidates,
      Number(match[1]),
      Number(match[3]),
      Number(match[4]),
      hasTime ? 84 : 82,
      match.index ?? 0,
      now,
    )
  }

  // 15 03 2026
  for (const match of text.matchAll(/(?<!\d)(\d{1,2})\s+(\d{1,2})\s+(\d{4})(?!\d)/g)) {
    pushTrailingYearCandidates(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      80,
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

  // 20260315 120001（空格分隔时分秒）
  for (const match of text.matchAll(/(?<!\d)(\d{4})(\d{2})(\d{2})\s+(\d{6})(?!\d)/g)) {
    pushCandidate(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      86,
      match.index ?? 0,
      now,
    )
  }

  // 20260315（单独 8 位 YYYYMMDD）
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

  // 15032026 / 03152026（DDMMYYYY 或 MMDDYYYY 紧凑，年在后）
  for (const match of text.matchAll(/(?<!\d)(\d{2})(\d{2})(\d{4})(?!\d)/g)) {
    pushTrailingYearCandidates(
      candidates,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      68,
      match.index ?? 0,
      now,
    )
  }

  // 毫秒时间戳_序号，如 1785202559418_616.jpg、Video_1785202559418_616.mp4
  for (const match of text.matchAll(/(?<!\d)(\d{13})_(\d+)(?!\d)/g)) {
    const date = new Date(Number(match[1]))
    if (Number.isNaN(date.getTime())) continue
    const parts = archiveDatePartsFromDate(date)
    pushCandidate(candidates, parts.year, parts.month, parts.day, 94, match.index ?? 0, now)
  }

  // 秒时间戳_序号，如 1710000000_616.jpg
  for (const match of text.matchAll(/(?<!\d)(\d{10})_(\d+)(?!\d)/g)) {
    const date = new Date(Number(match[1]) * 1000)
    if (Number.isNaN(date.getTime())) continue
    const parts = archiveDatePartsFromDate(date)
    pushCandidate(candidates, parts.year, parts.month, parts.day, 91, match.index ?? 0, now)
  }

  // Unix 毫秒时间戳（13 位），如 mmexport1724567890123.jpg
  for (const match of text.matchAll(/(?<!\d)(\d{13})(?!\d)/g)) {
    const date = new Date(Number(match[1]))
    if (Number.isNaN(date.getTime())) continue
    const parts = archiveDatePartsFromDate(date)
    pushCandidate(candidates, parts.year, parts.month, parts.day, 65, match.index ?? 0, now)
  }

  // Unix 秒时间戳（10 位）
  for (const match of text.matchAll(/(?<!\d)(\d{10})(?!\d)/g)) {
    const date = new Date(Number(match[1]) * 1000)
    if (Number.isNaN(date.getTime())) continue
    const parts = archiveDatePartsFromDate(date)
    pushCandidate(candidates, parts.year, parts.month, parts.day, 60, match.index ?? 0, now)
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
