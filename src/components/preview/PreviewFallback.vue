<script setup lang="ts">
import { computed } from 'vue'
import { Download } from '@element-plus/icons-vue'
import FileTypeIcon from '@/components/file-list/FileTypeIcon.vue'
import { getCategoryLabel } from '@/constants/fileTypes'
import type { FileRecord } from '@/types/file'
import type { PreviewType } from '@/types/preview'
import { formatBytes } from '@/utils/format'

const props = defineProps<{
  record: FileRecord
  kind: PreviewType
}>()

const emit = defineEmits<{
  download: []
}>()

const kindHint: Record<PreviewType, string> = {
  image: '',
  pdf: 'PDF 预览失败或未启用时，请下载后查看',
  word: 'Word 预览失败时，请下载后查看',
  text: '文本预览失败时，请下载后查看',
  unsupported: '该类型暂不支持在线预览',
}

const hintText = computed(() => {
  const ext = props.record.extension.toLowerCase()
  if (ext === 'doc') {
    return '暂不支持 .doc 老格式在线预览，请下载后用 Word 打开，或转换为 .docx 后再上传'
  }
  return kindHint[props.kind]
})
</script>

<template>
  <div class="preview-fallback">
    <FileTypeIcon :category="record.category" :size="48" />
    <h3 class="preview-fallback__name">{{ record.name }}</h3>
    <p class="preview-fallback__meta">
      {{ getCategoryLabel(record.category) }}
      <template v-if="record.size"> · {{ formatBytes(record.size) }}</template>
    </p>
    <p class="preview-fallback__hint">{{ hintText }}</p>
    <p class="preview-fallback__key">{{ record.key }}</p>
    <el-button type="primary" size="large" :icon="Download" @click="emit('download')">
      下载原文件
    </el-button>
  </div>
</template>

<style scoped>
.preview-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 20px;
  text-align: center;
}

.preview-fallback__name {
  margin: 8px 0 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  word-break: break-all;
}

.preview-fallback__meta {
  margin: 0;
  font-size: 13px;
  color: #606266;
}

.preview-fallback__hint {
  margin: 4px 0 0;
  font-size: 14px;
  color: #909399;
}

.preview-fallback__key {
  margin: 0 0 8px;
  max-width: 100%;
  font-size: 12px;
  color: #a8abb2;
  word-break: break-all;
}

.preview-fallback :deep(.el-button) {
  min-height: 44px;
  touch-action: manipulation;
}
</style>
