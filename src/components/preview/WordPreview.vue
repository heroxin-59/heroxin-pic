<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { DocPreview } from '@zhenghy/doc-preview'
import '@zhenghy/doc-preview/dist/style.css'
import { Download, Refresh } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import { isDocFile, loadDocFileFromOss, releaseDocFileFromOss, renderDocxToContainer } from '@/services/word'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError } from '@/utils/message'

const props = defineProps<{
  record: FileRecord
}>()

const emit = defineEmits<{
  download: []
}>()

const bodyRef = ref<HTMLElement | null>(null)
const styleRef = ref<HTMLElement | null>(null)
const docPreviewRef = ref<InstanceType<typeof DocPreview> | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const loadError = ref('')
const hasContent = ref(false)
const docSource = ref<File | null>(null)
let renderToken = 0
let heldLegacyKey: string | null = null

function releaseHeldLegacyDoc() {
  if (heldLegacyKey) {
    releaseDocFileFromOss(heldLegacyKey)
    heldLegacyKey = null
  }
}

const isLegacyDoc = computed(() => isDocFile(props.record.extension || props.record.name))

async function waitForContainer(timeoutMs = 4000): Promise<HTMLElement> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (bodyRef.value) return bodyRef.value
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  throw new Error('预览容器未就绪，请重试')
}

async function loadLegacyDoc(options: { soft?: boolean } = {}) {
  const token = ++renderToken
  loading.value = true
  loadError.value = ''
  if (!options.soft) {
    releaseHeldLegacyDoc()
    docSource.value = null
  }

  try {
    const file = await loadDocFileFromOss(props.record.key, props.record.name)
    if (token !== renderToken) {
      releaseDocFileFromOss(props.record.key)
      return
    }
    releaseHeldLegacyDoc()
    heldLegacyKey = props.record.key
    docSource.value = file
    hasContent.value = true
  } catch (error) {
    if (token !== renderToken) return
    docSource.value = null
    hasContent.value = false
    loadError.value = getErrorMessage(toAppError(error)) || 'Word 预览失败'
    showAppError(error)
  } finally {
    if (token === renderToken) {
      loading.value = false
    }
  }
}

async function loadDocx(options: { soft?: boolean } = {}) {
  const soft = Boolean(options.soft && hasContent.value)
  const token = ++renderToken
  loading.value = true
  loadError.value = ''

  try {
    const body = await waitForContainer()
    if (token !== renderToken) return

    if (soft) {
      const tempBody = document.createElement('div')
      const tempStyle = document.createElement('div')
      await renderDocxToContainer({
        key: props.record.key,
        bodyContainer: tempBody,
        styleContainer: tempStyle,
      })
      if (token !== renderToken) return
      body.replaceChildren(...Array.from(tempBody.childNodes))
      if (styleRef.value) {
        styleRef.value.replaceChildren(...Array.from(tempStyle.childNodes))
      }
    } else {
      await renderDocxToContainer({
        key: props.record.key,
        bodyContainer: body,
        styleContainer: styleRef.value ?? undefined,
      })
      if (token !== renderToken) return
    }

    hasContent.value = true
  } catch (error) {
    if (token !== renderToken) return
    if (!soft && bodyRef.value) bodyRef.value.innerHTML = ''
    if (!soft && styleRef.value) styleRef.value.innerHTML = ''
    if (!soft) hasContent.value = false
    loadError.value = getErrorMessage(toAppError(error)) || 'Word 预览失败'
    showAppError(error)
  } finally {
    if (token === renderToken) {
      loading.value = false
    }
  }
}

async function loadDocument(options: { soft?: boolean } = {}) {
  if (isLegacyDoc.value) {
    await loadLegacyDoc(options)
  } else {
    await loadDocx(options)
  }
}

