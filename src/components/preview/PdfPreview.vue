<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Download, Refresh, ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FileRecord } from '@/types/file'
import { loadPdfDocument, renderPdfPage } from '@/services/pdf'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError, showAppSuccess } from '@/utils/message'

const props = defineProps<{
  record: FileRecord
}>()

const emit = defineEmits<{
  download: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const rendering = ref(false)
const loadProgress = ref(0)
const loadError = ref('')
const pageCount = ref(0)
const pageNumber = ref(1)
const pageInput = ref(1)
const scale = ref(1.1)

let pdfDoc: PDFDocumentProxy | null = null
let destroyDoc: (() => Promise<void>) | null = null
let renderToken = 0

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const SCALE_STEP = 0.15

async function waitForCanvas(timeoutMs = 4000): Promise<HTMLCanvasElement> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (canvasRef.value) return canvasRef.value
    await nextTick()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  throw new Error('预览画布未就绪，请重试')
}

async function destroyCurrent() {
  renderToken += 1
  if (destroyDoc) {
    try {
      await destroyDoc()
    } catch {
      // ignore destroy race
    }
  }
  pdfDoc = null
  destroyDoc = null
  pageCount.value = 0
}

async function loadDocument() {
  loading.value = true
  loadError.value = ''
  loadProgress.value = 10
  pageNumber.value = 1
  pageInput.value = 1

  await destroyCurrent()

  try {
    loadProgress.value = 35
    const handle = await loadPdfDocument(props.record.key)
    pdfDoc = handle.pdf
    destroyDoc = handle.destroy
    pageCount.value = handle.pageCount
    loadProgress.value = 70

    // 先结束 loading，确保画布区域可见且 ref 已挂载，再绘制
    loading.value = false
    await nextTick()
    await drawPage(1)
    loadProgress.value = 100
    showAppSuccess(`PDF 已加载（共 ${handle.pageCount} 页）`)
  } catch (error) {
    loadError.value = getErrorMessage(toAppError(error)) || 'PDF 加载失败'
    showAppError(error)
    loading.value = false
  }
}

async function drawPage(targetPage: number) {
  if (!pdfDoc) return
  if (targetPage < 1 || targetPage > pageCount.value) return

  const token = ++renderToken
  rendering.value = true

  try {
    const canvas = await waitForCanvas()
    if (token !== renderToken) return

    await renderPdfPage({
      pdf: pdfDoc,
      pageNumber: targetPage,
      canvas,
      scale: scale.value,
    })
    if (token !== renderToken) return
    pageNumber.value = targetPage
    pageInput.value = targetPage
  } catch (error) {
    if (token !== renderToken) return
    loadError.value = getErrorMessage(toAppError(error)) || '页面渲染失败'
    showAppError(error)
  } finally {
    if (token === renderToken) {
      rendering.value = false
    }
  }
}

async function goPrev() {
  if (pageNumber.value <= 1) return
  await drawPage(pageNumber.value - 1)
}

async function goNext() {
  if (pageNumber.value >= pageCount.value) return
  await drawPage(pageNumber.value + 1)
}

async function jumpToPage() {
  const raw = Number(pageInput.value)
  if (!Number.isFinite(raw)) {
    pageInput.value = pageNumber.value
    return
  }
  const next = Math.min(pageCount.value, Math.max(1, Math.round(raw)))
  pageInput.value = next
  if (next === pageNumber.value) return
  await drawPage(next)
}

async function zoomIn() {
  scale.value = Math.min(MAX_SCALE, Number((scale.value + SCALE_STEP).toFixed(2)))
  await drawPage(pageNumber.value)
}

async function zoomOut() {
  scale.value = Math.max(MIN_SCALE, Number((scale.value - SCALE_STEP).toFixed(2)))
  await drawPage(pageNumber.value)
}

async function resetZoom() {
  scale.value = 1.1
  await drawPage(pageNumber.value)
}

watch(
  () => props.record.key,
  () => {
    void loadDocument()
  },
  { immediate: true },
)

onUnmounted(() => {
  void destroyCurrent()
})
</script>

<template>
  <div class="pdf-preview">
    <div class="pdf-preview__toolbar">
      <div class="pdf-preview__nav">
        <el-button :disabled="loading || pageNumber <= 1" :icon="ArrowLeft" @click="goPrev">
          上一页
        </el-button>
        <div class="pdf-preview__page">
          <el-input-number
            v-model="pageInput"
            :min="1"
            :max="Math.max(1, pageCount)"
            :disabled="loading || pageCount === 0"
            size="small"
            controls-position="right"
            @keyup.enter="jumpToPage"
            @change="jumpToPage"
          />
          <span class="pdf-preview__page-total">/ {{ pageCount || '—' }}</span>
        </div>
        <el-button :disabled="loading || pageNumber >= pageCount" @click="goNext">
          下一页
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div class="pdf-preview__actions">
        <el-button :icon="ZoomOut" circle :disabled="!!loadError || loading" @click="zoomOut" />
        <el-button circle :disabled="!!loadError || loading" @click="resetZoom">
          {{ Math.round(scale * 100) }}%
        </el-button>
        <el-button :icon="ZoomIn" circle :disabled="!!loadError || loading" @click="zoomIn" />
        <el-button :icon="Refresh" circle :loading="loading" @click="loadDocument" />
        <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
      </div>
    </div>

    <el-progress
      v-if="loading"
      :percentage="loadProgress"
      :stroke-width="6"
      striped
      striped-flow
      class="pdf-preview__progress"
    />

    <div v-loading="rendering" class="pdf-preview__stage">
      <el-result v-if="loadError" icon="warning" title="无法预览 PDF" :sub-title="loadError">
        <template #extra>
          <el-button type="primary" :loading="loading" @click="loadDocument">重新加载</el-button>
          <el-button @click="emit('download')">下载后查看</el-button>
        </template>
      </el-result>

      <div v-show="!loadError" class="pdf-preview__canvas-wrap">
        <canvas ref="canvasRef" class="pdf-preview__canvas" />
      </div>
    </div>

    <p class="pdf-preview__hint">
      使用 pdf.js 按页渲染（含中文字体 CMap）。若仍空白请点「重新加载」，或下载原文件查看。
    </p>
  </div>
</template>

<style scoped>
.pdf-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pdf-preview__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pdf-preview__nav,
.pdf-preview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pdf-preview__page {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pdf-preview__page :deep(.el-input-number) {
  width: 96px;
}

.pdf-preview__page-total {
  font-size: 13px;
  color: #606266;
  min-width: 40px;
}

.pdf-preview__progress {
  margin-top: -4px;
}

.pdf-preview__stage {
  min-height: 360px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #e8ebf0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.pdf-preview__canvas-wrap {
  display: flex;
  justify-content: center;
  padding: 16px;
  min-height: 320px;
}

.pdf-preview__canvas {
  display: block;
  max-width: 100%;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.pdf-preview__hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .pdf-preview__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .pdf-preview__nav,
  .pdf-preview__actions {
    justify-content: center;
  }

  .pdf-preview__actions :deep(.el-button) {
    min-height: 40px;
    min-width: 40px;
  }

  .pdf-preview__stage {
    min-height: 280px;
    max-height: 60vh;
  }
}
</style>
