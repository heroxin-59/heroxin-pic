<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Download, Refresh } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import { refreshSignedUrl, releaseSignedPreviewUrl } from '@/services/preview'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError } from '@/utils/message'

const props = defineProps<{
  record: FileRecord
  /** 可切换的媒体列表（图片 + 视频） */
  gallery?: FileRecord[]
}>()

const emit = defineEmits<{
  change: [record: FileRecord]
  download: []
}>()

const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const videoUrl = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)

const videoType = computed(() => props.record.mimeType || 'video/mp4')

const galleryList = computed(() => {
  if (props.gallery && props.gallery.length > 0) return props.gallery
  return [props.record]
})

const currentIndex = computed(() =>
  galleryList.value.findIndex((item) => item.key === props.record.key),
)

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(
  () => currentIndex.value >= 0 && currentIndex.value < galleryList.value.length - 1,
)

let heldSignedKey: string | null = null
let loadToken = 0

function releaseHeldUrl() {
  if (heldSignedKey) {
    releaseSignedPreviewUrl(heldSignedKey)
    heldSignedKey = null
  }
}

async function tryAutoplay() {
  const el = videoRef.value
  if (!el || !videoUrl.value) return
  try {
    await el.play()
  } catch {
    // 部分浏览器仍可能拦截自动播放，用户可手动点播放
  }
}

function onVideoCanPlay() {
  void tryAutoplay()
}

async function loadVideo(options: { soft?: boolean; force?: boolean } = {}) {
  const soft = Boolean(options.soft && videoUrl.value)
  const token = ++loadToken
  loading.value = true
  loadError.value = ''
  if (!soft) {
    releaseHeldUrl()
    videoUrl.value = ''
  }

  try {
    const url = await refreshSignedUrl(props.record.key, { force: Boolean(options.force) })
    if (token !== loadToken) {
      releaseSignedPreviewUrl(props.record.key)
      return
    }
    releaseHeldUrl()
    heldSignedKey = props.record.key
    videoUrl.value = url
  } catch (error) {
    if (token !== loadToken) return
    if (!soft) {
      videoUrl.value = ''
    }
    loadError.value = getErrorMessage(toAppError(error)) || '视频加载失败'
    showAppError(error)
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

async function onReload() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await loadVideo({ soft: true, force: true })
  } finally {
    refreshing.value = false
  }
}

function onVideoError() {
  if (!loadError.value) {
    loadError.value = '视频无法播放，请下载后查看'
  }
}

function goPrev() {
  if (!hasPrev.value) return
  const prev = galleryList.value[currentIndex.value - 1]
  if (prev) emit('change', prev)
}

function goNext() {
  if (!hasNext.value) return
  const next = galleryList.value[currentIndex.value + 1]
  if (next) emit('change', next)
}

watch(
  () => props.record.key,
  () => {
    void loadVideo()
  },
  { immediate: true },
)

onUnmounted(() => {
  loadToken += 1
  releaseHeldUrl()
  videoUrl.value = ''
})
</script>

<template>
  <div class="video-preview">
    <div class="video-preview__toolbar">
      <el-button
        v-if="galleryList.length > 1"
        :icon="ArrowLeft"
        circle
        :disabled="!hasPrev"
        aria-label="上一项"
        @click="goPrev"
      />
      <el-button
        v-if="galleryList.length > 1"
        :icon="ArrowRight"
        circle
        :disabled="!hasNext"
        aria-label="下一项"
        @click="goNext"
      />
      <el-button
        :icon="Refresh"
        circle
        :loading="refreshing"
        :disabled="loading && !videoUrl"
        @click="onReload"
      />
      <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
    </div>

    <div
      v-loading="loading && !loadError"
      element-loading-text="加载中…"
      element-loading-background="rgba(255, 255, 255, 0.55)"
      class="video-preview__stage"
    >
      <el-result
        v-if="loadError && !videoUrl"
        icon="warning"
        title="无法播放视频"
        :sub-title="loadError"
      >
        <template #extra>
          <el-button type="primary" :loading="refreshing || loading" @click="onReload">
            重新加载
          </el-button>
          <el-button @click="emit('download')">下载原文件</el-button>
        </template>
      </el-result>

      <video
        v-else-if="videoUrl"
        ref="videoRef"
        class="video-preview__player"
        controls
        autoplay
        playsinline
        preload="auto"
        :src="videoUrl"
        :type="videoType"
        @canplay="onVideoCanPlay"
        @error="onVideoError"
      />
    </div>

    <p class="video-preview__hint">
      在线播放依赖浏览器对编码格式的支持；若无法播放请下载后使用本地播放器查看。
    </p>
  </div>
</template>

<style scoped>
.video-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.video-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.video-preview__stage {
  position: relative;
  min-height: 280px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview__player {
  display: block;
  width: 100%;
  max-height: min(72vh, 900px);
  background: #000;
}

.video-preview__hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .video-preview__player {
    max-height: 60vh;
  }

  .video-preview__toolbar :deep(.el-button) {
    min-height: 40px;
  }
}
</style>
