<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Download, Loading } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import {
  acquireVideoAlbumThumb,
  releaseVideoAlbumThumb,
} from '@/services/videoAlbumThumb'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError } from '@/utils/message'

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

const PREVIEW_BG_OPACITY = 0.55
const PREVIEW_HISTORY_STATE = 'heroxin-mobile-video-preview'
const SWIPE_THRESHOLD = 50

const videoUrl = ref('')
const bootLoading = ref(false)
const bootError = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)

let heldKey: string | null = null
let loadToken = 0
let previewHistoryActive = false
let previewHistoryGeneration = 0
let activePreviewHistoryGeneration = 0
let closingPreviewFromHistory = false
let savedScrollY = 0
let previousScrollRestoration: ScrollRestoration | undefined
let touchStartX = 0
let touchStartY = 0

const galleryList = computed(() => {
  if (props.gallery.length > 0) return props.gallery
  return props.current ? [props.current] : []
})

const currentIndex = computed(() => {
  if (!props.current) return -1
  return galleryList.value.findIndex((item) => item.key === props.current!.key)
})

const counterText = computed(() => {
  const total = galleryList.value.length
  if (total <= 1 || currentIndex.value < 0) return ''
  return `${currentIndex.value + 1} / ${total}`
})

const showBootOverlay = computed(
  () =>
    props.modelValue &&
    (props.loading || bootLoading.value || bootError.value || props.errorMessage || !props.current),
)

function savePageScroll() {
  savedScrollY = window.scrollY || document.documentElement.scrollTop || 0
}

function restorePageScroll() {
  const top = savedScrollY
  requestAnimationFrame(() => {
    window.scrollTo({ top, left: 0, behavior: 'instant' })
    requestAnimationFrame(() => {
      window.scrollTo({ top, left: 0, behavior: 'instant' })
    })
  })
}

function enablePreviewHistory() {
  if (previewHistoryActive) return
  savePageScroll()
  if ('scrollRestoration' in history) {
    previousScrollRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
  }
  activePreviewHistoryGeneration = ++previewHistoryGeneration
  history.pushState({ [PREVIEW_HISTORY_STATE]: activePreviewHistoryGeneration }, '')
  previewHistoryActive = true
  window.addEventListener('popstate', handlePreviewPopState)
}

function disablePreviewHistory(fromBrowserBack = false) {
  window.removeEventListener('popstate', handlePreviewPopState)
  if (!previewHistoryActive) return

  const ourGeneration = activePreviewHistoryGeneration
  previewHistoryActive = false
  activePreviewHistoryGeneration = 0

  if ('scrollRestoration' in history && previousScrollRestoration !== undefined) {
    history.scrollRestoration = previousScrollRestoration
    previousScrollRestoration = undefined
  }

  if (!fromBrowserBack && ourGeneration > 0) {
    const state = history.state as Record<string, unknown> | null
    if (state?.[PREVIEW_HISTORY_STATE] === ourGeneration) {
      history.back()
    }
  }

  restorePageScroll()
}

function handlePreviewPopState() {
  if (!previewHistoryActive) return
  closingPreviewFromHistory = true
  disablePreviewHistory(true)
  closePreview(false)
}

function pauseVideo() {
  const el = videoRef.value
  if (!el) return
  el.pause()
}

function releaseHeldUrl() {
  if (heldKey) {
    releaseVideoAlbumThumb(heldKey)
    heldKey = null
  }
  videoUrl.value = ''
}

async function loadVideoUrl(record: FileRecord, force = false) {
  const token = ++loadToken
  bootLoading.value = true
  bootError.value = ''
  pauseVideo()
  releaseHeldUrl()

  try {
    const result = await acquireVideoAlbumThumb(record.key, { force })
    if (token !== loadToken) {
      releaseVideoAlbumThumb(record.key)
      return
    }
    heldKey = record.key
    videoUrl.value = result.url
  } catch (error) {
    if (token !== loadToken) return
    bootError.value = getErrorMessage(toAppError(error)) || '视频加载失败'
    showAppError(error)
  } finally {
    if (token === loadToken) {
      bootLoading.value = false
    }
  }
}

function closePreview(syncHistory = true) {
  pauseVideo()
  if (syncHistory && !closingPreviewFromHistory) {
    disablePreviewHistory(false)
  } else if (closingPreviewFromHistory) {
    previewHistoryActive = false
    activePreviewHistoryGeneration = 0
    window.removeEventListener('popstate', handlePreviewPopState)
  }
  closingPreviewFromHistory = false
  emit('update:modelValue', false)
  emit('closed')
}

