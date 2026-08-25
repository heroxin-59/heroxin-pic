import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { deleteOssFile, listAllOssFiles } from '@/services/fileList'
import type { UploadFileSuccess } from '@/services/upload'
import { buildFileRecordFromKey, type FileRecord } from '@/types/file'
import { getErrorMessage, toAppError } from '@/utils/error'

export const useFileStore = defineStore('files', () => {
  const records = ref<FileRecord[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const errorMessage = ref('')
  const deletingKey = ref<string | null>(null)

  const total = computed(() => records.value.length)
  const totalBytes = computed(() => records.value.reduce((sum, item) => sum + item.size, 0))

  function setRecords(next: FileRecord[]) {
    records.value = next
  }

  /** 从 OSS 列举全部历史文件（自动分页拉取） */
  async function loadFromOss() {
    loading.value = true
    errorMessage.value = ''

    try {
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

  /** 上传成功后乐观写入列表（刷新 OSS 后会被覆盖为权威数据） */
  function addFromUploadSuccess(result: UploadFileSuccess) {
    const record = buildFileRecordFromKey({
      key: result.key,
      size: result.size,
      url: result.url,
      uploadedAt: result.uploadedAt,
      originalName: result.originalName,
    })

    const withoutDup = records.value.filter((item) => item.key !== record.key)
    records.value = [record, ...withoutDup]
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
    loaded.value = false
    errorMessage.value = ''
  }

  function getByKey(key: string) {
    return records.value.find((item) => item.key === key)
  }

  return {
    records,
    loading,
    loaded,
    errorMessage,
    deletingKey,
    total,
    totalBytes,
    loadFromOss,
    addFromUploadSuccess,
    removeRecord,
    deleteRecord,
    clearRecords,
    getByKey,
  }
})
