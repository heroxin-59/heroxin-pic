<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FullScreen,
  Refresh,
  RefreshLeft,
  RefreshRight,
  ZoomIn,
  ZoomOut,
} from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'
import { loadImageObjectUrl, refreshSignedUrl } from '@/services/preview'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError } from '@/utils/message'

const props = defineProps<{
  /** 当前预览的图片 */
  current: FileRecord
  /** 可切换的图片列表（缩略图 / 左右切换） */
  gallery: FileRecord[]
}>()

const emit = defineEmits<{
  change: [record: FileRecord]
  download: []
}>()

const scale = ref(1)
const rotate = ref(0)
const loading = ref(true)
const loadError = ref('')
const refreshing = ref(false)
/** 主图本地 Object URL（SDK 拉取，避免签名 URL 直连失败一直转圈） */
const imageUrl = ref('')
const imageEpoch = ref(0)
const viewerVisible = ref(false)
/** 全屏 viewer 用的签名 URL 列表 */
const viewerUrls = ref<string[]>([])

let objectUrlToRevoke: string | null = null

const currentIndex = computed(() =>
  props.gallery.findIndex((item) => item.key === props.current.key),
)

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(
  () => currentIndex.value >= 0 && currentIndex.value < props.gallery.length - 1,
)

const imageStyle = computed(() => ({
  transform: `scale(${scale.value}) rotate(${rotate.value}deg)`,
  transition: 'transform 0.2s ease',
}))

function revokeCurrentObjectUrl() {
  if (objectUrlToRevoke) {
    URL.revokeObjectURL(objectUrlToRevoke)
    objectUrlToRevoke = null
  }
}

async function loadCurrentImage(options: { soft?: boolean } = {}) {
  const soft = Boolean(options.soft && imageUrl.value)
  loading.value = true
  loadError.value = ''

  if (!soft) {
    revokeCurrentObjectUrl()
    imageUrl.value = ''
  }

  try {
    const objectUrl = await loadImageObjectUrl(props.current.key)
    const previous = objectUrlToRevoke

    if (soft) {
      // 先解码再换源，避免清空旧图导致闪白
      await new Promise<void>((resolve, reject) => {
        const probe = new Image()
        probe.onload = () => resolve()
        probe.onerror = () => reject(new Error('图片解码失败'))
        probe.src = objectUrl
      })
      objectUrlToRevoke = objectUrl
      imageUrl.value = objectUrl
      if (previous && previous !== objectUrl) {
        URL.revokeObjectURL(previous)
      }
      loading.value = false
      return
    }

    objectUrlToRevoke = objectUrl
    imageUrl.value = objectUrl
    imageEpoch.value += 1
  } catch (error) {
    loading.value = false
    loadError.value = getErrorMessage(toAppError(error)) || '图片加载失败'
    showAppError(error)
  }
}

watch(
  () => props.current.key,
  async () => {
    scale.value = 1
    rotate.value = 0
    viewerVisible.value = false
    await loadCurrentImage()
  },
  { immediate: true },
)

function onImageLoad() {
  loading.value = false
  loadError.value = ''
}

function onImageError() {
  loading.value = false
  loadError.value = '图片解码失败，请尝试重新加载或下载原文件'
}

async function onReload() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await loadCurrentImage({ soft: true })
  } catch (error) {
    showAppError(error)
  } finally {
    refreshing.value = false
  }
}

function zoomIn() {
  scale.value = Math.min(4, Number((scale.value + 0.25).toFixed(2)))
}

function zoomOut() {
  scale.value = Math.max(0.25, Number((scale.value - 0.25).toFixed(2)))
}

function rotateLeft() {
  rotate.value = (rotate.value - 90) % 360
}

function rotateRight() {
  rotate.value = (rotate.value + 90) % 360
}

function resetView() {
  scale.value = 1
  rotate.value = 0
}

function goPrev() {
  if (!hasPrev.value) return
  const prev = props.gallery[currentIndex.value - 1]
  if (prev) emit('change', prev)
}

function goNext() {
  if (!hasNext.value) return
  const next = props.gallery[currentIndex.value + 1]
  if (next) emit('change', next)
}

function selectThumb(record: FileRecord) {
  if (record.key === props.current.key) return
  emit('change', record)
}

async function openFullscreen() {
  refreshing.value = true
  try {
    // 全屏 viewer 使用签名 URL；当前张优先用已加载的 blob URL
    const urls = await Promise.all(
      props.gallery.map(async (item) => {
        if (item.key === props.current.key && imageUrl.value) {
          return imageUrl.value
        }
        try {
          return await refreshSignedUrl(item.key)
        } catch {
          return item.url
        }
      }),
    )
    viewerUrls.value = urls.length > 0 ? urls : imageUrl.value ? [imageUrl.value] : []
    if (viewerUrls.value.length === 0) {
      loadError.value = '无法打开全屏预览'
      return
    }
    viewerVisible.value = true
  } catch (error) {
    showAppError(error)
  } finally {
    refreshing.value = false
  }
}

function closeFullscreen() {
  viewerVisible.value = false
}

