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
}

export function getTextPreviewMode(extension: string): TextPreviewMode {
  const ext = extension.toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'md') return 'markdown'
  if (ext === 'csv') return 'csv'
  return 'plain'
}

function decodeUtf8(bytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false })
  return decoder.decode(bytes)
}

function formatJsonIfPossible(text: string): { content: string; formatted: boolean } {
  try {
    const parsed = JSON.parse(text)
    return { content: JSON.stringify(parsed, null, 2), formatted: true }
  } catch {
    return { content: text, formatted: false }
  }
}

/** 从 OSS 拉取文本并解码（UTF-8，大文件截断） */
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
  const raw = decodeUtf8(bytes)
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
  }
}
