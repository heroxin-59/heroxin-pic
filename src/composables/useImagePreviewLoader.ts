import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import type { FileRecord } from '@/types/file'
import { loadImageObjectUrl } from '@/services/preview'
import { getErrorMessage, toAppError } from '@/utils/error'
import { showAppError } from '@/utils/message'

/** 图片预览共用：拉取 Blob、软切换、画廊索引 */
export function useImagePreviewLoader(
  current: Ref<FileRecord>,
  gallery: Ref<FileRecord[]>,
  onNavigate: (record: FileRecord) => void,
) {
  const loading = ref(true)
  const loadError = ref('')
  const refreshing = ref(false)
  const imageUrl = ref('')
  const imageEpoch = ref(0)

  let objectUrlToRevoke: string | null = null
  let loadSeq = 0

  const currentIndex = computed(() =>
    gallery.value.findIndex((item) => item.key === current.value.key),
  )

  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(
    () => currentIndex.value >= 0 && currentIndex.value < gallery.value.length - 1,
  )

  const showStageLoading = computed(() => loading.value && !loadError.value && !imageUrl.value)
  const switching = computed(() => loading.value && !!imageUrl.value && !loadError.value)

  function revokeCurrentObjectUrl() {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke)
      objectUrlToRevoke = null
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
    const targetKey = current.value.key

    loading.value = true
    loadError.value = ''

    if (!soft) {
      revokeCurrentObjectUrl()
      imageUrl.value = ''
    }

    try {
      const objectUrl = await loadImageObjectUrl(targetKey)
      if (seq !== loadSeq) {
        URL.revokeObjectURL(objectUrl)
        return
      }

      const previous = objectUrlToRevoke

      if (soft) {
        await decodeImage(objectUrl)
        if (seq !== loadSeq) {
          URL.revokeObjectURL(objectUrl)
          return
        }
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
      if (seq !== loadSeq) return
      loading.value = false
      loadError.value = getErrorMessage(toAppError(error)) || '图片加载失败'
      showAppError(error)
    }
  }

  watch(
    () => current.value.key,
    async (_key, prevKey) => {
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

  function goPrev() {
    if (!hasPrev.value) return
    const prev = gallery.value[currentIndex.value - 1]
    if (prev) onNavigate(prev)
  }

  function goNext() {
    if (!hasNext.value) return
    const next = gallery.value[currentIndex.value + 1]
    if (next) onNavigate(next)
  }

  onUnmounted(() => {
    loadSeq += 1
    revokeCurrentObjectUrl()
  })

  return {
    loading,
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
  }
}
