/** 预览器类型（路由 / 弹窗按此分支加载） */
export type PreviewType = 'image' | 'pdf' | 'word' | 'text' | 'unsupported'

/** @deprecated 使用 `PreviewType`；保留兼容既有命名 */
export type PreviewKind = PreviewType
