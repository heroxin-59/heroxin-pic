import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getOssConnectionConfig } from '@/config/oss'
import { deleteOssFile, listAllOssFiles, listOssDirectory } from '@/services/fileList'
import type { UploadFileSuccess } from '@/services/upload'
import { buildFileRecordFromKey, type FileRecord, type FolderEntry } from '@/types/file'
import { getErrorMessage, toAppError } from '@/utils/error'

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

function isDirectChildKey(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false
  const rest = key.slice(prefix.length)
  return Boolean(rest) && !rest.includes('/')
}

function nextFolderUnderPrefix(key: string, prefix: string): FolderEntry | null {
  if (!key.startsWith(prefix)) return null
  const rest = key.slice(prefix.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const name = `${rest.slice(0, slash + 1)}`
  return {
    prefix: `${prefix}${name}`,
    name,
  }
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

  function setRecords(next: FileRecord[]) {
    records.value = next
  }

  /** 从 OSS 加载：全部文件 或 当前目录一层 */
  async function loadFromOss() {
    loading.value = true
    errorMessage.value = ''

    try {
      if (showAllFiles.value) {
        folders.value = []
        const result = await listAllOssFiles()
        setRecords(result.records)
      } else {
        const result = await listOssDirectory(effectivePrefix.value)
        currentPrefix.value = result.prefix
        folders.value = result.folders
        setRecords(result.records)
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

  /** 图片页：扁平列举前缀下全部文件，不改变列表页的目录/全部模式偏好 */
  async function loadAllFilesForGallery() {
    loading.value = true
    errorMessage.value = ''

    try {
      folders.value = []
      const result = await listAllOssFiles()
      setRecords(result.records)
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
    await loadFromOss()
  }

  async function enterFolder(prefix: string) {
    currentPrefix.value = prefix.endsWith('/') ? prefix : `${prefix}/`
    await loadFromOss()
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

  /** 上传成功后乐观写入列表（刷新 OSS 后会被覆盖为权威数据） */
  function addFromUploadSuccess(result: UploadFileSuccess) {
    const record = buildFileRecordFromKey({
      key: result.key,
      size: result.size,
      url: result.url,
      uploadedAt: result.uploadedAt,
      originalName: result.originalName,
    })

    if (showAllFiles.value) {
      const withoutDup = records.value.filter((item) => item.key !== record.key)
      records.value = [record, ...withoutDup]
      return record
    }

    const prefix = effectivePrefix.value
    if (isDirectChildKey(record.key, prefix)) {
      const withoutDup = records.value.filter((item) => item.key !== record.key)
      records.value = [record, ...withoutDup]
      return record
    }

    const folder = nextFolderUnderPrefix(record.key, prefix)
    if (folder && !folders.value.some((item) => item.prefix === folder.prefix)) {
      folders.value = [...folders.value, folder].sort((a, b) =>
        a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base', numeric: true }),
      )
    }

    return record
  }

  function removeRecord(id: string) {
    records.value = records.value.filter((item) => item.id !== id)
  }

  /** 删除 OSS 对象并从列表移除 */
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
    loaded.value = false
    errorMessage.value = ''
  }

  function getByKey(key: string) {
    return records.value.find((item) => item.key === key)
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
