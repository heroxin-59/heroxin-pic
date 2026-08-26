<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { Download, Refresh, ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FileRecord } from '@/types/file'
import { loadPdfDocument, renderPdfPage } from '@/services/pdf'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError } from '@/utils/message'

const props = defineProps<{
  record: FileRecord
}>()

const emit = defineEmits<{
  download: []
}>()

const pagesWrapRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const rendering = ref(false)
const loadProgress = ref(0)
const loadError = ref('')
const pageCount = ref(0)
const scale = ref(1.1)
/** 是否已有可展示内容（软刷新时保留画布） */
const hasDocument = ref(false)
/** 用于 v-for 生成与页数一致的 canvas */
const pageIndexes = ref<number[]>([])

let pdfDoc: PDFDocumentProxy | null = null
let destroyDoc: (() => Promise<void>) | null = null
let renderToken = 0

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const SCALE_STEP = 0.15

async function waitForCanvases(count: number, timeoutMs = 4000): Promise<HTMLCanvasElement[]> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const wrap = pagesWrapRef.value
    const list = wrap ? Array.from(wrap.querySelectorAll('canvas.pdf-preview__canvas')) : []
    if (list.length >= count) {
      return list as HTMLCanvasElement[]
    }
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
  pageIndexes.value = []
  hasDocument.value = false
}

async function drawAllPages() {
  if (!pdfDoc || pageCount.value < 1) return

  const token = ++renderToken
  rendering.value = true

  try {
    const canvases = await waitForCanvases(pageCount.value)
    if (token !== renderToken) return

    for (let i = 0; i < pageCount.value; i += 1) {
      if (token !== renderToken) return
      const canvas = canvases[i]
      if (!canvas) continue
      await renderPdfPage({
        pdf: pdfDoc,
        pageNumber: i + 1,
        canvas,
        scale: scale.value,
      })
      // 多页时更新进度条感观（软刷新无总 loading）
      if (loading.value) {
        loadProgress.value = Math.min(99, 70 + Math.round(((i + 1) / pageCount.value) * 25))
      }
    }
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

async function loadDocument(options: { soft?: boolean } = {}) {
  const soft = Boolean(options.soft && hasDocument.value && pdfDoc)
  const previousDestroy = destroyDoc

  loading.value = true
  loadError.value = ''
  if (!soft) {
    loadProgress.value = 10
    await destroyCurrent()
  } else {
    loadProgress.value = 0
  }

  try {
    if (!soft) loadProgress.value = 35
    const handle = await loadPdfDocument(props.record.key)
    pdfDoc = handle.pdf
    destroyDoc = handle.destroy
    pageCount.value = handle.pageCount
    pageIndexes.value = Array.from({ length: handle.pageCount }, (_, i) => i + 1)
    hasDocument.value = true
    if (!soft) loadProgress.value = 70

    // 先结束主 loading，确保 canvas 挂载后再绘制
    loading.value = false
    await nextTick()
    try {
      await drawAllPages()
      if (!soft) loadProgress.value = 100
    } finally {
      if (soft && previousDestroy && previousDestroy !== destroyDoc) {
        try {
          await previousDestroy()
        } catch {
          // ignore old doc cleanup
        }
      }
    }
  } catch (error) {
    loadError.value = getErrorMessage(toAppError(error)) || 'PDF 加载失败'
    showAppError(error)
    loading.value = false
    if (!soft) {
      hasDocument.value = false
      pageIndexes.value = []
    }
  }
}

async function onReload() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await loadDocument({ soft: true })
  } finally {
    refreshing.value = false
  }
}

async function zoomIn() {
  scale.value = Math.min(MAX_SCALE, Number((scale.value + SCALE_STEP).toFixed(2)))
  await drawAllPages()
}

async function zoomOut() {
  scale.value = Math.max(MIN_SCALE, Number((scale.value - SCALE_STEP).toFixed(2)))
  await drawAllPages()
}

async function resetZoom() {
  scale.value = 1.1
  await drawAllPages()
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
      <div class="pdf-preview__meta">
        <el-tag size="small" type="info">共 {{ pageCount || '—' }} 页</el-tag>
        <span class="pdf-preview__meta-hint">连续预览，滚轮下滑查看</span>
      </div>

      <div class="pdf-preview__actions">
        <el-button :icon="ZoomOut" circle :disabled="!!loadError || loading" @click="zoomOut" />
        <el-button circle :disabled="!!loadError || loading" @click="resetZoom">
          {{ Math.round(scale * 100) }}%
        </el-button>
        <el-button :icon="ZoomIn" circle :disabled="!!loadError || loading" @click="zoomIn" />
        <el-button
          :icon="Refresh"
          circle
          :loading="refreshing"
          :disabled="loading && !hasDocument"
          @click="onReload"
        />
        <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
      </div>
    </div>

    <el-progress
      v-if="loading && !hasDocument"
      :percentage="loadProgress"
      :stroke-width="6"
      striped
      striped-flow
      class="pdf-preview__progress"
    />

    <div
      v-loading="(loading || rendering) && !loadError"
      element-loading-text="加载中…"
      element-loading-background="rgba(255, 255, 255, 0.55)"
      class="pdf-preview__stage"
    >
      <el-result
        v-if="loadError && !hasDocument"
        icon="warning"
        title="无法预览 PDF"
        :sub-title="loadError"
      >
        <template #extra>
          <el-button type="primary" :loading="refreshing || loading" @click="onReload"
            >重新加载</el-button
          >
          <el-button @click="emit('download')">下载后查看</el-button>
        </template>
      </el-result>

      <div v-show="hasDocument || !loadError" ref="pagesWrapRef" class="pdf-preview__pages">
        <canvas
          v-for="page in pageIndexes"
          :key="`${record.key}-${page}`"
          class="pdf-preview__canvas"
        />
      </div>
    </div>

    <p class="pdf-preview__hint">
      使用 pdf.js 连续渲染全部页面（含中文字体 CMap）。若仍空白请点「重新加载」，或下载原文件查看。
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

.pdf-preview__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.pdf-preview__meta-hint {
  font-size: 12px;
  color: #909399;
}

.pdf-preview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pdf-preview__progress {
  margin-top: -4px;
}

.pdf-preview__stage {
  position: relative;
  min-height: 360px;
  max-height: min(72vh, 900px);
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #e8ebf0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.pdf-preview__pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
  min-height: 320px;
}

.pdf-preview__canvas {
  display: block;
  max-width: 100%;
  height: auto;
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

  .pdf-preview__pages {
    gap: 12px;
    padding: 10px;
  }
}
</style>
