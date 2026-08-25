<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Picture } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import type { AlbumImageMeta } from '@/services/imageMeta'
import { acquireAlbumThumb, releaseAlbumThumb } from '@/services/albumThumb'
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
const loading = ref(false)
const failed = ref(false)
const visible = ref(false)

let observer: IntersectionObserver | null = null
let loadToken = 0
/** 当前已 acquire 的 key；release 时成对释放 */
let heldKey: string | null = null
let refreshAttempted = false

function releaseHeld() {
  if (heldKey) {
    releaseAlbumThumb(heldKey)
    heldKey = null
  }
  imageUrl.value = ''
}

async function loadThumb(force = false) {
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
  <div ref="rootRef" class="album-thumb">
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
  </div>
</template>

<style scoped>
.album-thumb {
  position: absolute;
  inset: 0;
  background: #ebeef5;
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