function onViewerSwitch(index: number) {
  const record = props.gallery[index]
  if (record && record.key !== props.current.key) {
    emit('change', record)
  }
}

let touchStartX = 0
let touchStartY = 0

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
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return
  if (dx > 0) goPrev()
  else goNext()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') goPrev()
  if (event.key === 'ArrowRight') goNext()
  if (event.key === '+' || event.key === '=') zoomIn()
  if (event.key === '-') zoomOut()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  revokeCurrentObjectUrl()
})
</script>

<template>
  <div class="image-preview">
    <div class="image-preview__toolbar">
      <div class="image-preview__nav">
        <el-button :disabled="!hasPrev" :icon="ArrowLeft" @click="goPrev">上一张</el-button>
        <span class="image-preview__counter">
          {{ currentIndex >= 0 ? currentIndex + 1 : 1 }} /
          {{ gallery.length || 1 }}
        </span>
        <el-button :disabled="!hasNext" @click="goNext">
          下一张
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div class="image-preview__actions">
        <el-button :icon="ZoomOut" circle :disabled="!!loadError" @click="zoomOut" />
        <el-button :icon="ZoomIn" circle :disabled="!!loadError" @click="zoomIn" />
        <el-button :icon="RefreshLeft" circle :disabled="!!loadError" @click="rotateLeft" />
        <el-button :icon="RefreshRight" circle :disabled="!!loadError" @click="rotateRight" />
        <el-button circle :disabled="!!loadError" @click="resetView">1:1</el-button>
        <el-button
          :icon="FullScreen"
          circle
          :disabled="!!loadError || !imageUrl"
          @click="openFullscreen"
        />
        <el-button
          :icon="Refresh"
          circle
          :loading="refreshing"
          :disabled="loading && !imageUrl"
          @click="onReload"
        />
        <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
      </div>
    </div>

    <div
      v-loading="loading && !loadError"
      element-loading-text="加载中…"
      element-loading-background="rgba(255, 255, 255, 0.55)"
      class="image-preview__stage"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <el-result v-if="loadError" icon="warning" title="无法预览图片" :sub-title="loadError">
        <template #extra>
          <el-button type="primary" :loading="refreshing" @click="onReload">重新加载</el-button>
          <el-button @click="emit('download')">下载原文件</el-button>
        </template>
      </el-result>

      <img
        v-else-if="imageUrl"
        :key="imageEpoch"
        class="image-preview__img"
        :src="imageUrl"
        :alt="current.name"
        :style="imageStyle"
        draggable="false"
        @load="onImageLoad"
        @error="onImageError"
        @dblclick="openFullscreen"
      />
    </div>

    <div v-if="gallery.length > 1" class="image-preview__thumbs">
      <button
        v-for="item in gallery"
        :key="item.key"
        type="button"
        class="image-preview__thumb"
        :class="{ 'is-active': item.key === current.key }"
        :title="item.name"
        @click="selectThumb(item)"
      >
        <span class="image-preview__thumb-label">{{ item.name.slice(0, 1) }}</span>
      </button>
    </div>

    <el-image-viewer
      v-if="viewerVisible"
      :url-list="viewerUrls"
      :initial-index="Math.max(0, currentIndex)"
      teleported
      @close="closeFullscreen"
      @switch="onViewerSwitch"
    />
  </div>
</template>

<style scoped>
.image-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.image-preview__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.image-preview__nav,
.image-preview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.image-preview__counter {
  min-width: 64px;
  text-align: center;
  font-size: 13px;
  color: #606266;
}

.image-preview__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  max-height: min(70vh, 720px);
  overflow: hidden;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background:
    linear-gradient(45deg, #f5f7fa 25%, transparent 25%) 0 0 / 16px 16px,
    linear-gradient(-45deg, #f5f7fa 25%, transparent 25%) 0 8px / 16px 16px,
    linear-gradient(45deg, transparent 75%, #f5f7fa 75%) 8px -8px / 16px 16px,
    linear-gradient(-45deg, transparent 75%, #f5f7fa 75%) -8px 0 / 16px 16px,
    #fff;
  touch-action: pan-y;
  user-select: none;
}

.image-preview__img {
  max-width: 100%;
  max-height: min(68vh, 700px);
  object-fit: contain;
  cursor: zoom-in;
}

.image-preview__thumbs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.image-preview__thumb {
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f7fa;
  cursor: pointer;
  touch-action: manipulation;
}

.image-preview__thumb.is-active {
  border-color: #409eff;
}

.image-preview__thumb-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 16px;
  font-weight: 600;
  color: #909399;
  text-transform: uppercase;
}

@media (max-width: 767px) {
  .image-preview__toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .image-preview__nav,
  .image-preview__actions {
    justify-content: center;
  }

  .image-preview__actions :deep(.el-button) {
    min-height: 40px;
    min-width: 40px;
  }

  .image-preview__stage {
    min-height: 280px;
    max-height: 55vh;
  }

  .image-preview__thumb {
    width: 56px;
    height: 56px;
  }
}
</style>
