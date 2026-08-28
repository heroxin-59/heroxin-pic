<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Picture, VideoCamera } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import type { AlbumImageMeta } from '@/services/imageMeta'
import { acquireAlbumThumb, releaseAlbumThumb } from '@/services/albumThumb'
import {
  acquireVideoAlbumThumb,
  releaseVideoAlbumThumb,
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
const loading = ref(false)
const failed = ref(false)
const visible = ref(false)
const videoReady = ref(false)

const isVideo = computed(() => props.record.category === 'video')

const VIDEO_ASPECT = 16 / 9

let observer: IntersectionObserver | null = null
let loadToken = 0
/** 当前已 acquire 的 key；release 时成对释放 */
let heldKey: string | null = null
let heldKind: 'image' | 'video' | null = null
let refreshAttempted = false

function releaseHeld() {
  if (heldKey && heldKind === 'image') {
    releaseAlbumThumb(heldKey)
  }
  if (heldKey && heldKind === 'video') {
    releaseVideoAlbumThumb(heldKey)
  }
  heldKey = null
  heldKind = null
  imageUrl.value = ''
  videoUrl.value = ''
  videoReady.value = false
}

async function loadImageThumb(force = false) {
  if (!visible.value && !force) return
  if (loading.value) return
  if (imageUrl.value && !force) return

  const key = props.record.key
  const token = ++loadToken
  loading.value = true
  failed.value = false

  try {
    const result = await acquireAlbumThumb(key, { force })
    if (token !== loadToken) {
      releaseAlbumThumb(key)
      return
    }
    releaseHeld()
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
    if (token === loadToken) {
      loading.value = false
    }
  }
}

async function loadVideoThumb(force = false) {
  if (!visible.value && !force) return
  if (loading.value) return
  if (videoUrl.value && !force) return

  const key = props.record.key
  const token = ++loadToken
  loading.value = true
  failed.value = false
  videoReady.value = false

  try {
    const result = await acquireVideoAlbumThumb(key, { force })
    if (token !== loadToken) {
      releaseVideoAlbumThumb(key)
      return
    }
    releaseHeld()
    heldKey = key
    heldKind = 'video'
    videoUrl.value = result.url
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
    if (token === loadToken) {
      loading.value = false
    }
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
  // 跳到约 0.1s，避免部分编码首帧全黑
  const target = Number.isFinite(video.duration) && video.duration > 0.2 ? 0.1 : 0.01
  try {
    video.currentTime = target
  } catch {
    videoReady.value = true
  }
}

function onVideoSeeked() {
  videoReady.value = true
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

function setupObserver() {
  observer?.disconnect()
  if (!rootRef.value || typeof IntersectionObserver === 'undefined') {
    visible.value = true
    void loadThumb()
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry?.isIntersecting) return
      visible.value = true
      void loadThumb()
      observer?.disconnect()
      observer = null
    },
    { rootMargin: '120px 0px', threshold: 0.01 },
  )
  observer.observe(rootRef.value)
}

watch(
  () => props.record.key,
  () => {
    loadToken += 1
    refreshAttempted = false
    releaseHeld()
    failed.value = false
    loading.value = false
    visible.value = false
    setupObserver()
  },
)

onMounted(() => {
  setupObserver()
})

onBeforeUnmount(() => {
  loadToken += 1
  observer?.disconnect()
  observer = null
  releaseHeld()
})
</script>

<template>
  <div ref="rootRef" class="album-thumb" :class="{ 'album-thumb--video': isVideo }">
    <template v-if="isVideo">
      <video
        v-if="videoUrl"
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
        :class="{ 'is-loading': loading || visible }"
      >
        <el-icon :size="22" :class="{ 'is-spin': loading }"><VideoCamera /></el-icon>
      </div>

      <span v-if="videoReady" class="album-thumb__play" aria-hidden="true">▶</span>
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

      <div v-else class="album-thumb__fallback" :class="{ 'is-loading': loading || visible }">
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
