<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Close, Loading } from '@element-plus/icons-vue'
import MobileImagePreviewViewer from '@/components/preview/MobileImagePreviewViewer.vue'
import type { FileRecord } from '@/types/file'

const props = defineProps<{
  modelValue: boolean
  current: FileRecord | null
  gallery: FileRecord[]
  loading?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [record: FileRecord]
  download: []
  closed: []
  retry: []
}>()

function close() {
  emit('update:modelValue', false)
  emit('closed')
}

function onBackdropClick() {
  close()
}

function lockBodyScroll(lock: boolean) {
  document.body.style.overflow = lock ? 'hidden' : ''
}

watch(
  () => props.modelValue,
  (open) => {
    lockBodyScroll(open)
  },
  { immediate: true },
)

onUnmounted(() => {
  lockBodyScroll(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="mobile-image-preview-fade">
      <div
        v-if="modelValue"
        class="mobile-image-preview"
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        @click.self="onBackdropClick"
      >
        <button
          type="button"
          class="mobile-image-preview__close"
          aria-label="关闭"
          @click.stop="close"
        >
          <el-icon :size="22"><Close /></el-icon>
        </button>

        <div v-if="loading || !current" class="mobile-image-preview__boot" @click.stop>
          <div v-if="loading" class="mobile-image-preview__loading">
            <el-icon class="mobile-image-preview__spinner" :size="36"><Loading /></el-icon>
            <span>加载中…</span>
          </div>
          <div v-else-if="errorMessage" class="mobile-image-preview__error">
            <p>{{ errorMessage }}</p>
            <el-button type="primary" size="small" @click="emit('retry')">重试</el-button>
            <el-button size="small" @click="close">关闭</el-button>
          </div>
        </div>

        <MobileImagePreviewViewer
          v-else
          :current="current"
          :gallery="gallery"
          @change="emit('change', $event)"
          @download="emit('download')"
        />

        <p v-if="current && !loading" class="mobile-image-preview__hint" @click.stop>
          左右滑动切换 · 点击空白处关闭
        </p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mobile-image-preview {
  position: fixed;
  inset: 0;
  z-index: 3600;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.92);
  padding:
    calc(10px + var(--safe-top, 0px)) calc(8px + var(--safe-right, 0px))
    calc(8px + var(--safe-bottom, 0px)) calc(8px + var(--safe-left, 0px));
  touch-action: none;
  user-select: none;
}

.mobile-image-preview__close {
  position: absolute;
  top: calc(8px + var(--safe-top, 0px));
  right: calc(8px + var(--safe-right, 0px));
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  touch-action: manipulation;
}

.mobile-image-preview__boot {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-image-preview__loading,
.mobile-image-preview__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: rgba(255, 255, 255, 0.88);
  text-align: center;
  font-size: 14px;
}

.mobile-image-preview__spinner {
  animation: mobile-preview-spin 0.9s linear infinite;
}

@keyframes mobile-preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.mobile-image-preview__hint {
  flex-shrink: 0;
  margin: 0;
  padding: 6px 12px 4px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.mobile-image-preview-fade-enter-active,
.mobile-image-preview-fade-leave-active {
  transition: opacity 0.2s ease;
}

.mobile-image-preview-fade-enter-from,
.mobile-image-preview-fade-leave-to {
  opacity: 0;
}
</style>
