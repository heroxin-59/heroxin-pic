<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import PhotoSwipe, { type PhotoSwipeOptions } from 'photoswipe'
import 'photoswipe/style.css'
import { getAlbumAspectOrDefault, setAlbumAspect } from '@/services/imageAspect'
import {
  type CachedPreviewSlide,
  invalidatePreviewSlide,
  isPreviewSlideReady,
  peekPreviewSlideCache,
  resolvePreviewSlide,
  syncPreviewDataSourceFromCache,
  updatePreviewSlideDimensions,
} from '@/services/imagePreviewCache'
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

type PswpSlide = {
  width: number
  height: number
  isActive: boolean
  currentResolution: number
  currZoomLevel: number
  pan: { x: number; y: number }
  panAreaSize: { x: number; y: number }
  zoomLevels: {
    initial: number
    min: number
    max: number
    update: (w: number, h: number, pan: { x: number; y: number }) => void
  }
  bounds: {
    update: (zoom: number) => void
    correctPan: (axis: 'x' | 'y', value: number) => number
  }
  calculateSize: () => void
  setZoomLevel: (zoom: number) => void
  zoomAndPanToInitial: () => void
  applyCurrentZoomPan: () => void
  updateContentSize: (force?: boolean) => void
}

type PswpContent = {
  index: number
  data: Record<string, unknown> & {
    src?: string
    width?: number
    height?: number
    key?: string
  }
  width: number
  height: number
  element?: HTMLElement
  slide?: PswpSlide
  load: (isLazy?: boolean, reload?: boolean) => void
  setDisplayedSize: (width: number, height: number) => void
  displayError: () => void
}

let pswp: PhotoSwipe | null = null
let opening = false
let openSeq = 0
let syncingFromViewer = false
let activeGallery: FileRecord[] = []
let previewHistoryActive = false
let previewHistoryGeneration = 0
let activePreviewHistoryGeneration = 0
let closingPreviewFromHistory = false
let bootHideTimer = 0
let bootHidden = false
let activeDataSource: PswpSlideItem[] = []
let savedScrollY = 0
let previousScrollRestoration: ScrollRestoration | undefined
const prefetchingKeys = new Set<string>()

const PRELOAD_RADIUS = 2
const PREVIEW_BG_OPACITY = 0.55
const PREVIEW_HISTORY_STATE = 'heroxin-mobile-preview'

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
  pswp?.close()
}

function updateCounterText(instance: PhotoSwipe, counterEl: HTMLElement) {
  const total = instance.getNumItems()
  if (total <= 1) {
    counterEl.style.display = 'none'
    return
  }

  counterEl.style.display = ''
  counterEl.textContent = `${instance.currIndex + 1} / ${total}`
}

function registerMobilePreviewUi(instance: PhotoSwipe) {
  instance.on('uiRegister', () => {
    instance.ui?.registerElement({
      name: 'heroxin-counter',
      className: 'heroxin-pswp-counter',
      order: 15,
      isButton: false,
      tagName: 'div',
      appendTo: 'wrapper',
      onInit: (counterEl, pswp) => {
        const update = () => updateCounterText(pswp, counterEl)
        pswp.on('change', update)
        pswp.on('afterInit', update)
        update()
      },
    })
  })
}

function nearbyIndices(center: number, total: number, radius = PRELOAD_RADIUS): number[] {
  const indices: number[] = []
  for (let offset = -radius; offset <= radius; offset += 1) {
    const index = center + offset
    if (index >= 0 && index < total) indices.push(index)
  }
  return indices
}

function estimateSlideSize(key: string): { width: number; height: number } {
  const aspect = getAlbumAspectOrDefault(key)
  const width = 1600
  const height = Math.max(1, Math.round(width / aspect))
  return { width, height }
}

type PswpSlideItem = {
  type: 'image'
  src?: string
  width: number
  height: number
  alt: string
  key: string
}

function toPswpSlideItem(slide: CachedPreviewSlide | undefined, record: FileRecord): PswpSlideItem {
  const size = slide
    ? { width: slide.width, height: slide.height }
    : estimateSlideSize(record.key)

  if (slide?.src) {
    return {
      type: 'image',
      src: slide.src,
      width: size.width,
      height: size.height,
      alt: slide.alt,
      key: record.key,
    }
  }

  return {
    type: 'image',
    width: size.width,
    height: size.height,
    alt: record.name,
    key: record.key,
  }
}

function finishOpenAttempt(seq: number) {
  if (seq === openSeq) opening = false
}

function abortOpenAttempt(seq: number) {
  if (seq !== openSeq || !props.modelValue) {
    finishOpenAttempt(seq)
    resetBootOverlay()
    return true
  }
  return false
}

