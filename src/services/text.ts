import { getObjectBlob } from '@/services/fileList'

/** 文本预览最大读取字节（超出则截断并提示） */
export const MAX_TEXT_PREVIEW_BYTES = 512 * 1024

export type TextPreviewMode = 'plain' | 'json' | 'markdown' | 'csv'

export interface TextPreviewResult {
  /** 展示用文本 */
  content: string
  /** 原始是否被截断 */
  truncated: boolean
  /** 文件总字节数（若已知） */
  totalBytes: number
  /** 实际解码字节数 */
  decodedBytes: number
  mode: TextPreviewMode
  /** JSON 格式化是否成功 */
  jsonFormatted: boolean
  /** 实际采用的字符编码 */
  encoding: string
}

export function getTextPreviewMode(extension: string): TextPreviewMode {
  const ext = extension.toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'md') return 'markdown'
  if (ext === 'csv') return 'csv'
  return 'plain'
}

const DECODE_CANDIDATES = ['utf-8', 'gb18030', 'gbk', 'big5'] as const

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1)
  return text
}

function countReplacementChars(text: string): number {
  let count = 0
  for (const ch of text) {
    if (ch === '\uFFFD') count += 1
  }
  return count
}

function countCjkChars(text: string): number {
  let count = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    // 常用汉字 / 全角标点 / 扩展 A
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      count += 1
    }
  }
  return count
}

function tryDecode(bytes: Uint8Array, label: string): string | null {
  try {
    const decoder = new TextDecoder(label, { fatal: true })
    return stripBom(decoder.decode(bytes))
  } catch {
    try {
      // 部分环境 fatal 不支持该编码，再尝试非 fatal 并评分
      const decoder = new TextDecoder(label, { fatal: false })
      return stripBom(decoder.decode(bytes))
    } catch {
      return null
    }
  }
}

/**
 * 自动探测编码：优先 UTF-8，失败或大量 � 时回退 GB18030 / GBK / Big5（兼容中文 Windows 文本）。
 */
export function decodeTextBytes(bytes: Uint8Array): { text: string; encoding: string } {
  let best: { text: string; encoding: string; score: number } | null = null

  for (const label of DECODE_CANDIDATES) {
    const text = tryDecode(bytes, label)
    if (text == null) continue

    const replacement = countReplacementChars(text)
    const cjk = countCjkChars(text)
    // 替换符越少越好；有中文时额外加分；UTF-8 平手时优先
    const utfBonus = label === 'utf-8' ? 2 : 0
    const score = cjk * 3 - replacement * 20 + utfBonus

    if (!best || score > best.score) {
      best = { text, encoding: label, score }
    }

    // UTF-8 无替换符则直接采用
    if (label === 'utf-8' && replacement === 0) {
      return { text, encoding: 'utf-8' }
    }
  }

  if (best) {
    return { text: best.text, encoding: best.encoding }
  }

  // 兜底：UTF-8 非 fatal
  return {
    text: stripBom(new TextDecoder('utf-8', { fatal: false }).decode(bytes)),
    encoding: 'utf-8',
  }
}

function formatJsonIfPossible(text: string): { content: string; formatted: boolean } {
  try {
    const parsed = JSON.parse(text)
    return { content: JSON.stringify(parsed, null, 2), formatted: true }
  } catch {
    return { content: text, formatted: false }
  }
}

/** 从 OSS 拉取文本并解码（自动识别 UTF-8 / 中文编码，大文件截断） */
export async function loadTextContent(
  key: string,
  options: { maxBytes?: number; extension?: string } = {},
): Promise<TextPreviewResult> {
  const maxBytes = options.maxBytes ?? MAX_TEXT_PREVIEW_BYTES
  const blob = await getObjectBlob(key)
  const totalBytes = blob.size
  const truncated = totalBytes > maxBytes

  const slice = truncated ? blob.slice(0, maxBytes) : blob
  const buffer = await slice.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const { text: raw, encoding } = decodeTextBytes(bytes)
  const mode = getTextPreviewMode(options.extension ?? '')

  let content = raw
  let jsonFormatted = false

  if (mode === 'json' && !truncated) {
    const result = formatJsonIfPossible(raw)
    content = result.content
    jsonFormatted = result.formatted
  }

  return {
    content,
    truncated,
    totalBytes,
    decodedBytes: bytes.byteLength,
    mode,
    jsonFormatted,
    encoding,
  }
}