async function onReload() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    if (isLegacyDoc.value) {
      docPreviewRef.value?.reload?.()
      if (!docSource.value) {
        await loadLegacyDoc()
      }
    } else {
      await loadDocument({ soft: true })
    }
  } finally {
    refreshing.value = false
  }
}

function onLegacyDocError(message: string) {
  loadError.value = message || 'Word (.doc) 解析失败'
  hasContent.value = false
}

watch(
  () => props.record.key,
  () => {
    hasContent.value = false
    releaseHeldLegacyDoc()
    docSource.value = null
    void loadDocument()
  },
  { immediate: true },
)

onUnmounted(() => {
  renderToken += 1
  releaseHeldLegacyDoc()
  docSource.value = null
  if (bodyRef.value) bodyRef.value.innerHTML = ''
  if (styleRef.value) styleRef.value.innerHTML = ''
})
</script>

<template>
  <div class="word-preview">
    <div class="word-preview__toolbar">
      <el-tag size="small" type="info">
        {{ isLegacyDoc ? 'Word (.doc)' : 'Word (.docx)' }}
      </el-tag>
      <div class="word-preview__actions">
        <el-button
          :icon="Refresh"
          circle
          :loading="refreshing"
          :disabled="loading && !hasContent"
          @click="onReload"
        />
        <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
      </div>
    </div>

    <div
      v-loading="loading && !loadError"
      element-loading-text="加载中…"
      element-loading-background="rgba(255, 255, 255, 0.55)"
      class="word-preview__stage"
      :class="{ 'word-preview__stage--legacy': isLegacyDoc }"
    >
      <el-result
        v-if="loadError && !hasContent"
        icon="warning"
        title="无法预览 Word"
        :sub-title="loadError"
      >
        <template #extra>
          <el-button type="primary" :loading="refreshing || loading" @click="onReload"
            >重新加载</el-button
          >
          <el-button @click="emit('download')">下载后查看</el-button>
        </template>
      </el-result>

      <div v-else-if="isLegacyDoc" class="word-preview__legacy">
        <DocPreview
          v-if="docSource"
          ref="docPreviewRef"
          :source="docSource"
          @error="onLegacyDocError"
        />
      </div>

      <div v-else v-show="hasContent || !loadError" class="word-preview__scroll">
        <div ref="styleRef" class="word-preview__styles" />
        <div ref="bodyRef" class="word-preview__body" />
      </div>
    </div>

    <p class="word-preview__hint">
      <template v-if="isLegacyDoc">
        使用 @zhenghy/doc-preview 解析 Word 97-2003（.doc）；复杂版式 / 图片可能不完整，失败请下载原文件。
      </template>
      <template v-else>
        使用 docx-preview 前端解析（基础排版 / 图片 / 表格）。复杂版式可能与 Word
        不完全一致；预览失败请下载原文件。
      </template>
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
  position: relative;
  min-height: 360px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.word-preview__stage--legacy {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.word-preview__legacy {
  max-height: min(72vh, 900px);
  overflow: auto;
}

.word-preview__legacy :deep(.doc-preview) {
  min-height: 320px;
  border-radius: 0;
  box-shadow: none;
}

.word-preview__scroll {
  max-height: min(72vh, 900px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 16px;
}

.word-preview__styles {
  display: none;
}

.word-preview__body {
  margin: 0 auto;
}

.word-preview__body :deep(.docx-preview-wrapper) {
  background: #fff !important;
  padding: 0 !important;
  display: flex;
  flex-flow: column;
  align-items: stretch;
}

.word-preview__body :deep(.docx-preview-wrapper > section.docx-preview) {
  background: #fff;
  box-shadow: none;
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
  .word-preview__scroll,
  .word-preview__legacy {
    max-height: 60vh;
  }

  .word-preview__scroll {
    padding: 10px;
  }

  .word-preview__body :deep(.docx-preview-wrapper > section.docx-preview) {
    padding: 14px;
  }

  .word-preview__actions :deep(.el-button) {
    min-height: 40px;
  }
}
</style>