function closeFromUi() {
  closePreview(true)
}

function onBackdropClick(event: MouseEvent) {
  if (event.target !== event.currentTarget) return
  closeFromUi()
}

function onVideoError() {
  if (!bootError.value) {
    bootError.value = '视频无法播放，请下载后查看'
  }
}

function goToIndex(index: number) {
  const list = galleryList.value
  if (index < 0 || index >= list.length) return
  const next = list[index]
  if (!next || next.key === props.current?.key) return
  emit('change', next)
}

function goPrev() {
  if (currentIndex.value > 0) goToIndex(currentIndex.value - 1)
}

function goNext() {
  if (currentIndex.value >= 0 && currentIndex.value < galleryList.value.length - 1) {
    goToIndex(currentIndex.value + 1)
  }
}

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
}

function onTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (!touch) return
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY
  if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) && dy > 0) {
    closeFromUi()
    return
  }
  if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
  if (dx < 0) goNext()
  else goPrev()
}

function handleRetry() {
  bootError.value = ''
  if (props.current) {
    void loadVideoUrl(props.current, true)
    return
  }
  emit('retry')
}

watch(
  () => [props.modelValue, props.loading, props.current?.key] as const,
  ([open, isLoading, key]) => {
    if (!open) {
      loadToken += 1
      pauseVideo()
      releaseHeldUrl()
      bootLoading.value = false
      bootError.value = ''
      disablePreviewHistory(closingPreviewFromHistory)
      closingPreviewFromHistory = false
      return
    }

    if (isLoading || !key || !props.current) return

    if (!previewHistoryActive) {
      enablePreviewHistory()
    }

    void loadVideoUrl(props.current)
  },
  { immediate: true },
)

onUnmounted(() => {
  loadToken += 1
  pauseVideo()
  releaseHeldUrl()
  disablePreviewHistory(closingPreviewFromHistory)
  closingPreviewFromHistory = false
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showBootOverlay"
      class="mobile-video-preview-boot"
      role="dialog"
      aria-modal="true"
      aria-label="视频预览"
    >
      <div v-if="bootLoading || loading" class="mobile-video-preview-boot__panel">
        <el-icon class="mobile-video-preview-boot__spinner" :size="36"><Loading /></el-icon>
        <span>加载中…</span>
      </div>
      <div v-else class="mobile-video-preview-boot__panel">
        <p>{{ bootError || errorMessage || '预览失败' }}</p>
        <div class="mobile-video-preview-boot__actions">
          <el-button type="primary" size="small" @click="handleRetry">重试</el-button>
          <el-button size="small" @click="closeFromUi">关闭</el-button>
        </div>
      </div>
    </div>

    <div
      v-else-if="modelValue && current"
      class="mobile-video-preview"
      :style="{ '--preview-bg-opacity': PREVIEW_BG_OPACITY }"
      role="dialog"
      aria-modal="true"
      aria-label="视频预览"
      @click="onBackdropClick"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <video
        ref="videoRef"
        class="mobile-video-preview__player"
        :src="videoUrl"
        controls
        playsinline
        preload="metadata"
        @click.stop
        @error="onVideoError"
      />

      <p v-if="counterText" class="mobile-video-preview__counter">{{ counterText }}</p>

      <button
        type="button"
        class="mobile-video-preview__download"
        aria-label="下载视频"
        @click.stop="emit('download')"
      >
        <el-icon :size="18"><Download /></el-icon>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.mobile-video-preview-boot,
.mobile-video-preview {
  position: fixed;
  inset: 0;
  z-index: 3800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, var(--preview-bg-opacity, 0.55));
  padding:
    calc(16px + var(--safe-top, 0px)) calc(16px + var(--safe-right, 0px))
    calc(48px + var(--safe-bottom, 0px)) calc(16px + var(--safe-left, 0px));
}

.mobile-video-preview-boot__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  text-align: center;
}

.mobile-video-preview-boot__actions {
  display: flex;
  gap: 8px;
}

.mobile-video-preview-boot__spinner {
  animation: mobile-video-preview-spin 0.9s linear infinite;
}

.mobile-video-preview__player {
  display: block;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: transparent;
}

.mobile-video-preview__counter {
  position: fixed;
  left: 50%;
  bottom: calc(28px + var(--safe-bottom, 0px));
  transform: translateX(-50%);
  margin: 0;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.mobile-video-preview__download {
  position: fixed;
  top: calc(12px + var(--safe-top, 0px));
  right: calc(12px + var(--safe-right, 0px));
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.92);
  touch-action: manipulation;
}

@keyframes mobile-video-preview-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
