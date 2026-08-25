<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CopyDocument, Download, Refresh } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import { loadTextContent, type TextPreviewResult } from '@/services/text'
import { formatBytes } from '@/utils/format'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError, showAppSuccess } from '@/utils/message'

const props = defineProps<{
  record: FileRecord
}>()

const emit = defineEmits<{
  download: []
}>()

const loading = ref(false)
const loadError = ref('')
const preview = ref<TextPreviewResult | null>(null)

const modeLabel = computed(() => {
  const mode = preview.value?.mode
  if (mode === 'json') return preview.value?.jsonFormatted ? 'JSON（已格式化）' : 'JSON'
  if (mode === 'markdown') return 'Markdown'
  if (mode === 'csv') return 'CSV'
  return '纯文本'
})

async function loadDocument() {
  loading.value = true
  loadError.value = ''
  preview.value = null

  try {
    preview.value = await loadTextContent(props.record.key, {
      extension: props.record.extension,
    })
  } catch (error) {
    loadError.value = getErrorMessage(toAppError(error)) || '文本加载失败'
    showAppError(error)
  } finally {
    loading.value = false
  }
}

async function copyContent() {
  if (!preview.value) return
  try {
    await navigator.clipboard.writeText(preview.value.content)
    showAppSuccess('已复制到剪贴板')
  } catch (error) {
    showAppError(error)
  }
}

watch(
  () => props.record.key,
  () => {
    void loadDocument()
  },
  { immediate: true },
)
</script>

<template>
  <div class="text-preview">
    <div class="text-preview__toolbar">
      <el-tag size="small" type="info">{{ modeLabel }}</el-tag>
      <div class="text-preview__actions">
        <el-button :icon="Refresh" circle :loading="loading" @click="loadDocument" />
        <el-button :icon="CopyDocument" circle :disabled="!preview" @click="copyContent" />
        <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
      </div>
    </div>

    <el-alert
      v-if="preview?.truncated"
      type="warning"
      :closable="false"
      show-icon
      class="text-preview__alert"
      :title="`文件较大（${formatBytes(preview.totalBytes)}），仅预览前 ${formatBytes(preview.decodedBytes)}`"
    />

    <el-alert
      v-if="preview?.mode === 'json' && !preview.jsonFormatted && !preview.truncated"
      type="info"
      :closable="false"
      show-icon
      class="text-preview__alert"
      title="JSON 格式无效，已按纯文本展示"
    />

    <div v-loading="loading" class="text-preview__stage">
      <el-result v-if="loadError" icon="warning" title="无法预览文本" :sub-title="loadError">
        <template #extra>
          <el-button type="primary" :loading="loading" @click="loadDocument">重新加载</el-button>
          <el-button @click="emit('download')">下载原文件</el-button>
        </template>
      </el-result>

      <pre v-else-if="preview" class="text-preview__code">{{ preview.content }}</pre>
    </div>

    <p class="text-preview__hint">
      只读预览，UTF-8 解码；单文件最多读取 512 KB。Markdown 暂不渲染样式，仅展示源码。
    </p>
  </div>
</template>

<style scoped>
.text-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.text-preview__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.text-preview__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-preview__alert {
  margin: 0;
}

.text-preview__stage {
  min-height: 280px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #1e1e1e;
  overflow: hidden;
}

.text-preview__code {
  margin: 0;
  padding: 16px;
  max-height: min(72vh, 900px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 13px;
  line-height: 1.55;
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-word;
  tab-size: 2;
}

.text-preview__hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .text-preview__code {
    max-height: 60vh;
    font-size: 12px;
    padding: 12px;
  }

  .text-preview__actions :deep(.el-button) {
    min-height: 40px;
  }
}
</style>
