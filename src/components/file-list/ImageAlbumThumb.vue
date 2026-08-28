<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Picture, VideoCamera } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import type { AlbumImageMeta } from '@/services/imageMeta'
import {
  acquireAlbumThumb,
  invalidateAlbumThumb,
  releaseAlbumThumb,
} from '@/services/albumThumb'
import {
  acquireVideoAlbumThumb,
  peekVideoAlbumPoster,
  releaseVideoAlbumThumb,
  setVideoAlbumPoster,
} from '@/services/videoAlbumThumb'
import { getCachedAlbumAspect, setAlbumAspect } from '@/services/imageAspect'

const props = defineProps<{
  record: FileRecord
}>()

const emit = defineEmits<{
  meta: [meta: AlbumImageMeta]
  aspect: [payload: { key: string; aspectRatio: number }]
}>()

const rootRef = ref<HTMLElement | null>(null)
const imageUrl = ref('')
const videoUrl = ref('')
const posterUrl = ref('')
const loading = ref(false)
const failed = ref(false)
const videoReady = ref(false)

const isVideo = computed(() => props.record.category === 'video')

const VIDEO_ASPECT = 16 / 9

let loadToken = 0
let heldKey: string | null = null
let heldKind: 'image' | 'video' | null = null
let refreshAttempted = false
let resizeObserver: ResizeObserver | null = null

function releaseHeldRef() {
  if (heldKey && heldKind === 'image') {
    releaseAlbumThumb(heldKey)
  }
  if (heldKey && heldKind === 'video') {
    releaseVideoAlbumThumb(heldKey)
  }
  heldKey = null
  heldKind = null
}

function resetDisplay() {
  imageUrl.value = ''
  videoUrl.value = ''
  posterUrl.value = ''
  videoReady.value = false
}

function releaseHeld() {
  releaseHeldRef()
  resetDisplay()
}

function captureVideoPoster(video: HTMLVideoElement): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (!video.videoWidth || !video.videoHeight) {
        resolve(null)
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null)
            return
          }
          resolve(URL.createObjectURL(blob))
        },
        'image/jpeg',
        0.82,
      )
    } catch {
      resolve(null)
    }
  })
}

function hydrateVideoFromCache() {
  const poster = peekVideoAlbumPoster(props.record.key)
  if (!poster) return false
  posterUrl.value = poster
  videoUrl.value = ''
  videoReady.value = true
  const cachedAspect = getCachedAlbumAspect(props.record.key)
  if (cachedAspect != null) {
    emit('aspect', { key: props.record.key, aspectRatio: cachedAspect })
  } else {
    setAlbumAspect(props.record.key, VIDEO_ASPECT)
    emit('aspect', { key: props.record.key, aspectRatio: VIDEO_ASPECT })
  }
  return true
}

function startThumbLoad() {
  failed.value = false
  if (isVideo.value) {
    hydrateVideoFromCache()
  }
  void loadThumb()
}

async function loadImageThumb(force = false) {
  if (loading.value) return

  const key = props.record.key
  if (!force && heldKey === key && imageUrl.value) return

  const token = ++loadToken
  loading.value = true
  failed.value = false

  try {
    const result = await acquireAlbumThumb(key, { force })
    if (token !== loadToken) {
      releaseAlbumThumb(key)
      return
    }

    if (heldKey && heldKey !== key) {
      releaseHeldRef()
    }
    heldKey = key
    heldKind = 'image'
    imageUrl.value = result.url
    emit('meta', result.meta)
    const cachedAspect = getCachedAlbumAspect(key)
    if (cachedAspect != null) {
      emit('aspect', { key, aspectRatio: cachedAspect })
    }
  } catch {
    if (token !== loadToken) return
    failed.value = true
    releaseHeld()
  } finally {
    loading.value = false
  }
}

async function loadVideoThumb(force = false) {
  if (loading.value) return

  const key = props.record.key
  if (!force && heldKey === key && (posterUrl.value || videoUrl.value)) return

  const token = ++loadToken
  loading.value = true
  failed.value = false
  if (!posterUrl.value) {
    videoReady.value = false
  }

  try {
    const result = await acquireVideoAlbumThumb(key, { force })
    if (token !== loadToken) {
      releaseVideoAlbumThumb(key)
      return
    }

    if (heldKey && heldKey !== key) {
      releaseHeldRef()
    }
    heldKey = key
    heldKind = 'video'

    if (result.posterUrl) {
      posterUrl.value = result.posterUrl
      videoUrl.value = ''
      videoReady.value = true
    } else if (!posterUrl.value) {
      videoUrl.value = result.url
    }

    const cachedAspect = getCachedAlbumAspect(key)
    if (cachedAspect != null) {
      emit('aspect', { key, aspectRatio: cachedAspect })
    } else {
      setAlbumAspect(key, VIDEO_ASPECT)
      emit('aspect', { key, aspectRatio: VIDEO_ASPECT })
    }
  } catch {
    if (token !== loadToken) return
    failed.value = true
    releaseHeld()
    setAlbumAspect(key, VIDEO_ASPECT)
    emit('aspect', { key, aspectRatio: VIDEO_ASPECT })
  } finally {
    loading.value = false
  }
}

async function loadThumb(force = false) {
  if (isVideo.value) {
    await loadVideoThumb(force)
    return
  }
  await loadImageThumb(force)
}

