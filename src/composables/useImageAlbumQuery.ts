import { computed, ref } from 'vue'
import type { FileRecord } from '@/types/file'
import { isAlbumMediaCategory } from '@/constants/fileTypes'
import { FILE_SORT_OPTIONS, type FileSortKey, type FileSortOrder } from '@/composables/useFileListQuery'

function compareRecords(
  a: FileRecord,
  b: FileRecord,
  key: FileSortKey,
  order: FileSortOrder,
): number {
  let result: number
  if (key === 'name') {
    result = a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base', numeric: true })
  } else if (key === 'size') {
    result = a.size - b.size
  } else {
    result = Date.parse(a.uploadedAt) - Date.parse(b.uploadedAt)
  }
  return order === 'asc' ? result : -result
}

/** 相册页：在已加载 records 中筛出图片与视频并搜索 / 排序 */
export function useImageAlbumQuery(getRecords: () => FileRecord[]) {
  const keyword = ref('')
  const sortValue = ref('time-desc')

  const currentSort = computed(() => {
    return FILE_SORT_OPTIONS.find((item) => item.value === sortValue.value) ?? FILE_SORT_OPTIONS[0]
  })

  const albumRecords = computed(() =>
    getRecords().filter((item) => isAlbumMediaCategory(item.category)),
  )

  const filteredRecords = computed(() => {
    const query = keyword.value.trim().toLowerCase()
    const sort = currentSort.value

    const filtered = albumRecords.value.filter((item) => {
      if (!query) return true
      return (
        item.name.toLowerCase().includes(query) ||
        item.key.toLowerCase().includes(query) ||
        item.extension.toLowerCase().includes(query)
      )
    })

    return [...filtered].sort((a, b) => compareRecords(a, b, sort.key, sort.order))
  })

  const filteredTotal = computed(() => filteredRecords.value.length)

  const filteredBytes = computed(() =>
    filteredRecords.value.reduce((sum, item) => sum + item.size, 0),
  )

  function resetQuery() {
    keyword.value = ''
    sortValue.value = 'time-desc'
  }

  return {
    keyword,
    sortValue,
    albumRecords,
    /** @deprecated 使用 albumRecords */
    imageRecords: albumRecords,
    filteredRecords,
    filteredTotal,
    filteredBytes,
    resetQuery,
  }
}
