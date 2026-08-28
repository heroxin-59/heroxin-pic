import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { acquirePreviewBlob, releasePreviewBlob } from '@/services/filePreviewCache'

GlobalWorkerOptions.workerSrc = pdfWorker

const pdfAssetBase = `${import.meta.env.BASE_URL}pdfjs/`

export interface PdfDocumentHandle {
  pdf: PDFDocumentProxy
  pageCount: number
  /** 释放文档与 worker 任务占用的资源 */
  destroy: () => Promise<void>
}

/** 从 OSS 拉取 PDF 并交由 pdf.js 解析（预览组件连续渲染全部页） */
export async function loadPdfDocument(key: string): Promise<PdfDocumentHandle> {
  const blob = await acquirePreviewBlob(key)
  const data = new Uint8Array(await blob.arrayBuffer())
  const loadingTask = getDocument({
    data,
    // 中文等 CID 字体依赖 CMap；缺省时常整页空白
    cMapUrl: `${pdfAssetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${pdfAssetBase}standard_fonts/`,
    // 扫描件常见 JBIG2 / JPEG2000，必须提供 wasm（否则控制台 Jbig2Error，页面空白）
    wasmUrl: `${pdfAssetBase}wasm/`,
  })
  const pdf = await loadingTask.promise

  return {
    pdf,
    pageCount: pdf.numPages,
    destroy: async () => {
      try {
        await pdf.cleanup()
      } catch {
        // ignore cleanup race
      }
      await loadingTask.destroy()
      releasePreviewBlob(key)
    },
  }
}

export async function renderPdfPage(params: {
  pdf: PDFDocumentProxy
  pageNumber: number
  canvas: HTMLCanvasElement
  /** 相对 1.0 的缩放 */
  scale: number
}): Promise<{ width: number; height: number }> {
  const { pdf, pageNumber, canvas, scale } = params
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const context = canvas.getContext('2d', { alpha: false })

  if (!context) {
    throw new Error('无法创建 Canvas 上下文')
  }

  const outputScale = window.devicePixelRatio || 1
  const width = Math.max(1, Math.floor(viewport.width * outputScale))
  const height = Math.max(1, Math.floor(viewport.height * outputScale))

  canvas.width = width
  canvas.height = height
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  const transform = outputScale !== 1 ? ([outputScale, 0, 0, outputScale, 0, 0] as const) : null

  const renderTask = page.render({
    canvasContext: context,
    canvas,
    viewport,
    ...(transform ? { transform: [...transform] } : {}),
    background: '#ffffff',
  })

  await renderTask.promise

  return {
    width: viewport.width,
    height: viewport.height,
  }
}
