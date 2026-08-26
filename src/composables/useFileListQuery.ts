import { computed, ref, watch } from 'vue'
import type { FileCategory } from '@/constants/fileTypes'
import type { FileRecord } from '@/types/file'

export type FileSortKey = 'time' | 'name' | 'size'
export type FileSortOrder = 'asc' | 'desc'
export type FileCategoryFilter = 'all' | FileCategory

export const DEFAULT_FILE_PAGE_SIZE = 10
export const FILE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200]

export interface FileSortOption {
  value: string
  label: string
  key: FileSortKey
  order: FileSortOrder
}

export const FILE_SORT_OPTIONS: FileSortOption[] = [
  { value: 'time-desc', label: '时间：新 → 旧', key: 'time', order: 'desc' },
  { value: 'time-asc', label: '时间：旧 → 新', key: 'time', order: 'asc' },
  { value: 'name-asc', label: '名称：A → Z', key: 'name', order: 'asc' },
  { value: 'name-desc', label: '名称：Z → A', key: 'name', order: 'desc' },
  { value: 'size-desc', label: '大小：大 → 小', key: 'size', order: 'desc' },
  { value: 'size-asc', label: '大小：小 → 大', key: 'size', order: 'asc' },
]

export const FILE_CATEGORY_FILTERS: Array<{ value: FileCategoryFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'text', label: '文本' },
  { value: 'other', label: '其他' },
]

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

/** 文件列表页：搜索 / 类型筛选 / 排序 / 分页（基于已加载的 records） */
export function useFileListQuery(getRecords: () => FileRecord[]) {
  const keyword = ref('')
  const category = ref<FileCategoryFilter>('all')
  const sortValue = ref('time-desc')
  const page = ref(1)
  const pageSize = ref(DEFAULT_FILE_PAGE_SIZE)

  const currentSort = computed(() => {
    return FILE_SORT_OPTIONS.find((item) => item.value === sortValue.value) ?? FILE_SORT_OPTIONS[0]
  })

  const filteredRecords = computed(() => {
    const query = keyword.value.trim().toLowerCase()
    const sort = currentSort.value
    const cat = category.value

    const filtered = getRecords().filter((item) => {
      if (cat !== 'all' && item.category !== cat) {
        return false
      }
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

  const pageCount = computed(() => Math.max(1, Math.ceil(filteredTotal.value / pageSize.value)))

  const paginatedRecords = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return filteredRecords.value.slice(start, start + pageSize.value)
  })

  const pageRangeStart = computed(() => {
    if (filteredTotal.value === 0) return 0
    return (page.value - 1) * pageSize.value + 1
  })

  const pageRangeEnd = computed(() => {
    return Math.min(page.value * pageSize.value, filteredTotal.value)
  })

  watch([keyword, category, sortValue, pageSize], () => {
    page.value = 1
  })

  watch(filteredTotal, (total) => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
    }
  })

  /** 切换列表范围/目录时清搜索与分页 */
  function resetListFilters() {
    keyword.value = ''
    category.value = 'all'
    sortValue.value = 'time-desc'
    page.value = 1
  }

  function resetQuery() {
    keyword.value = ''
    category.value = 'all'
    sortValue.value = 'time-desc'
    page.value = 1
    pageSize.value = DEFAULT_FILE_PAGE_SIZE
  }

  return {
    keyword,
    category,
    sortValue,
    page,
    pageSize,
    filteredRecords,
    filteredTotal,
    filteredBytes,
    paginatedRecords,
    pageCount,
    pageRangeStart,
    pageRangeEnd,
    resetListFilters,
    resetQuery,
  }
}
