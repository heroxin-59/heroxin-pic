export type FileCategory = 'image' | 'pdf' | 'word' | 'text' | 'other'

export interface FileTypeDefinition {
  ext: string
  category: FileCategory
  /** 常见 MIME；空数组表示不强制 MIME 校验 */
  mimeTypes: string[]
  label: string
}

/** 内置支持的文件类型目录（实际可用范围由 VITE_ALLOWED_EXT 过滤） */
export const FILE_TYPE_CATALOG: FileTypeDefinition[] = [
  { ext: 'jpg', category: 'image', mimeTypes: ['image/jpeg'], label: 'JPEG' },
  { ext: 'jpeg', category: 'image', mimeTypes: ['image/jpeg'], label: 'JPEG' },
  { ext: 'png', category: 'image', mimeTypes: ['image/png'], label: 'PNG' },
  { ext: 'gif', category: 'image', mimeTypes: ['image/gif'], label: 'GIF' },
  { ext: 'webp', category: 'image', mimeTypes: ['image/webp'], label: 'WebP' },
  { ext: 'svg', category: 'image', mimeTypes: ['image/svg+xml'], label: 'SVG' },
  { ext: 'pdf', category: 'pdf', mimeTypes: ['application/pdf'], label: 'PDF' },
  { ext: 'doc', category: 'word', mimeTypes: ['application/msword'], label: 'Word (.doc)' },
  {
    ext: 'docx',
    category: 'word',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    label: 'Word (.docx)',
  },
  { ext: 'txt', category: 'text', mimeTypes: ['text/plain'], label: '文本' },
  { ext: 'md', category: 'text', mimeTypes: ['text/markdown', 'text/plain'], label: 'Markdown' },
  { ext: 'json', category: 'text', mimeTypes: ['application/json', 'text/plain'], label: 'JSON' },
  {
    ext: 'csv',
    category: 'text',
    mimeTypes: ['text/csv', 'application/vnd.ms-excel'],
    label: 'CSV',
  },
]

const CATEGORY_LABEL: Record<FileCategory, string> = {
  image: '图片',
  pdf: 'PDF',
  word: 'Word',
  text: '文本',
  other: '其他',
}

export function getCategoryLabel(category: FileCategory): string {
  return CATEGORY_LABEL[category]
}

/** Element Plus Tag 类型，按文件类别区分颜色 */
export type CategoryTagType = 'success' | 'warning' | 'danger' | 'primary' | 'info'

/**
 * 图片绿 / PDF红 / Word蓝 / 文本橙 / 其他灰
 * 文本用 warning（橙），比自定义紫更贴合 Element 体系、也更好区分
 */
const CATEGORY_TAG_TYPE: Record<FileCategory, CategoryTagType> = {
  image: 'success',
  pdf: 'danger',
  word: 'primary',
  text: 'warning',
  other: 'info',
}

export function getCategoryTagType(category: FileCategory): CategoryTagType {
  return CATEGORY_TAG_TYPE[category]
}

export function getCatalogByExt(ext: string): FileTypeDefinition | undefined {
  return FILE_TYPE_CATALOG.find((item) => item.ext === ext.toLowerCase())
}

/** 从白名单中筛出图片类扩展名 */
export function filterImageExtensions(allowedExt: string[]): string[] {
  return allowedExt.filter((ext) => getCatalogByExt(ext)?.category === 'image')
}

/** 构建 `<input accept>` 属性（扩展名形式） */
export function buildAcceptAttribute(exts: string[]): string {
  return exts.map((ext) => `.${ext}`).join(',')
}

export interface AllowedTypeGroup {
  category: FileCategory
  label: string
  extensions: string[]
}

/** 按分类汇总当前白名单扩展名，用于 UI 展示 */
export function groupAllowedExtensions(allowedExt: string[]): AllowedTypeGroup[] {
  const allowed = new Set(allowedExt.map((ext) => ext.toLowerCase()))
  const groups = new Map<FileCategory, string[]>()

  for (const def of FILE_TYPE_CATALOG) {
    if (!allowed.has(def.ext)) continue
    const list = groups.get(def.category) ?? []
    if (!list.includes(def.ext)) {
      list.push(def.ext)
    }
    groups.set(def.category, list)
  }

  const ordered: FileCategory[] = ['image', 'pdf', 'word', 'text', 'other']
  const result: AllowedTypeGroup[] = []

  for (const category of ordered) {
    const extensions = groups.get(category)
    if (!extensions?.length) continue
    result.push({
      category,
      label: getCategoryLabel(category),
      extensions,
    })
  }

  // env 中自定义、不在目录里的扩展名
  const catalogExts = new Set(FILE_TYPE_CATALOG.map((item) => item.ext))
  const custom = allowedExt.filter((ext) => !catalogExts.has(ext.toLowerCase()))
  if (custom.length > 0) {
    result.push({
      category: 'other',
      label: getCategoryLabel('other'),
      extensions: custom,
    })
  }

  return result
}

export function formatAllowedTypeSummary(allowedExt: string[]): string {
  const groups = groupAllowedExtensions(allowedExt)
  if (groups.length === 0) return '未配置允许类型'
  return groups.map((group) => `${group.label}（${group.extensions.join(', ')}）`).join(' · ')
}
