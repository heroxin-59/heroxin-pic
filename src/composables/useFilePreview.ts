import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import {
  getPreviewKind,
  openPreviewDownload,
  resolvePreviewRecord,
  type PreviewType,
} from '@/services/preview'
import { useFileStore } from '@/stores/files'
import type { FileRecord } from '@/types/file'
import { showAppError, showAppSuccess } from '@/utils/message'

function isMediaRecord(item: FileRecord): boolean {
  return item.category === 'image' || item.category === 'video'
}

export interface UseFilePreviewOptions {
  /**
   * 可选：左右切换范围（相册传入含图片+视频的列表）。
   * 不传则使用 store 中已加载的图片与视频。
   */
  gallery?: () => FileRecord[] | undefined
}

/**
 * 文件预览状态（阶段 7.5）：解析记录、类型分支、下载。
 * 弹窗与独立预览页共用，避免两套 load/download 逻辑。
 */
export function useFilePreview(options: UseFilePreviewOptions = {}) {
  const fileStore = useFileStore()
  const { records } = storeToRefs(fileStore)

  const current = ref<FileRecord | null>(null)
  const loading = ref(false)
  const errorMessage = ref('')

  const previewKind = computed<PreviewType | null>(() =>
    current.value ? getPreviewKind(current.value) : null,
  )

  /** 图片 + 视频连续切换范围（相册混合预览） */
  const mediaGallery = computed(() => {
    const fromOption = options.gallery?.()?.filter(isMediaRecord) ?? null
    const media =
      fromOption && fromOption.length > 0
        ? fromOption
        : records.value.filter(isMediaRecord)

    if (!current.value || !isMediaRecord(current.value)) return media
    if (!media.some((item) => item.key === current.value!.key)) {
      return [current.value, ...media]
    }
    return media
  })

  const imageGallery = computed(() => {
    const images = mediaGallery.value.filter((item) => item.category === 'image')
    if (!current.value || current.value.category !== 'image') return images
    if (!images.some((item) => item.key === current.value!.key)) {
      return [current.value, ...images]
    }
    return images
  })

  const videoGallery = computed(() => {
    const videos = mediaGallery.value.filter((item) => item.category === 'video')
    if (!current.value || current.value.category !== 'video') return videos
    if (!videos.some((item) => item.key === current.value!.key)) {
      return [current.value, ...videos]
    }
    return videos
  })

  async function load(source: { key: string; name?: string }) {
    loading.value = true
    errorMessage.value = ''
    try {
      current.value = await resolvePreviewRecord({
        key: source.key,
        name: source.name,
      })
    } catch (error) {
      current.value = null
      errorMessage.value = '无法加载预览'
      showAppError(error)
    } finally {
      loading.value = false
    }
  }

  function setCurrent(record: FileRecord) {
    current.value = record
  }

  function clear() {
    current.value = null
    errorMessage.value = ''
    loading.value = false
  }

  async function download() {
    if (!current.value) return
    try {
      await openPreviewDownload(current.value)
      showAppSuccess('已开始下载')
    } catch (error) {
      showAppError(error)
    }
  }

  return {
    current,
    loading,
    errorMessage,
    previewKind,
    mediaGallery,
    imageGallery,
    videoGallery,
    load,
    setCurrent,
    clear,
    download,
  }
}
