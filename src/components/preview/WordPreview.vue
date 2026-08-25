<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { Download, Refresh } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import { renderDocxToContainer } from '@/services/word'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError, showAppSuccess } from '@/utils/message'

const props = defineProps<{
  record: FileRecord
}>()

const emit = defineEmits<{
  download: []
}>()

const bodyRef = ref<HTMLElement | null>(null)
const styleRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const loadError = ref('')
let renderToken = 0

async function waitForContainer(timeoutMs = 4000): Promise<HTMLElement> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (bodyRef.value) return bodyRef.value
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  throw new Error('预览容器未就绪，请重试')
}

async function loadDocument() {
  const token = ++renderToken
  loading.value = true
  loadError.value = ''

  try {
    const body = await waitForContainer()
    if (token !== renderToken) return
    await renderDocxToContainer({
      key: props.record.key,
      bodyContainer: body,
      styleContainer: styleRef.value ?? undefined,
    })
    if (token !== renderToken) return
    showAppSuccess('Word 文档已加载')
  } catch (error) {
    if (token !== renderToken) return
    if (bodyRef.value) bodyRef.value.innerHTML = ''
    loadError.value = getErrorMessage(toAppError(error)) || 'Word 预览失败'
    showAppError(error)
  } finally {
    if (token === renderToken) {
      loading.value = false
    }
  }
}

watch(
  () => props.record.key,
  () => {
    void loadDocument()
  },
  { immediate: true },
)

onUnmounted(() => {
  renderToken += 1
  if (bodyRef.value) bodyRef.value.innerHTML = ''
  if (styleRef.value) styleRef.value.innerHTML = ''
})
</script>

<template>
  <div class="word-preview">
    <div class="word-preview__toolbar">
      <el-tag size="small" type="info">仅支持 .docx</el-tag>
      <div class="word-preview__actions">
        <el-button :icon="Refresh" circle :loading="loading" @click="loadDocument" />
        <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
      </div>
    </div>

    <div v-loading="loading" class="word-preview__stage">
      <el-result v-if="loadError" icon="warning" title="无法预览 Word" :sub-title="loadError">
        <template #extra>
          <el-button type="primary" :loading="loading" @click="loadDocument">重新加载</el-button>
          <el-button @click="emit('download')">下载后查看</el-button>
        </template>
      </el-result>

      <div v-show="!loadError" class="word-preview__scroll">
        <div ref="styleRef" class="word-preview__styles" />
        <div ref="bodyRef" class="word-preview__body" />
      </div>
    </div>

    <p class="word-preview__hint">
      使用 docx-preview 前端解析（基础排版 / 图片 / 表格）。复杂版式可能与 Word
      不完全一致；预览失败请下载原文件。
    </p>
  </div>
</template>

<style scoped>
.word-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.word-preview__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.word-preview__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.word-preview__stage {
  min-height: 360px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #e8ebf0;
  overflow: hidden;
}

.word-preview__scroll {
  max-height: min(72vh, 900px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 16px;
}

.word-preview__styles {
  display: none;
}

.word-preview__body {
  margin: 0 auto;
}

.word-preview__body :deep(.docx-wrapper) {
  background: transparent;
  padding: 0;
}

.word-preview__body :deep(.docx-wrapper > section.docx) {
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
  margin-bottom: 16px;
  padding: 24px;
  overflow-x: auto;
}

.word-preview__hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .word-preview__scroll {
    max-height: 60vh;
    padding: 10px;
  }

  .word-preview__body :deep(.docx-wrapper > section.docx) {
    padding: 14px;
  }

  .word-preview__actions :deep(.el-button) {
    min-height: 40px;
  }
}
</style>
