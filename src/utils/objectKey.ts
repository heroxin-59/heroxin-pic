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

/** 去除路径分隔符，保留原文件名主体 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || 'file'
  return base.replace(/[^\w.\u4e00-\u9fa5()-]+/g, '_')
}

function normalizeDir(dir: string): string {
  return dir.replace(/^\/+/, '').replace(/\/?$/, '/')
}

function withSuffixFilename(filename: string, index: number): string {
  if (index <= 0) return filename
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return `${filename}-${index}`
  const stem = filename.slice(0, dot)
  const ext = filename.slice(dot)
  return `${stem}-${index}${ext}`
}

export interface BuildObjectKeyOptions {
  filename: string
  dir?: string
  strategy?: DuplicateStrategy
  /** suffix / overwrite 策略下用于避免同批 Key 冲突 */
  reservedKeys?: Set<string>
  /** suffix 策略：记录同名文件出现次数 */
  basenameCounter?: Map<string, number>
}

/**
 * Object Key 规则（按策略）：
 * - uuid:   `{dir}{yyyy}/{MM}/{dd}/{uuid}-{filename}`
 * - overwrite: `{dir}{yyyy}/{MM}/{dd}/{filename}`
 * - suffix: `{dir}{yyyy}/{MM}/{dd}/{filename}`，重名则 `{stem}-1.ext`
 */
export function buildObjectKey(options: BuildObjectKeyOptions): string {
  const {
    filename,
    dir = 'uploads/',
    strategy = 'uuid',
    reservedKeys = new Set<string>(),
    basenameCounter = new Map<string, number>(),
  } = options

  const normalizedDir = normalizeDir(dir)
  const safeName = sanitizeFilename(filename)
  const folder = `${normalizedDir}${datePath()}/`

  if (strategy === 'uuid') {
    return `${folder}${createId()}-${safeName}`
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

/** 同批上传时预分配 Key，避免 suffix/overwrite 策略冲突 */
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

  plan(filename: string): string {
    const key = buildObjectKey({
      filename,
      dir: this.dir,
      strategy: this.strategy,
      reservedKeys: this.reserved,
      basenameCounter: this.basenameCounter,
    })
    this.reserved.add(key)
    return key
  }

  get reservedKeys(): ReadonlySet<string> {
    return this.reserved
  }
}
