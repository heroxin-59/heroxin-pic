<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import PhotoSwipe, { type PhotoSwipeOptions } from 'photoswipe'
import 'photoswipe/style.css'
import { getAccessUrl } from '@/services/fileList'
import { loadImageObjectUrl } from '@/services/preview'
import type { FileRecord } from '@/types/file'
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

const bootError = ref('')
const bootLoading = ref(false)

type SlideData = {
  src: string
  width: number
  height: number
  alt: string
  key: string
}

const slideCache = new Map<string, SlideData>()
const blobUrls = new Set<string>()

let pswp: PhotoSwipe | null = null
let opening = false
let openSeq = 0
let syncingFromViewer = false

const SIGNED_TTL_SEC = 3600

function clearSlideCache() {
  for (const url of blobUrls) {
    URL.revokeObjectURL(url)
  }
  blobUrls.clear()
  slideCache.clear()
}

function measureImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      resolve({
        width: Math.max(1, img.naturalWidth),
        height: Math.max(1, img.naturalHeight),
      })
    }
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = url
  })
}

async function resolveSlide(record: FileRecord): Promise<SlideData> {
  const cached = slideCache.get(record.key)
  if (cached?.src && cached.width > 1 && cached.height > 1) {
    return cached
  }

  try {
    const src = await getAccessUrl(record.key, { expires: SIGNED_TTL_SEC })
    const size = await measureImage(src)
    const slide: SlideData = {
      src,
      width: size.width,
      height: size.height,
      alt: record.name,
      key: record.key,
    }
    slideCache.set(record.key, slide)
    return slide
  } catch {
    const src = await loadImageObjectUrl(record.key)
    blobUrls.add(src)
    const size = await measureImage(src)
    const slide: SlideData = {
      src,
      width: size.width,
      height: size.height,
      alt: record.name,
      key: record.key,
    }
    slideCache.set(record.key, slide)
    return slide
  }
}

function destroyViewer(options: { emitClosed?: boolean } = {}) {
  const instance = pswp
  pswp = null
  opening = false
  if (instance) {
    try {
      instance.destroy()
    } catch {
      // ignore
    }
  }
  clearSlideCache()
  if (options.emitClosed) {
    emit('closed')
  }
}

function closeFromUi() {
  if (pswp) {
    pswp.close()
    return
  }
  emit('update:modelValue', false)
  emit('closed')
}

function galleryList(): FileRecord[] {
  if (props.gallery.length > 0) return props.gallery
  return props.current ? [props.current] : []
}

async function openViewer() {
  if (!props.modelValue || !props.current || props.loading) return
  if (pswp || opening) return

  const list = galleryList()
  if (list.length === 0) return

  let startIndex = list.findIndex((item) => item.key === props.current!.key)
  if (startIndex < 0) startIndex = 0

  opening = true
  bootLoading.value = true
  bootError.value = ''
  const seq = ++openSeq

  try {
    // 打开前解析全部 slide（src + 真实宽高），交给 PhotoSwipe 默认加载，避免自定义 contentLoad 黑屏
    const slides = await Promise.all(list.map((record) => resolveSlide(record)))
    if (seq !== openSeq || !props.modelValue) return

    const dataSource: PhotoSwipeOptions['dataSource'] = slides.map((slide) => ({
      src: slide.src,
      width: slide.width,
      height: slide.height,
      alt: slide.alt,
    }))

    const instance = new PhotoSwipe({
      dataSource,
      index: startIndex,
      bgOpacity: 0.92,
      showHideAnimationType: 'fade',
      initialZoomLevel: 'fit',
      maxZoomLevel: 4,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      wheelToZoom: true,
      tapAction: 'toggle-controls',
      doubleTapAction: 'zoom',
      loop: list.length > 1,
      preload: [1, 2],
      paddingFn: () => ({
        top: 48,
        bottom: 48,
        left: 0,
        right: 0,
      }),
    })

    pswp = instance

    instance.on('change', () => {
      const record = list[instance.currIndex]
      if (record) {
        syncingFromViewer = true
        emit('change', record)
        queueMicrotask(() => {
          syncingFromViewer = false
        })
      }
    })

    instance.on('uiRegister', () => {
      instance.ui?.registerElement({
        name: 'heroxin-download',
        order: 8,
        isButton: true,
        tagName: 'button',
        title: '下载',
        className: 'pswp__button--heroxin-download',
        html: {
          isCustomSVG: true,
          inner:
            '<path d="M18.32 8.191H15V2.75a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0-.75.75v5.441H5.68a.75.75 0 0 0-.53 1.28l6.32 6.32a.75.75 0 0 0 1.06 0l6.32-6.32a.75.75 0 0 0-.53-1.28ZM19.25 19.5H4.75a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5Z" id="pswp__icn-heroxin-download"/>',
          outlineID: 'pswp__icn-heroxin-download',
        },
        onClick: () => emit('download'),
      })
    })

    instance.on('close', () => {
      emit('update:modelValue', false)
    })

    instance.on('destroy', () => {
      if (pswp === instance) pswp = null
      clearSlideCache()
      emit('closed')
    })

    bootLoading.value = false
    opening = false
    instance.init()
  } catch (error) {
    bootLoading.value = false
    opening = false
    bootError.value = getErrorMessage(toAppError(error)) || '图片加载失败'
    showAppError(error)
    destroyViewer()
  }
}

watch(
  () => [props.modelValue, props.loading, props.current?.key] as const,
  ([open, isLoading]) => {
    if (!open) {
      openSeq += 1
      bootError.value = ''
      bootLoading.value = false
      if (pswp) {
        try {
          pswp.close()
        } catch {
          destroyViewer({ emitClosed: true })
        }
      }
      return
    }

    if (pswp || opening || syncingFromViewer) return
    if (isLoading || !props.current) return
    void openViewer()
  },
)

onUnmounted(() => {
  openSeq += 1
  destroyViewer()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && (loading || bootLoading || bootError || errorMessage || !current)"
      class="mobile-image-preview-boot"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
    >
      <div v-if="loading || bootLoading" class="mobile-image-preview-boot__panel">
        <el-icon class="mobile-image-preview-boot__spinner" :size="36"><Loading /></el-icon>
        <span>加载中…</span>
      </div>
      <div v-else class="mobile-image-preview-boot__panel">
        <p>{{ bootError || errorMessage || '预览失败' }}</p>
        <div class="mobile-image-preview-boot__actions">
          <el-button type="primary" size="small" @click="emit('retry')">重试</el-button>
          <el-button size="small" @click="closeFromUi">关闭</el-button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.mobile-image-preview-boot {
  position: fixed;
  inset: 0;
  z-index: 3600;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.92);
  padding:
    calc(16px + var(--safe-top, 0px)) calc(16px + var(--safe-right, 0px))
    calc(16px + var(--safe-bottom, 0px)) calc(16px + var(--safe-left, 0px));
}

.mobile-image-preview-boot__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  text-align: center;
}

.mobile-image-preview-boot__actions {
  display: flex;
  gap: 8px;
}

.mobile-image-preview-boot__spinner {
  animation: mobile-preview-boot-spin 0.9s linear infinite;
}

@keyframes mobile-preview-boot-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<style>
.pswp {
  --pswp-icon-color: #fff;
  z-index: 3700 !important;
}

.pswp .pswp__top-bar {
  padding-top: var(--safe-top, 0px);
}

.pswp .pswp__button--heroxin-download {
  display: block;
}

.pswp--touch .pswp__button--arrow--prev,
.pswp--touch .pswp__button--arrow--next {
  display: none !important;
}
</style>
