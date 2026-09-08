<script setup lang="ts">
import { Camera, FolderOpened, UploadFilled } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { getUploadLimits } from '@/config/oss'
import { getDuplicateStrategyLabel } from '@/config/upload'
import { buildAcceptAttribute, filterImageExtensions, getCatalogByExt } from '@/constants/fileTypes'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** 是否允许多选 */
    multiple?: boolean
    tip?: string
  }>(),
  {
    disabled: false,
    multiple: true,
    tip: '',
  },
)

const emit = defineEmits<{
  select: [files: File[]]
}>()

const { isMobile } = useBreakpoint()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const cameraInputRef = ref<HTMLInputElement | null>(null)

const uploadLimits = getUploadLimits()

const acceptAttr = computed(() => buildAcceptAttribute(uploadLimits.allowedExt))

const imageExtensions = computed(() => filterImageExtensions(uploadLimits.allowedExt))

const canCaptureImage = computed(() => imageExtensions.value.length > 0)

const allowsVideoUpload = computed(() =>
  uploadLimits.allowedExt.some((ext) => getCatalogByExt(ext)?.category === 'video'),
)

const sizeLimitHint = computed(() => {
  if (allowsVideoUpload.value) {
    return `图片等 ≤ ${uploadLimits.maxSizeMb} MB · 视频 ≤ ${uploadLimits.maxVideoSizeMb} MB`
  }
  return `单文件 ≤ ${uploadLimits.maxSizeMb} MB`
})

const hintText = computed(() => {
  if (props.tip) return props.tip
  return `支持多选 · ${sizeLimitHint.value} · 本批 ≤ ${uploadLimits.maxTotalSizeMb} MB · 重名：${getDuplicateStrategyLabel()}`
})

const mobileHintText = computed(() => {
  if (props.tip) return props.tip
  return `${sizeLimitHint.value} · 本批 ≤ ${uploadLimits.maxTotalSizeMb} MB`
})

function openPicker() {
  if (props.disabled) return
  inputRef.value?.click()
}

function openCamera() {
  if (props.disabled || !canCaptureImage.value) return
  cameraInputRef.value?.click()
}

function emitFiles(fileList: FileList | File[] | null) {
  if (!fileList || props.disabled) return
  const files = Array.from(fileList)
  if (files.length === 0) return
  emit('select', props.multiple ? files : files.slice(0, 1))
}

function onInputChange(event: Event) {
  const input = event.target as HTMLInputElement
  emitFiles(input.files)
  input.value = ''
}

function onCameraChange(event: Event) {
  const input = event.target as HTMLInputElement
  emitFiles(input.files)
  input.value = ''
}

function onDragEnter(event: DragEvent) {
  event.preventDefault()
  if (props.disabled || isMobile.value) return
  dragging.value = true
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (props.disabled || isMobile.value) return
  dragging.value = true
}

function onDragLeave(event: DragEvent) {
  event.preventDefault()
  dragging.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragging.value = false
  if (props.disabled || isMobile.value) return
  emitFiles(event.dataTransfer?.files ?? null)
}

function onPanelClick() {
  if (isMobile.value) return
  openPicker()
}

function onPanelKeydown(event: KeyboardEvent) {
  if (isMobile.value) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openPicker()
  }
}
</script>