function isViewerOpen(instance: PhotoSwipe | null = pswp): boolean {
  return Boolean(instance?.opener?.isOpen)
}

function goToGalleryKey(key: string) {
  const instance = pswp
  if (!instance || !isViewerOpen(instance)) return false
  const index = activeGallery.findIndex((item) => item.key === key)
  if (index < 0 || index === instance.currIndex) return index >= 0
  instance.goTo(index)
  return true
}

function displayedSizeForSlide(slide: CachedPreviewSlide) {
  const displayW = Math.max(1, Math.min(slide.width, window.innerWidth || 1600))
  const displayH = Math.max(1, Math.round((displayW * slide.height) / slide.width))
  return { displayW, displayH }
}

function isContentLoaded(content: PswpContent): boolean {
  return (content as { state?: string }).state === 'loaded' && Boolean(content.element)
}

function updateSlideDimensions(
  slide: PswpSlide,
  width: number,
  height: number,
  options: { preserveZoom?: boolean } = {},
) {
  const preserveZoom = Boolean(options.preserveZoom && slide.isActive)
  const prevZoom = slide.currZoomLevel
  const prevPan = { x: slide.pan.x, y: slide.pan.y }
  const wasZoomed = prevZoom > slide.zoomLevels.initial + 0.001

  slide.width = width
  slide.height = height
  slide.calculateSize()

  if (preserveZoom && wasZoomed) {
    const nextZoom = Math.min(Math.max(prevZoom, slide.zoomLevels.min), slide.zoomLevels.max)
    slide.setZoomLevel(nextZoom)
    slide.bounds.update(slide.currZoomLevel)
    slide.pan.x = slide.bounds.correctPan('x', prevPan.x)
    slide.pan.y = slide.bounds.correctPan('y', prevPan.y)
    slide.applyCurrentZoomPan()
    slide.updateContentSize(true)
    return
  }

  slide.currentResolution = 0
  slide.zoomAndPanToInitial()
  slide.applyCurrentZoomPan()
  slide.updateContentSize(true)
}

function ensureContentImageLoads(content: PswpContent, slide: CachedPreviewSlide, isLazy: boolean) {
  const pswpSlide = content.slide
  const alreadyLoaded = isContentLoaded(content)

  if (pswpSlide) {
    pswpSlide.width = slide.width
    pswpSlide.height = slide.height
    pswpSlide.calculateSize()
  }

  if (!alreadyLoaded) {
    content.load(isLazy, false)
  }

  if (pswpSlide) {
    updateSlideDimensions(pswpSlide, slide.width, slide.height, {
      preserveZoom: alreadyLoaded,
    })
    return
  }

  const { displayW, displayH } = displayedSizeForSlide(slide)
  content.setDisplayedSize(displayW, displayH)
}

function applySlideToContent(content: PswpContent, slide: CachedPreviewSlide) {
  content.data.src = slide.src
  content.data.width = slide.width
  content.data.height = slide.height
  content.width = slide.width
  content.height = slide.height
}

function syncMeasuredSize(content: PswpContent) {
  const element = content.element
  if (!element || element.tagName !== 'IMG') return

  const img = element as HTMLImageElement
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (!width || !height) return

  const key = content.data.key as string | undefined
  if (key) {
    setAlbumAspect(key, width / height)
    updatePreviewSlideDimensions(key, width, height, img.currentSrc || img.src)
  }

  if (content.width === width && content.height === height) return

  content.data.width = width
  content.data.height = height
  content.width = width
  content.height = height

  const slide = content.slide
  if (!slide) return
  updateSlideDimensions(slide, width, height, { preserveZoom: slide.isActive })
}

/**
 * PhotoSwipe：content.load() 在 displayedImageWidth===0 时只建 img 不设 src。
 * 必须随后 setDisplayedSize / updateContentSize 才会 loadImage。
 */
async function loadSlideOnDemand(content: PswpContent, isLazy: boolean) {
  const record = activeGallery[content.index]
  if (!record) {
    content.displayError()
    return
  }

  try {
    const slide = await resolvePreviewSlide(record, true)
    applySlideToContent(content, slide)
    ensureContentImageLoads(content, slide, isLazy)
  } catch (error) {
    showAppError(error)
    content.displayError()
  }
}

function ensureActiveSlideLoaded(instance: PhotoSwipe) {
  const content = instance.currSlide?.content as PswpContent | undefined
  if (!content) return

  const state = (content as { state?: string }).state
  if (content.data.src && (state === 'loaded' || state === 'loading')) return

  const record = activeGallery[content.index]
  if (!record) return

  const cached = peekPreviewSlideCache(record.key)
  if (content.data.src && state !== 'loaded') {
    const slide =
      cached ??
      ({
        src: content.data.src as string,
        width: content.width,
        height: content.height,
        alt: record.name,
        key: record.key,
        measured: true,
      } as CachedPreviewSlide)
    ensureContentImageLoads(content, slide, false)
    return
  }

  void loadSlideOnDemand(content, false)
}

