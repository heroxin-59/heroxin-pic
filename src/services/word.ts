import { renderAsync } from 'docx-preview'
import { getObjectBlob } from '@/services/fileList'

export function isDocxFile(filenameOrExt: string): boolean {
  const value = filenameOrExt.trim().toLowerCase()
  return value === 'docx' || value.endsWith('.docx')
}

/** 将 OSS 上的 .docx 渲染到容器（图片 / 表格基础展示由 docx-preview 处理） */
export async function renderDocxToContainer(params: {
  key: string
  bodyContainer: HTMLElement
  styleContainer?: HTMLElement
}): Promise<void> {
  const blob = await getObjectBlob(params.key)
  params.bodyContainer.innerHTML = ''
  if (params.styleContainer) {
    params.styleContainer.innerHTML = ''
  }

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
}
