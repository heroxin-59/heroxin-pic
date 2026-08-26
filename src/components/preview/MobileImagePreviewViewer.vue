<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { Download, Loading } from '@element-plus/icons-vue'
import { useImagePreviewLoader } from '@/composables/useImagePreviewLoader'
import type { FileRecord } from '@/types/file'

const props = defineProps<{
  current: FileRecord
  gallery: FileRecord[]
}>()

const emit = defineEmits<{
  change: [record: FileRecord]
  download: []
}>()

const currentRef = toRef(props, 'current')
const galleryRef = toRef(props, 'gallery')

const {
  loadError,
  refreshing,
  imageUrl,
  imageEpoch,
  currentIndex,
  hasPrev,
  hasNext,
  showStageLoading,
  switching,
  onImageLoad,
  onImageError,
  onReload,
  goPrev,
  goNext,
} = useImagePreviewLoader(currentRef, galleryRef, (record) => emit('change', record))

const dragOffset = ref(0)

let touchStartX = 0
let touchStartY = 0
let touchActive = false

const counterText = computed(() => {
  const total = props.gallery.length || 1
  const index = currentIndex.value >= 0 ? currentIndex.value + 1 : 1
  return `${index} / ${total}`
})

const imageStyle = computed(() => ({
  transform: `translateX(${dragOffset.value}px)`,
  opacity: switching.value ? 0.75 : 1,
  transition: dragOffset.value === 0 ? 'transform 0.22s ease, opacity 0.18s ease' : 'none',
}))

function onTouchStart(event: TouchEvent) {
  if (loadError.value || showStageLoading.value) return
  const touch = event.touches[0]
  if (!touch) return
  touchActive = true
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  dragOffset.value = 0
}

function onTouchMove(event: TouchEvent) {
  if (!touchActive) return
  const touch = event.touches[0]
  if (!touch) return
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
    touchActive = false
    dragOffset.value = 0
    return
  }
  if ((dx > 0 && !hasPrev.value) || (dx < 0 && !hasNext.value)) {
    dragOffset.value = dx * 0.35
    return
  }
  dragOffset.value = dx
}

function onTouchEnd(event: TouchEvent) {
  if (!touchActive) return
  touchActive = false
  const touch = event.changedTouches[0]
  if (!touch) {
    dragOffset.value = 0
    return
  }
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  dragOffset.value = 0

  if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return

  if (dx > 0 && hasPrev.value) goPrev()
  else if (dx < 0 && hasNext.value) goNext()
}
</script>

<template>
  <div class="mobile-image-preview__body">
    <header class="mobile-image-preview__top">
      <span class="mobile-image-preview__counter">{{ counterText }}</span>
      <button
        type="button"
        class="mobile-image-preview__icon-btn"
        aria-label="下载"
        @click="emit('download')"
      >
        <el-icon :size="20"><Download /></el-icon>
      </button>
    </header>

    <div
      class="mobile-image-preview__stage"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend.passive="onTouchEnd"
      @touchcancel.passive="onTouchEnd"
    >
      <div v-if="showStageLoading" class="mobile-image-preview__loading">
        <el-icon class="mobile-image-preview__spinner" :size="36"><Loading /></el-icon>
        <span>加载中…</span>
      </div>

      <div v-else-if="loadError" class="mobile-image-preview__error">
        <p>{{ loadError }}</p>
        <el-button type="primary" size="small" :loading="refreshing" @click="onReload">
          重新加载
        </el-button>
        <el-button size="small" @click="emit('download')">下载原文件</el-button>
      </div>

      <img
        v-else-if="imageUrl"
        :key="imageEpoch"
        class="mobile-image-preview__img"
        :src="imageUrl"
        :alt="current.name"
        :style="imageStyle"
        draggable="false"
        @load="onImageLoad"
        @error="onImageError"
      />
    </div>
  </div>
</template>

<style scoped>
.mobile-image-preview__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-right: 44px;
}

.mobile-image-preview__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 4px 4px 6px;
  color: #fff;
}

.mobile-image-preview__counter {
  font-size: 14px;
  font-weight: 500;
  opacity: 0.92;
}

.mobile-image-preview__icon-btn {
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

.mobile-image-preview__stage {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
}

.mobile-image-preview__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  will-change: transform;
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
</style>