function resetBootOverlay() {
  bootHidden = false
  bootLoading.value = false
  bootError.value = ''
  if (bootHideTimer) {
    window.clearTimeout(bootHideTimer)
    bootHideTimer = 0
  }
}

function hideBootOverlay() {
  if (bootHidden) return
  bootHidden = true
  bootLoading.value = false
  if (bootHideTimer) {
    window.clearTimeout(bootHideTimer)
    bootHideTimer = 0
  }
}

function scheduleBootOverlayFallback() {
  if (bootHideTimer) window.clearTimeout(bootHideTimer)
  bootHideTimer = window.setTimeout(() => hideBootOverlay(), 12000)
}

function tryHideBootOverlay(content: PswpContent) {
  const slide = content.slide
  if (!slide?.isActive) return
  hideBootOverlay()
}

function prefetchNearby(centerIndex: number, instance: PhotoSwipe | null = pswp) {
  const list = activeGallery
  if (list.length === 0 || !instance) return

  for (const index of nearbyIndices(centerIndex, list.length, PRELOAD_RADIUS)) {
    const record = list[index]!
    const cached = peekPreviewSlideCache(record.key)
    if (cached?.src && cached.measured) continue
    if (prefetchingKeys.has(record.key)) continue

    prefetchingKeys.add(record.key)
    void resolvePreviewSlide(record, true)
      .then((slide) => {
        if (pswp !== instance || activeDataSource.length === 0) return
        const hadSrc = Boolean(cached?.src)
        syncPreviewDataSourceFromCache(activeDataSource, list)
        // 已有 src 时只更新 dataSource，避免 refreshSlideContent 触发循环
        if (!hadSrc || !slide.measured) {
          instance.refreshSlideContent(index)
        }
        if (index === instance.currIndex) {
          ensureActiveSlideLoaded(instance)
        }
      })
      .catch(() => {
        // 预取失败不影响当前预览
      })
      .finally(() => {
        prefetchingKeys.delete(record.key)
      })
  }
}

