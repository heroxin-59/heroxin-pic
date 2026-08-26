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

export interface UseFilePreviewOptions {
  /**
   * 可选：图片左右切换范围。
   * 不传则使用 store 中全部已加载图片。
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

  const imageGallery = computed(() => {
    const fromOption = options.gallery?.()?.filter((item) => item.category === 'image') ?? null
    const images =
      fromOption && fromOption.length > 0
        ? fromOption
        : records.value.filter((item) => item.category === 'image')

    if (!current.value || current.value.category !== 'image') return images
    if (!images.some((item) => item.key === current.value!.key)) {
      return [current.value, ...images]
    }
    return images
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
    imageGallery,
    load,
    setCurrent,
    clear,
    download,
  }
}
