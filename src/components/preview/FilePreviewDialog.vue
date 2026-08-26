<script setup lang="ts">
import { computed, watch } from 'vue'
import ImagePreview from '@/components/preview/ImagePreview.vue'
import MobileImagePreview from '@/components/preview/MobileImagePreview.vue'
import { AsyncPdfPreview, AsyncWordPreview } from '@/components/preview/asyncPreview'
import TextPreview from '@/components/preview/TextPreview.vue'
import PreviewFallback from '@/components/preview/PreviewFallback.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useFilePreview } from '@/composables/useFilePreview'
import { getCategoryLabel, getCategoryTagType } from '@/constants/fileTypes'
import type { FileRecord } from '@/types/file'
import { formatBytes } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  /** 打开弹窗时要预览的文件；关闭后可清空 */
  record: FileRecord | null
  /**
   * 可选：限定图片左右切换范围（如「仅图片」相册当前列表）。
   * 不传则使用 store 中全部已加载图片。
   */
  gallery?: FileRecord[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:record': [value: FileRecord | null]
}>()

const { isMobile } = useBreakpoint()

const {
  current,
  loading,
  errorMessage,
  previewKind,
  imageGallery,
  load,
  setCurrent,
  clear,
  download,
} = useFilePreview({
  gallery: () => props.gallery,
})

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

/** 移动端图片走全屏沉浸预览，非图片仍用对话框 */
const useMobileImagePreview = computed(
  () => isMobile.value && props.record?.category === 'image',
)

const dialogTitle = computed(() => current.value?.name || props.record?.name || '文件预览')

function onChangeImage(next: FileRecord) {
  setCurrent(next)
  emit('update:record', next)
}

function closeDialog() {
  visible.value = false
}

function onClosed() {
  clear()
  emit('update:record', null)
}

function onMobileClosed() {
  onClosed()
}

function onRetry() {
  if (props.record) void load(props.record)
}

watch(
  () => [props.modelValue, props.record?.key] as const,
  ([open, key]) => {
    if (!open || !props.record || !key) return
    // 左右切换已在 onChangeImage 同步 current，勿整页 loading 卸载预览（会闪白）
    if (current.value?.key === key) return
    void load(props.record)
  },
)
</script>

<template>
  <MobileImagePreview
    v-if="useMobileImagePreview && visible"
    v-model="visible"
    :current="current"
    :gallery="imageGallery"
    :loading="loading"
    :error-message="errorMessage"
    @change="onChangeImage"
    @download="download"
    @closed="onMobileClosed"
    @retry="onRetry"
  />

  <el-dialog
    v-else-if="visible"
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
        <el-button v-if="record" type="primary" @click="load(record)">重试</el-button>
        <el-button @click="closeDialog">关闭</el-button>
      </template>
    </el-result>

    <ImagePreview
      v-else-if="previewKind === 'image'"
      :current="current"
      :gallery="imageGallery"
      @change="onChangeImage"
      @download="download"
    />

    <AsyncPdfPreview v-else-if="previewKind === 'pdf'" :record="current" @download="download" />

    <AsyncWordPreview v-else-if="previewKind === 'word'" :record="current" @download="download" />

    <TextPreview v-else-if="previewKind === 'text'" :record="current" @download="download" />

    <PreviewFallback
      v-else
      :record="current"
      :kind="previewKind || 'unsupported'"
      @download="download"
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
