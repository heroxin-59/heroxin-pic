import { renderAsync } from 'docx-preview'
import { acquirePreviewBlob, releasePreviewBlob } from '@/services/filePreviewCache'

export function isDocxFile(filenameOrExt: string): boolean {
  const value = filenameOrExt.trim().toLowerCase()
  return value === 'docx' || value.endsWith('.docx')
}

/** Word 97-2003 二进制 .doc（排除 .docx） */
export function isDocFile(filenameOrExt: string): boolean {
  const value = filenameOrExt.trim().toLowerCase()
  if (isDocxFile(value)) return false
  return value === 'doc' || value.endsWith('.doc')
}

export function isWordPreviewFile(filenameOrExt: string): boolean {
  return isDocxFile(filenameOrExt) || isDocFile(filenameOrExt)
}

/** 从 OSS 拉取 .doc 为 File，供 @zhenghy/doc-preview 使用 */
export async function loadDocFileFromOss(key: string, filename: string): Promise<File> {
  const blob = await acquirePreviewBlob(key)
  const name = filename.trim() || 'document.doc'
  return new File([blob], name, { type: blob.type || 'application/msword' })
}

export function releaseDocFileFromOss(key: string) {
  releasePreviewBlob(key)
}

/** 将 OSS 上的 .docx 渲染到容器（图片 / 表格基础展示由 docx-preview 处理） */
export async function renderDocxToContainer(params: {
  key: string
  bodyContainer: HTMLElement
  styleContainer?: HTMLElement
}): Promise<void> {
  const blob = await acquirePreviewBlob(params.key)
  params.bodyContainer.innerHTML = ''
  if (params.styleContainer) {
    params.styleContainer.innerHTML = ''
  }

  try {
    await renderAsync(blob, params.bodyContainer, params.styleContainer, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      useBase64URL: true,
      className: 'docx-preview',
    })
  } finally {
    releasePreviewBlob(params.key)
  }
}

export function releaseDocxPreview(key: string) {
  releasePreviewBlob(key)
}
