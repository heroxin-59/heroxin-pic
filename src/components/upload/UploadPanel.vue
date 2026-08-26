<script setup lang="ts">
import { Camera, FolderOpened, UploadFilled } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { getUploadLimits } from '@/config/oss'
import { getDuplicateStrategyLabel } from '@/config/upload'
import { buildAcceptAttribute, filterImageExtensions } from '@/constants/fileTypes'

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

const hintText = computed(() => {
  if (props.tip) return props.tip
  return `支持多选 · 单文件 ≤ ${uploadLimits.maxSizeMb} MB · 本批 ≤ ${uploadLimits.maxTotalSizeMb} MB · 重名：${getDuplicateStrategyLabel()}`
})

const mobileHintText = computed(() => {
  if (props.tip) return props.tip
  return `单文件 ≤ ${uploadLimits.maxSizeMb} MB · 本批 ≤ ${uploadLimits.maxTotalSizeMb} MB`
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
  min-height: 200px;
  padding: 28px 20px;
  border: 1.5px dashed #c0c4cc;
  border-radius: 12px;
  background: #fff;
  color: #606266;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.upload-panel:focus-visible {
  border-color: #409eff;
  outline: none;
}

.upload-panel.is-dragging {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: inset 0 0 0 1px #409eff;
}

.upload-panel.is-disabled {
  cursor: not-allowed;
  opacity: 0.65;
  background: #f5f7fa;
}

.upload-panel.is-mobile {
  cursor: default;
  min-height: auto;
  padding: 20px 16px;
  gap: 12px;
}

.upload-panel__icon {
  color: #909399;
}

.upload-panel.is-dragging .upload-panel__icon {
  color: #409eff;
}

.upload-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  text-align: center;
}

.upload-panel__hint {
  margin: 0;
  font-size: 13px;
  color: #909399;
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
  color: #909399;
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
    border-color: #409eff;
  }

  .upload-panel:not(.is-mobile):hover .upload-panel__icon {
    color: #409eff;
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
