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
import { loadImageObjectUrl, refreshSignedUrl, releaseImageObjectUrl } from '@/services/preview'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError } from '@/utils/message'

const props = defineProps<{
  /** 当前预览的图片 */
  current: FileRecord
  /** 可切换的图片列表（左右切换） */
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

let objectUrlHeldKey: string | null = null
/** 快速左右切换时丢弃过期请求，避免后写覆盖与闪白 */
let loadSeq = 0

const currentIndex = computed(() =>
  props.gallery.findIndex((item) => item.key === props.current.key),
)

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(
  () => currentIndex.value >= 0 && currentIndex.value < props.gallery.length - 1,
)

/** 首次/硬刷新才盖住舞台；切换时保留旧图 */
const showStageLoading = computed(() => loading.value && !loadError.value && !imageUrl.value)
const switching = computed(() => loading.value && !!imageUrl.value && !loadError.value)

const imageStyle = computed(() => ({
  transform: `scale(${scale.value}) rotate(${rotate.value}deg)`,
  transition: 'transform 0.2s ease, opacity 0.18s ease',
  opacity: switching.value ? 0.72 : 1,
}))

function releaseCurrentObjectUrl() {
  if (objectUrlHeldKey) {
    releaseImageObjectUrl(objectUrlHeldKey)
    objectUrlHeldKey = null
  }
}

function decodeImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = new Image()
    probe.onload = () => resolve()
    probe.onerror = () => reject(new Error('图片解码失败'))
    probe.src = url
  })
}

async function loadCurrentImage(options: { soft?: boolean } = {}) {
  const soft = Boolean(options.soft && imageUrl.value)
  const seq = ++loadSeq
  const targetKey = props.current.key

  loading.value = true
  loadError.value = ''

  if (!soft) {
    releaseCurrentObjectUrl()
    imageUrl.value = ''
  }

  try {
    const objectUrl = await loadImageObjectUrl(targetKey)
    if (seq !== loadSeq) {
      releaseImageObjectUrl(targetKey)
      return
    }

    const previousKey = objectUrlHeldKey

    if (soft) {
      // 先解码再换源，避免清空旧图导致闪白
      await decodeImage(objectUrl)
      if (seq !== loadSeq) {
        releaseImageObjectUrl(targetKey)
        return
      }
      objectUrlHeldKey = targetKey
      imageUrl.value = objectUrl
      if (previousKey && previousKey !== targetKey) {
        releaseImageObjectUrl(previousKey)
      }
      loading.value = false
      return
    }

    objectUrlHeldKey = targetKey
    imageUrl.value = objectUrl
    imageEpoch.value += 1
  } catch (error) {
    if (seq !== loadSeq) return
    loading.value = false
    loadError.value = getErrorMessage(toAppError(error)) || '图片加载失败'
    showAppError(error)
  }
}

watch(
  () => props.current.key,
  async (_key, prevKey) => {
    scale.value = 1
    rotate.value = 0
    viewerVisible.value = false
    // 已有展示图时软切换：保留旧图直到新图就绪
    await loadCurrentImage({ soft: Boolean(prevKey && imageUrl.value) })
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
  loadSeq += 1
  releaseCurrentObjectUrl()
})
</script>

<template>
  <div class="image-preview">
    <div class="image-preview__toolbar">
      <span v-if="gallery.length > 1" class="image-preview__counter">
        {{ currentIndex >= 0 ? currentIndex + 1 : 1 }} / {{ gallery.length }}
      </span>
      <span v-else class="image-preview__counter image-preview__counter--spacer" />

      <div class="image-preview__actions">
        <el-button
          class="image-preview__tool"
          :icon="ZoomOut"
          circle
          size="small"
          :disabled="!!loadError"
          @click="zoomOut"
        />
        <el-button
          class="image-preview__tool"
          :icon="ZoomIn"
          circle
          size="small"
          :disabled="!!loadError"
          @click="zoomIn"
        />
        <el-button
          class="image-preview__tool"
          :icon="RefreshLeft"
          circle
          size="small"
          :disabled="!!loadError"
          @click="rotateLeft"
        />
        <el-button
          class="image-preview__tool"
          :icon="RefreshRight"
          circle
          size="small"
          :disabled="!!loadError"
          @click="rotateRight"
        />
        <el-button
          class="image-preview__tool image-preview__tool--label"
          circle
          size="small"
          :disabled="!!loadError"
          @click="resetView"
        >
          1:1
        </el-button>
        <el-button
          class="image-preview__tool"
          :icon="FullScreen"
          circle
          size="small"
          :disabled="!!loadError || !imageUrl"
          @click="openFullscreen"
        />
        <el-button
          class="image-preview__tool image-preview__tool--refresh"
          :icon="Refresh"
          circle
          size="small"
          :loading="refreshing"
          :disabled="loading && !imageUrl"
          @click="onReload"
        />
      </div>

      <div class="image-preview__download">
        <el-button type="primary" :icon="Download" @click="emit('download')">下载</el-button>
      </div>
    </div>

    <div
      v-loading="showStageLoading"
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

      <button
        v-if="hasPrev"
        type="button"
        class="image-preview__side image-preview__side--prev"
        aria-label="上一张"
        @click.stop="goPrev"
      >
        <el-icon :size="28"><ArrowLeft /></el-icon>
      </button>
      <button
        v-if="hasNext"
        type="button"
        class="image-preview__side image-preview__side--next"
        aria-label="下一张"
        @click.stop="goNext"
      >
        <el-icon :size="28"><ArrowRight /></el-icon>
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
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  min-height: 40px;
}

.image-preview__counter {
  justify-self: start;
  font-size: 13px;
  color: #606266;
}

.image-preview__counter--spacer {
  visibility: hidden;
}

.image-preview__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.image-preview__download {
  justify-self: end;
}

.image-preview__tool {
  --el-button-size: 32px;
  width: 32px;
  height: 32px;
  padding: 0;
}

.image-preview__tool :deep(.el-icon) {
  font-size: 14px;
}

.image-preview__tool--label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.image-preview__tool--refresh :deep(.el-icon) {
  font-size: 12px;
}

.image-preview__tool--refresh :deep(.el-icon svg) {
  width: 0.92em;
  height: 0.92em;
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

.image-preview__side {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(72px, 18%);
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #303133;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    background 0.2s ease;
  touch-action: manipulation;
}

.image-preview__stage:hover .image-preview__side,
.image-preview__side:focus-visible {
  opacity: 1;
}

.image-preview__side:hover {
  background: rgba(0, 0, 0, 0.06);
}

.image-preview__side :deep(.el-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.image-preview__side--prev {
  left: 0;
}

.image-preview__side--next {
  right: 0;
}

@media (max-width: 767px) {
  .image-preview__toolbar {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .image-preview__counter,
  .image-preview__counter--spacer {
    width: 100%;
    text-align: center;
    justify-self: center;
  }

  .image-preview__counter--spacer {
    display: none;
  }

  .image-preview__actions {
    justify-content: center;
  }

  .image-preview__download {
    display: flex;
    justify-content: center;
  }

  .image-preview__tool {
    --el-button-size: 36px;
    width: 36px;
    height: 36px;
  }

  .image-preview__stage {
    min-height: 280px;
    max-height: 55vh;
  }

  /* 触控设备始终露出侧边热区，便于点按 */
  .image-preview__side {
    width: min(56px, 22%);
    opacity: 0.85;
  }
}
</style>
