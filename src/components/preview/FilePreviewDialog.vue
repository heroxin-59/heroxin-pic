<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ImagePreview from '@/components/preview/ImagePreview.vue'
import PdfPreview from '@/components/preview/PdfPreview.vue'
import TextPreview from '@/components/preview/TextPreview.vue'
import WordPreview from '@/components/preview/WordPreview.vue'
import PreviewFallback from '@/components/preview/PreviewFallback.vue'
import { getCategoryLabel, getCategoryTagType } from '@/constants/fileTypes'
import { getPreviewKind, openPreviewDownload, resolvePreviewRecord } from '@/services/preview'
import { useFileStore } from '@/stores/files'
import type { FileRecord } from '@/types/file'
import { formatBytes } from '@/utils/format'
import { showAppError, showAppSuccess } from '@/utils/message'

const props = defineProps<{
  modelValue: boolean
  /** 打开弹窗时要预览的文件；关闭后可清空 */
  record: FileRecord | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:record': [value: FileRecord | null]
}>()

const fileStore = useFileStore()
const { records } = storeToRefs(fileStore)

const loading = ref(false)
const errorMessage = ref('')
const current = ref<FileRecord | null>(null)

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const previewKind = computed(() => (current.value ? getPreviewKind(current.value) : null))

const imageGallery = computed(() => {
  const images = records.value.filter((item) => item.category === 'image')
  if (!current.value || current.value.category !== 'image') return images
  if (!images.some((item) => item.key === current.value!.key)) {
    return [current.value, ...images]
  }
  return images
})

const dialogTitle = computed(() => current.value?.name || props.record?.name || '文件预览')

async function loadPreview(source: FileRecord) {
  loading.value = true
  errorMessage.value = ''
  try {
    current.value = await resolvePreviewRecord({
      key: source.key,
      name: source.name,
    })
  } catch (error) {
    current.value = null
    errorMessage.value = '无法加载预览'
    showAppError(error)
  } finally {
    loading.value = false
  }
}

function onChangeImage(next: FileRecord) {
  current.value = next
  emit('update:record', next)
}

async function onDownload() {
  if (!current.value) return
  try {
    await openPreviewDownload(current.value)
    showAppSuccess('已开始下载')
  } catch (error) {
    showAppError(error)
  }
}

function closeDialog() {
  visible.value = false
}

function onClosed() {
  current.value = null
  errorMessage.value = ''
  loading.value = false
  emit('update:record', null)
}

watch(
  () => [props.modelValue, props.record?.key] as const,
  ([open, key]) => {
    if (open && props.record && key) {
      void loadPreview(props.record)
    }
  },
)
</script>

<template>
  <el-dialog
    v-model="visible"
    class="file-preview-dialog"
    :title="dialogTitle"
    width="94%"
    append-to-body
    destroy-on-close
    align-center
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    @closed="onClosed"
  >
    <template #header>
      <div class="file-preview-dialog__heading">
        <span class="file-preview-dialog__title" :title="dialogTitle">{{ dialogTitle }}</span>
        <!-- 文本预览自带类型/大小/编码标签，避免拆成两行 -->
        <div v-if="current && previewKind !== 'text'" class="file-preview-dialog__tags">
          <el-tag size="small" :type="getCategoryTagType(current.category)">{{
            getCategoryLabel(current.category)
          }}</el-tag>
          <el-tag v-if="current.size" size="small" type="success">
            {{ formatBytes(current.size) }}
          </el-tag>
        </div>
      </div>
    </template>

    <div v-if="loading" v-loading="true" class="file-preview-dialog__loading" />

    <el-result
      v-else-if="errorMessage || !current"
      icon="error"
      :title="errorMessage || '预览失败'"
    >
      <template #extra>
        <el-button v-if="record" type="primary" @click="loadPreview(record)">重试</el-button>
        <el-button @click="closeDialog">关闭</el-button>
      </template>
    </el-result>

    <ImagePreview
      v-else-if="previewKind === 'image'"
      :current="current"
      :gallery="imageGallery"
      @change="onChangeImage"
      @download="onDownload"
    />

    <PdfPreview v-else-if="previewKind === 'pdf'" :record="current" @download="onDownload" />

    <WordPreview v-else-if="previewKind === 'word'" :record="current" @download="onDownload" />

    <TextPreview v-else-if="previewKind === 'text'" :record="current" @download="onDownload" />

    <PreviewFallback
      v-else
      :record="current"
      :kind="previewKind || 'unsupported'"
      @download="onDownload"
    />
  </el-dialog>
</template>

<style scoped>
.file-preview-dialog__heading {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-right: 28px;
}

.file-preview-dialog__title {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(100%, 420px);
}

.file-preview-dialog__tags {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
}

.file-preview-dialog__loading {
  min-height: 280px;
}
</style>

<style>
/* append-to-body：强制相对视口垂直水平居中，避免内容少时贴底 */
.el-overlay-dialog:has(> .file-preview-dialog) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview-dialog.el-dialog {
  margin: 0 !important;
  max-width: 960px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}

.file-preview-dialog .el-dialog__body {
  overflow: auto;
  max-height: calc(92vh - 72px);
  padding-top: 8px;
}

@media (max-width: 767px) {
  .el-overlay-dialog:has(> .file-preview-dialog) {
    align-items: stretch;
  }

  .file-preview-dialog.el-dialog {
    width: 100vw !important;
    max-width: 100vw;
    margin: 0 !important;
    border-radius: 0;
    max-height: 100dvh;
    height: 100dvh;
  }

  .file-preview-dialog .el-dialog__body {
    max-height: none;
    flex: 1;
    overflow: auto;
  }
}
</style>
