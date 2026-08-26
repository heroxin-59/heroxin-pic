import { defineAsyncComponent } from 'vue'

/**
 * PDF / Word 预览体积较大，按需异步加载（阶段 7.8）。
 * 图片 / 文本仍同步引入，避免首屏额外等待。
 */
export const AsyncPdfPreview = defineAsyncComponent({
  loader: () => import('@/components/preview/PdfPreview.vue'),
  delay: 100,
  timeout: 45_000,
})

export const AsyncWordPreview = defineAsyncComponent({
  loader: () => import('@/components/preview/WordPreview.vue'),
  delay: 100,
  timeout: 45_000,
})
