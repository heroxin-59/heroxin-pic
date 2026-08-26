import type { DuplicateStrategy } from '@/config/upload'

/** 生成 UUID（优先 crypto.randomUUID） */
function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function datePath(date = new Date()): string {
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}

/** 毫秒时间戳 */
function createTimestampId(date = new Date()): string {
  return String(date.getTime())
}

/** 去除路径分隔符，保留原文件名主体 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'file'
  return base.replace(/[^\w.\u4e00-\u9fa5()-]+/g, '_')
}

function normalizeDir(dir: string): string {
  return dir.replace(/^\/+/, '').replace(/\/?$/, '/')
}

/** 拆成主体与扩展名（含点）；无扩展名时 ext 为空 */
export function splitFilename(filename: string): { stem: string; ext: string } {
  const safe = sanitizeFilename(filename)
  const dot = safe.lastIndexOf('.')
  if (dot <= 0) {
    return { stem: safe || 'file', ext: '' }
  }
  return {
    stem: safe.slice(0, dot) || 'file',
    ext: safe.slice(dot),
  }
}

/** 标准 UUID（含连字符） */
const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

/**
 * 从存储文件名还原展示/下载用源文件名（不影响 Object Key）。
 * - uuid 策略：`{uuid}-{原文件名}` → 去掉 UUID 前缀
 * - timestamp 策略：`{stem}-{timestamp}{ext}` → 去掉时间戳后缀
 */
export function displayNameFromStoredFilename(storedName: string): string {
  const base = storedName.split(/[/\\]/).pop() || storedName
  if (!base) return storedName

  const uuidPrefix = new RegExp(`^(${UUID_PATTERN})-(.+)$`, 'i').exec(base)
  if (uuidPrefix?.[2]) {
    return uuidPrefix[2]
  }

  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''

  const tsSuffix = /^(.+)-(\d{13})$/.exec(stem)
  if (tsSuffix?.[1]) {
    return `${tsSuffix[1]}${ext}`
  }

  return base
}

/** `{uuid}-{原文件名}`，例如 `a1b2c3d4-...-报告.docx` */
function withUuidPrefixFilename(filename: string, uuid: string): string {
  return `${uuid}-${sanitizeFilename(filename)}`
}

/** `{stem}-{token}{ext}`，例如 `报告-1710000000000.docx`（timestamp 策略） */
function withTokenFilename(filename: string, token: string): string {
  const { stem, ext } = splitFilename(filename)
  return `${stem}-${token}${ext}`
}

function withSuffixFilename(filename: string, index: number): string {
  if (index <= 0) return filename
  const { stem, ext } = splitFilename(filename)
  return `${stem}-${index}${ext}`
}

export interface BuildObjectKeyOptions {
  filename: string
  dir?: string
  strategy?: DuplicateStrategy
  /** 同批已占用 Key，避免冲突 */
  reservedKeys?: Set<string>
  /** suffix 策略：记录同名文件出现次数 */
  basenameCounter?: Map<string, number>
  /**
   * 归档目录日 `yyyy/MM/dd`（3.12）。
   * 不传或非法时回退为上传当天。
   */
  archiveDatePath?: string
}

const ARCHIVE_PATH_RE = /^\d{4}\/\d{2}\/\d{2}$/

function resolveArchiveFolderSegment(archiveDatePath?: string, now = new Date()): string {
  const trimmed = archiveDatePath?.trim().replace(/^\/+|\/+$/g, '') ?? ''
  if (trimmed && ARCHIVE_PATH_RE.test(trimmed)) return trimmed
  return datePath(now)
}

/**
 * Object Key 规则（按策略）：
 * - uuid（默认）: `{dir}{yyyy}/{MM}/{dd}/{uuid}-{filename}`
 * - timestamp:     `{dir}{yyyy}/{MM}/{dd}/{stem}-{timestamp}{ext}`
 * - overwrite:     `{dir}{yyyy}/{MM}/{dd}/{filename}`
 * - suffix:        `{dir}{yyyy}/{MM}/{dd}/{filename}`，重名则 `{stem}-1.ext`
 *
 * `yyyy/MM/dd` 默认上传当天；图片可传入 `archiveDatePath`（文件名/EXIF 解析结果）。
 * 列表 / 下载展示名通过 `displayNameFromStoredFilename` 去掉 UUID 前缀。
 */
export function buildObjectKey(options: BuildObjectKeyOptions): string {
  const {
    filename,
    dir = 'uploads/',
    strategy = 'uuid',
    reservedKeys = new Set<string>(),
    basenameCounter = new Map<string, number>(),
    archiveDatePath,
  } = options

  const normalizedDir = normalizeDir(dir)
  const safeName = sanitizeFilename(filename)
  const folder = `${normalizedDir}${resolveArchiveFolderSegment(archiveDatePath)}/`

  if (strategy === 'uuid') {
    return `${folder}${withUuidPrefixFilename(safeName, createId())}`
  }

  if (strategy === 'timestamp') {
    let stamp = createTimestampId()
    let candidate = `${folder}${withTokenFilename(safeName, stamp)}`
    let guard = 0
    while (reservedKeys.has(candidate) && guard < 1000) {
      stamp = String(Number(stamp) + 1)
      candidate = `${folder}${withTokenFilename(safeName, stamp)}`
      guard += 1
    }
    return candidate
  }

  if (strategy === 'overwrite') {
    return `${folder}${safeName}`
  }

  // suffix：同批内同名递增序号，并确保 Key 不重复
  const baseKey = `${folder}${safeName}`
  let count = basenameCounter.get(safeName) ?? 0
  let candidate = count === 0 ? baseKey : `${folder}${withSuffixFilename(safeName, count)}`

  while (reservedKeys.has(candidate)) {
    count += 1
    candidate = `${folder}${withSuffixFilename(safeName, count)}`
  }

  basenameCounter.set(safeName, count + 1)
  return candidate
}

/** 同批上传时预分配 Key，避免冲突 */
export class ObjectKeyPlanner {
  private readonly reserved = new Set<string>()
  private readonly basenameCounter = new Map<string, number>()
  private readonly dir: string
  private readonly strategy: DuplicateStrategy

  constructor(dir: string, strategy: DuplicateStrategy, seedKeys: string[] = []) {
    this.dir = dir
    this.strategy = strategy
    for (const key of seedKeys) {
      this.reserved.add(key)
    }
  }

  /**
   * @param archiveDatePath 可选 `yyyy/MM/dd`；图片归档日由调用方解析后传入
   */
  plan(filename: string, archiveDatePath?: string): string {
    const key = buildObjectKey({
      filename,
      dir: this.dir,
      strategy: this.strategy,
      reservedKeys: this.reserved,
      basenameCounter: this.basenameCounter,
      archiveDatePath,
    })
    this.reserved.add(key)
    return key
  }

  get reservedKeys(): ReadonlySet<string> {
    return this.reserved
  }
}