function onImgLoad(event: Event) {
  const img = event.target as HTMLImageElement
  if (!img.naturalWidth || !img.naturalHeight) return
  const ratio = img.naturalWidth / img.naturalHeight
  if (setAlbumAspect(props.record.key, ratio)) {
    emit('aspect', { key: props.record.key, aspectRatio: ratio })
  }
}

function onImgError() {
  if (!refreshAttempted && imageUrl.value && !loading.value) {
    refreshAttempted = true
    invalidateAlbumThumb(props.record.key)
    releaseHeldRef()
    resetDisplay()
    void loadThumb(true)
    return
  }
  failed.value = true
  releaseHeld()
}

function onVideoLoadedMetadata(event: Event) {
  const video = event.target as HTMLVideoElement
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    const ratio = video.videoWidth / video.videoHeight
    if (setAlbumAspect(props.record.key, ratio)) {
      emit('aspect', { key: props.record.key, aspectRatio: ratio })
    }
  }
  const target = Number.isFinite(video.duration) && video.duration > 0.2 ? 0.1 : 0.01
  try {
    video.currentTime = target
  } catch {
    videoReady.value = true
  }
}

function onVideoSeeked(event: Event) {
  videoReady.value = true
  const video = event.target as HTMLVideoElement
  const key = heldKey
  if (posterUrl.value || !key) return
  const token = loadToken
  void captureVideoPoster(video).then((url) => {
    if (!url || token !== loadToken) {
      if (url) URL.revokeObjectURL(url)
      return
    }
    setVideoAlbumPoster(key, url)
    posterUrl.value = url
    videoUrl.value = ''
  })
}

function onVideoError() {
  if (!refreshAttempted && videoUrl.value && !loading.value) {
    refreshAttempted = true
    void loadThumb(true)
    return
  }
  failed.value = true
  videoReady.value = false
  releaseHeld()
}

function shouldRetryLoad(): boolean {
  if (failed.value || loading.value) return false
  if (isVideo.value) return !posterUrl.value && !videoUrl.value
  return !imageUrl.value
}

function setupResizeRetry() {
  resizeObserver?.disconnect()
  const el = rootRef.value
  if (!el || typeof ResizeObserver === 'undefined') return

  resizeObserver = new ResizeObserver(() => {
    if (el.clientWidth > 0 && el.clientHeight > 0 && shouldRetryLoad()) {
      startThumbLoad()
    }
  })
  resizeObserver.observe(el)
}

function resetForRecordChange() {
  loadToken += 1
  refreshAttempted = false
  releaseHeld()
  failed.value = false
  loading.value = false
  startThumbLoad()
}

watch(() => props.record.key, resetForRecordChange)

onMounted(() => {
  startThumbLoad()
  setupResizeRetry()
})

onBeforeUnmount(() => {
  loadToken += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  releaseHeld()
})
</script>

<template>
  <div ref="rootRef" class="album-thumb" :class="{ 'album-thumb--video': isVideo }">
    <template v-if="isVideo">
      <img
        v-if="posterUrl"
        class="album-thumb__img"
        :src="posterUrl"
        :alt="record.name"
        draggable="false"
      />

      <video
        v-else-if="videoUrl"
        class="album-thumb__video"
        :class="{ 'is-ready': videoReady }"
        :src="videoUrl"
        muted
        playsinline
        preload="metadata"
        draggable="false"
        @loadedmetadata="onVideoLoadedMetadata"
        @seeked="onVideoSeeked"
        @error="onVideoError"
      />

      <div
        v-else-if="failed"
        class="album-thumb__fallback album-thumb__fallback--video"
      >
        <el-icon :size="22"><VideoCamera /></el-icon>
        <span class="album-thumb__hint">加载失败</span>
      </div>

      <div
        v-else
        class="album-thumb__fallback album-thumb__fallback--video"
        :class="{ 'is-loading': loading }"
      >
        <el-icon :size="22" :class="{ 'is-spin': loading }"><VideoCamera /></el-icon>
      </div>

      <span v-if="posterUrl || videoReady" class="album-thumb__play" aria-hidden="true">▶</span>
    </template>

    <template v-else>
      <img
        v-if="imageUrl"
        class="album-thumb__img"
        :src="imageUrl"
        :alt="record.name"
        draggable="false"
        @load="onImgLoad"
        @error="onImgError"
      />

      <div v-else-if="failed" class="album-thumb__fallback">
        <el-icon :size="22"><Picture /></el-icon>
        <span class="album-thumb__hint">加载失败</span>
      </div>

      <div v-else class="album-thumb__fallback" :class="{ 'is-loading': loading }">
        <el-icon :size="22" :class="{ 'is-spin': loading }"><Picture /></el-icon>
      </div>
    </template>
  </div>
</template>

<style scoped>
.album-thumb {
  position: absolute;
  inset: 0;
  background: #ebeef5;
}

.album-thumb--video {
  background: #e8eaef;
}

.album-thumb__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #e8eaef;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.album-thumb__video.is-ready {
  opacity: 1;
}

.album-thumb__play {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  padding-left: 2px;
  background: rgba(0, 0, 0, 0.45);
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  color: #fff;
  pointer-events: none;
}

.album-thumb__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.album-thumb__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  color: #c0c4cc;
}

.album-thumb__fallback--video {
  color: #a8abb2;
  background: #e8eaef;
}

.album-thumb__hint {
  font-size: 10px;
  color: #909399;
}

.album-thumb__fallback.is-loading {
  color: #909399;
}

.is-spin {
  animation: album-thumb-spin 0.9s linear infinite;
}

@keyframes album-thumb-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