function destroyViewer(options: { emitClosed?: boolean } = {}) {
  const instance = pswp
  pswp = null
  opening = false
  activeGallery = []
  activeDataSource = []
  prefetchingKeys.clear()
  resetBootOverlay()
  disablePreviewHistory(closingPreviewFromHistory)
  closingPreviewFromHistory = false
  if (instance) {
    try {
      instance.destroy()
    } catch {
      // ignore
    }
  }
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

function handleRetry() {
  resetBootOverlay()
  if (props.current?.key) {
    invalidatePreviewSlide(props.current.key)
  }
  if (pswp) {
    destroyViewer()
  }
  void openViewer()
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
  if (startIndex < 0) return

  opening = true
  const currentKey = list[startIndex]!.key
  const cacheReady = isPreviewSlideReady(currentKey)
  bootHidden = cacheReady
  bootLoading.value = !cacheReady
  bootError.value = ''
  const seq = ++openSeq

  try {
    activeGallery = list

    // 当前 + 相邻图先准备好 URL 和尺寸，避免切换黑屏
    await Promise.all(
      nearbyIndices(startIndex, list.length, PRELOAD_RADIUS).map((index) =>
        resolvePreviewSlide(list[index]!, true),
      ),
    )
    if (abortOpenAttempt(seq)) return

    const dataSource: PswpSlideItem[] = list.map((record) =>
      toPswpSlideItem(peekPreviewSlideCache(record.key), record),
    )
    activeDataSource = dataSource

    const instance = new PhotoSwipe({
      dataSource: dataSource as PhotoSwipeOptions['dataSource'],
      index: startIndex,
      mainClass: 'heroxin-mobile-pswp',
      bgOpacity: PREVIEW_BG_OPACITY,
      showHideAnimationType: 'none',
      showHideOpacity: true,
      initialZoomLevel: 'fit',
      secondaryZoomLevel: 2.5,
      maxZoomLevel: 4,
      pinchToClose: true,
      closeOnVerticalDrag: true,
      wheelToZoom: false,
      close: false,
      zoom: false,
      counter: false,
      arrowPrev: false,
      arrowNext: false,
      bgClickAction: 'close',
      imageClickAction: false,
      // 触摸端走 tap 而非 click；单击空白/遮罩关闭，图片上单击无动作（双击缩放）
      tapAction: (_point, event) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return
        if (target.classList.contains('pswp__img')) return
        if (
          target.classList.contains('pswp__item') ||
          target.classList.contains('pswp__zoom-wrap')
        ) {
          instance.close()
        }
      },
      doubleTapAction: 'zoom',
      loop: list.length > 1,
      preload: [PRELOAD_RADIUS, PRELOAD_RADIUS],
      paddingFn: () => ({
        top: 16,
        bottom: 48,
        left: 0,
        right: 0,
      }),
    })

    pswp = instance
    registerMobilePreviewUi(instance)

    // .pswp__bg 不在 container 内，触摸 tap 不会走 tapAction，需单独处理
    instance.on('pointerUp', (event) => {
      const target = event.originalEvent.target
      if (!(target instanceof HTMLElement) || !target.classList.contains('pswp__bg')) return
      const gestures = (instance as PhotoSwipe & { gestures?: { isDragging?: boolean; isZooming?: boolean } }).gestures
      if (gestures?.isDragging || gestures?.isZooming) return
      instance.close()
    })

    instance.on('contentLoad', (event) => {
      if (event.content.data.src) return
      event.preventDefault()
      void loadSlideOnDemand(event.content as PswpContent, event.isLazy)
    })

    instance.on('loadComplete', (event) => {
      if (event.isError) {
        const content = event.content as PswpContent
        if (content.slide?.isActive) {
          void loadSlideOnDemand(content, false)
        }
        return
      }
      syncMeasuredSize(event.content as PswpContent)
      tryHideBootOverlay(event.content as PswpContent)
    })

    instance.on('afterInit', () => {
      const content = instance.currSlide?.content as { state?: string } | undefined
      if (content?.state === 'loaded') {
        tryHideBootOverlay(content as PswpContent)
      }
      ensureActiveSlideLoaded(instance)
    })

    instance.on('change', () => {
      const record = list[instance.currIndex]
      if (record) {
        syncingFromViewer = true
        emit('change', record)
        queueMicrotask(() => {
          syncingFromViewer = false
        })
      }
      ensureActiveSlideLoaded(instance)
      prefetchNearby(instance.currIndex, instance)
    })

    instance.on('close', () => {
      if (!closingPreviewFromHistory) {
        disablePreviewHistory(false)
      } else {
        previewHistoryActive = false
        activePreviewHistoryGeneration = 0
        window.removeEventListener('popstate', handlePreviewPopState)
      }
      closingPreviewFromHistory = false
      emit('update:modelValue', false)
    })

    instance.on('destroy', () => {
      if (pswp === instance) pswp = null
      activeGallery = []
      activeDataSource = []
      resetBootOverlay()
      finishOpenAttempt(seq)
      emit('closed')
    })

    scheduleBootOverlayFallback()
    instance.init()
    enablePreviewHistory()
    finishOpenAttempt(seq)
  } catch (error) {
    finishOpenAttempt(seq)
    resetBootOverlay()
    activeGallery = []
    bootError.value = getErrorMessage(toAppError(error)) || '图片加载失败'
    showAppError(error)
    destroyViewer()
  }
}

watch(
  () => [props.modelValue, props.loading, props.current?.key] as const,
  ([open, isLoading, key]) => {
    if (!open) {
      openSeq += 1
      opening = false
      resetBootOverlay()
      destroyViewer()
      return
    }

    if (isLoading || !key || !props.current) return

    if (pswp && isViewerOpen(pswp)) {
      if (syncingFromViewer) return
      if (goToGalleryKey(key)) return
    }

    if (opening) return
    destroyViewer()
    void openViewer()
  },
  { immediate: true },
)

onUnmounted(() => {
  openSeq += 1
  destroyViewer()
  disablePreviewHistory(closingPreviewFromHistory)
  closingPreviewFromHistory = false
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
      <div v-if="bootLoading || loading" class="mobile-image-preview-boot__panel">
        <el-icon class="mobile-image-preview-boot__spinner" :size="36"><Loading /></el-icon>
        <span>加载中…</span>
      </div>
      <div v-else class="mobile-image-preview-boot__panel">
        <p>{{ bootError || errorMessage || '预览失败' }}</p>
        <div class="mobile-image-preview-boot__actions">
          <el-button type="primary" size="small" @click="handleRetry">重试</el-button>
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
  z-index: 3800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
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
  --pswp-bg: rgba(0, 0, 0, 0.55);
  z-index: 3700 !important;
}

.heroxin-mobile-pswp .pswp__bg {
  background: rgba(0, 0, 0, 0.55) !important;
}

.heroxin-mobile-pswp .pswp__top-bar {
  display: none !important;
}

.heroxin-mobile-pswp .heroxin-pswp-counter {
  position: fixed;
  left: 50%;
  bottom: calc(28px + var(--safe-bottom, 0px));
  transform: translateX(-50%);
  z-index: 20;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
}

.pswp--touch .pswp__button--arrow--prev,
.pswp--touch .pswp__button--arrow--next {
  display: none !important;
}
</style>