<template>
  <div
    class="upload-panel"
    :class="{
      'is-dragging': dragging,
      'is-disabled': disabled,
      'is-mobile': isMobile,
    }"
    :role="isMobile ? undefined : 'button'"
    :tabindex="isMobile || disabled ? undefined : 0"
    @click="onPanelClick"
    @keydown="onPanelKeydown"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <el-icon class="upload-panel__icon" :size="isMobile ? 40 : 48">
      <UploadFilled />
    </el-icon>

    <p class="upload-panel__title">
      {{ isMobile ? '选择或拍摄文件上传' : '点击或拖拽文件到此处上传（支持多选）' }}
    </p>
    <p class="upload-panel__hint">{{ isMobile ? mobileHintText : hintText }}</p>

    <div v-if="!isMobile" class="upload-panel__types">
      <div v-for="group in uploadLimits.allowedTypeGroups" :key="group.category" class="type-group">
        <span class="type-group__label">{{ group.label }}：</span>
        <el-tag
          v-for="ext in group.extensions"
          :key="`${group.category}-${ext}`"
          size="small"
          type="info"
          effect="plain"
        >
          .{{ ext }}
        </el-tag>
      </div>
    </div>

    <div v-if="isMobile" class="upload-panel__mobile-actions">
      <el-button
        v-if="canCaptureImage"
        class="upload-panel__action-btn"
        type="primary"
        size="large"
        :disabled="disabled"
        @click.stop="openCamera"
      >
        <el-icon><Camera /></el-icon>
        拍照上传
      </el-button>
      <el-button
        class="upload-panel__action-btn"
        :type="canCaptureImage ? 'primary' : 'primary'"
        :plain="canCaptureImage"
        size="large"
        :disabled="disabled"
        @click.stop="openPicker"
      >
        <el-icon><FolderOpened /></el-icon>
        {{ multiple ? '选择文件（可多选）' : '选择文件' }}
      </el-button>
    </div>

    <el-button v-else type="primary" :disabled="disabled" @click.stop="openPicker">
      {{ multiple ? '选择文件（可多选）' : '选择文件' }}
    </el-button>

    <input
      ref="inputRef"
      class="upload-panel__input"
      type="file"
      :accept="acceptAttr"
      :multiple="multiple"
      :disabled="disabled"
      @change="onInputChange"
      @click.stop
    />

    <input
      v-if="canCaptureImage"
      ref="cameraInputRef"
      class="upload-panel__input"
      type="file"
      accept="image/*"
      capture="environment"
      :disabled="disabled"
      @change="onCameraChange"
      @click.stop
    />
  </div>
</template>

<style scoped>
.upload-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 220px;
  padding: 32px 22px;
  border: 1.5px dashed color-mix(in srgb, var(--brand-primary) 28%, var(--app-border));
  border-radius: 14px;
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--app-surface) 92%, transparent) 0%,
      color-mix(in srgb, var(--brand-primary-soft) 55%, var(--app-surface)) 100%
    );
  color: var(--app-text-secondary);
  cursor: pointer;
  box-shadow: var(--app-shadow);
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.upload-panel:focus-visible {
  border-color: var(--brand-primary);
  outline: none;
  box-shadow: var(--app-shadow-lift);
}

.upload-panel.is-dragging {
  border-color: var(--brand-primary);
  background: var(--brand-primary-soft);
  box-shadow: inset 0 0 0 1px var(--brand-primary), var(--app-shadow-lift);
}

.upload-panel.is-disabled {
  cursor: not-allowed;
  opacity: 0.65;
  background: var(--app-surface-muted);
  box-shadow: none;
}

.upload-panel.is-mobile {
  cursor: default;
  min-height: auto;
  padding: 20px 16px;
  gap: 12px;
}

.upload-panel__icon {
  color: var(--app-text-muted);
}

.upload-panel.is-dragging .upload-panel__icon {
  color: var(--brand-primary);
}

.upload-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text);
  text-align: center;
}

.upload-panel__hint {
  margin: 0;
  font-size: 13px;
  color: var(--app-text-muted);
  text-align: center;
  line-height: 1.5;
}

.upload-panel__types {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.type-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  justify-content: center;
}

.type-group__label {
  font-size: 12px;
  color: var(--app-text-muted);
}

.upload-panel__mobile-actions {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.upload-panel__action-btn {
  width: 100%;
  margin-left: 0;
  min-height: 48px;
  font-size: 16px;
  touch-action: manipulation;
}

/* Element Plus 默认给相邻按钮加 margin-left，竖排时会错位 */
.upload-panel__mobile-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.upload-panel__action-btn .el-icon {
  margin-right: 6px;
}

.upload-panel__input {
  display: none;
}

@media (hover: hover) and (pointer: fine) {
  .upload-panel:not(.is-mobile):hover {
    border-color: var(--brand-primary);
    box-shadow: var(--app-shadow-lift);
    transform: translateY(-1px);
  }

  .upload-panel:not(.is-mobile):hover .upload-panel__icon {
    color: var(--brand-primary);
  }
}

@media (max-width: 767px) {
  .upload-panel__title {
    font-size: 15px;
  }

  .upload-panel__hint {
    font-size: 12px;
  }
}
</style>
