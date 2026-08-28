import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOssConnectionConfig } from '@/config/oss'
import { deleteOssFile, listAllOssFiles } from '@/services/fileList'
import type { UploadFileSuccess } from '@/services/upload'
import { buildFileRecordFromKey, type FileRecord, type FolderEntry } from '@/types/file'
import { getErrorMessage, toAppError } from '@/utils/error'
import {
  listDirectoryFromFullList,
  removeFullListRecordById,
  upsertFullListRecord,
} from '@/utils/fileListCache'

const SHOW_ALL_FILES_STORAGE_KEY = 'heroxin-pic:show-all-files'

function readShowAllFilesPreference(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_ALL_FILES_STORAGE_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

function writeShowAllFilesPreference(value: boolean) {
  try {
    localStorage.setItem(SHOW_ALL_FILES_STORAGE_KEY, value ? '1' : '0')
  } catch {
    // ignore quota / private mode
  }
}

/** 面包屑：相对配置根目录的可点击路径 */
export interface FolderBreadcrumb {
  label: string
  prefix: string
}

function buildBreadcrumbs(rootPrefix: string, currentPrefix: string): FolderBreadcrumb[] {
  const root = rootPrefix.endsWith('/') ? rootPrefix : `${rootPrefix}/`
  const current = currentPrefix.endsWith('/') ? currentPrefix : `${currentPrefix}/`
  const crumbs: FolderBreadcrumb[] = [{ label: '/', prefix: root }]

  if (!current.startsWith(root) || current === root) {
    return crumbs
  }

  const relative = current.slice(root.length)
  const segments = relative.split('/').filter(Boolean)
  let cursor = root
  for (const segment of segments) {
    cursor = `${cursor}${segment}/`
    crumbs.push({ label: `${segment}/`, prefix: cursor })
  }
  return crumbs
}

export const useFileStore = defineStore('files', () => {
  const records = ref<FileRecord[]>([])
  const folders = ref<FolderEntry[]>([])
  /** true：扁平列举全部；false：按目录层级浏览 */
  const showAllFiles = ref(readShowAllFilesPreference())
  /** 层级模式下的当前前缀；空则使用配置根目录 */
  const currentPrefix = ref('')
  const loading = ref(false)
  const loaded = ref(false)
  const errorMessage = ref('')
  const deletingKey = ref<string | null>(null)

  /** 会话内全量文件列表缓存（OSS list 一次，上传/删除本地增量更新） */
  const fullListSnapshot = ref<FileRecord[] | null>(null)
  let fullListLoadPromise: Promise<FileRecord[]> | null = null

  const rootPrefix = computed(() => getOssConnectionConfig().dir)

  const effectivePrefix = computed(() => {
    const current = currentPrefix.value.trim()
    if (current) return current.endsWith('/') ? current : `${current}/`
    return rootPrefix.value
  })

  const breadcrumbs = computed(() => buildBreadcrumbs(rootPrefix.value, effectivePrefix.value))

  const total = computed(() => records.value.length)
  const folderCount = computed(() => folders.value.length)
  const totalBytes = computed(() => records.value.reduce((sum, item) => sum + item.size, 0))
  const hasListContent = computed(() => total.value > 0 || folderCount.value > 0)
  const hasFullListCache = computed(() => fullListSnapshot.value !== null)

  function setRecords(next: FileRecord[]) {
    records.value = next
  }

  function applyCurrentListView() {
    if (!fullListSnapshot.value) return

    if (showAllFiles.value) {
      folders.value = []
      setRecords(fullListSnapshot.value)
      return
    }

    const result = listDirectoryFromFullList(
      fullListSnapshot.value,
      effectivePrefix.value,
      rootPrefix.value,
    )
    currentPrefix.value = result.prefix
    folders.value = result.folders
    setRecords(result.records)
  }

  function patchFullListSnapshot(next: FileRecord[] | null) {
    fullListSnapshot.value = next
  }

  function upsertCachedRecord(record: FileRecord) {
    const base = fullListSnapshot.value ?? []
    patchFullListSnapshot(upsertFullListRecord(base, record))
    applyCurrentListView()
  }

  function removeCachedRecord(id: string) {
    if (fullListSnapshot.value) {
      patchFullListSnapshot(removeFullListRecordById(fullListSnapshot.value, id))
    }
    records.value = records.value.filter((item) => item.id !== id)
  }

  /**
   * 确保全量列表已加载。默认复用会话缓存；`force: true` 时重新请求 OSS（用于手动刷新）。
   */
  async function ensureFullListLoaded(options?: { force?: boolean }): Promise<FileRecord[]> {
    if (options?.force) {
      fullListSnapshot.value = null
      fullListLoadPromise = null
    }

    if (fullListSnapshot.value) {
      return fullListSnapshot.value
    }

    if (fullListLoadPromise) {
      return fullListLoadPromise
    }

    fullListLoadPromise = (async () => {
      const result = await listAllOssFiles()
      patchFullListSnapshot(result.records)
      return result.records
    })()

    try {
      return await fullListLoadPromise
    } finally {
      fullListLoadPromise = null
    }
  }

  async function applyListViewFromCache(options?: { force?: boolean }) {
    loading.value = true
    errorMessage.value = ''

    try {
      await ensureFullListLoaded(options)
      applyCurrentListView()
      loaded.value = true
    } catch (error) {
      const appError = toAppError(error)
      errorMessage.value = getErrorMessage(appError)
      loaded.value = true
      throw appError
    } finally {
      loading.value = false
    }
  }

  /** 从 OSS 加载：全部文件 或 当前目录一层（均基于全量缓存切片，不重复 list） */
  async function loadFromOss(options?: { force?: boolean }) {
    await applyListViewFromCache(options)
  }

  /** 相册页：扁平列举前缀下全部文件，不改变列表页的目录/全部模式偏好 */
  async function loadAllFilesForGallery(options?: { force?: boolean }) {
    loading.value = true
    errorMessage.value = ''

    try {
      await ensureFullListLoaded(options)
      folders.value = []
      if (fullListSnapshot.value) {
        setRecords(fullListSnapshot.value)
      }
      loaded.value = true
    } catch (error) {
      const appError = toAppError(error)
      errorMessage.value = getErrorMessage(appError)
      loaded.value = true
      throw appError
    } finally {
      loading.value = false
    }
  }

  async function setShowAllFiles(value: boolean) {
    if (showAllFiles.value === value) return
    showAllFiles.value = value
    writeShowAllFilesPreference(value)
    if (value) {
      currentPrefix.value = ''
    }
    await applyListViewFromCache()
  }

  async function enterFolder(prefix: string) {
    currentPrefix.value = prefix.endsWith('/') ? prefix : `${prefix}/`
    await applyListViewFromCache()
  }

  async function navigateToPrefix(prefix: string) {
    await enterFolder(prefix)
  }

  async function goParentFolder() {
    const crumbs = breadcrumbs.value
    if (crumbs.length <= 1) return
    const parent = crumbs[crumbs.length - 2]
    if (parent) await enterFolder(parent.prefix)
  }

  /** 上传成功后写入全量缓存并刷新当前视图（不再整表 list） */
  function addFromUploadSuccess(result: UploadFileSuccess) {
    const record = buildFileRecordFromKey({
      key: result.key,
      size: result.size,
      url: result.url,
      uploadedAt: result.uploadedAt,
      originalName: result.originalName,
    })

    upsertCachedRecord(record)
    return record
  }

  function removeRecord(id: string) {
    removeCachedRecord(id)
  }

  /** 删除 OSS 对象并从缓存移除 */
  async function deleteRecord(record: FileRecord) {
    deletingKey.value = record.key
    try {
      await deleteOssFile(record.key)
      removeRecord(record.id)
    } catch (error) {
      throw toAppError(error)
    } finally {
      deletingKey.value = null
    }
  }

  function clearRecords() {
    records.value = []
    folders.value = []
    fullListSnapshot.value = null
    fullListLoadPromise = null
    loaded.value = false
    errorMessage.value = ''
  }

  function getByKey(key: string) {
    const fromView = records.value.find((item) => item.key === key)
    if (fromView) return fromView
    return fullListSnapshot.value?.find((item) => item.key === key)
  }

  return {
    records,
    folders,
    showAllFiles,
    currentPrefix,
    effectivePrefix,
    breadcrumbs,
    loading,
    loaded,
    errorMessage,
    deletingKey,
    total,
    folderCount,
    totalBytes,
    hasListContent,
    hasFullListCache,
    ensureFullListLoaded,
    loadFromOss,
    loadAllFilesForGallery,
    setShowAllFiles,
    enterFolder,
    navigateToPrefix,
    goParentFolder,
    addFromUploadSuccess,
    removeRecord,
    deleteRecord,
    clearRecords,
    getByKey,
  }
})
