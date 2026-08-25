import { computed, ref } from 'vue'
import { getOssConnectionConfig } from '@/config/oss'
import { getDuplicateStrategy } from '@/config/upload'
import { uploadFileToOss } from '@/services/upload'
import { useFileStore } from '@/stores/files'
import { isAppError } from '@/types/error'
import type { UploadBatchSummary, UploadTask } from '@/types/upload'
import { getErrorCode, getErrorMessage } from '@/utils/error'
import { ObjectKeyPlanner } from '@/utils/objectKey'

function createTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isCancelledError(error: unknown): boolean {
  if (isAppError(error) && error.code === 'CANCELLED') return true
  return getErrorCode(error) === 'CANCELLED'
}

export function useUploadQueue() {
  const tasks = ref<UploadTask[]>([])
  const running = ref(false)
  const currentIndex = ref(-1)
  const cancelRequested = ref(false)
  let activeAbort: AbortController | null = null
  const fileStore = useFileStore()

  const uploading = computed(() => running.value)
  const hasTasks = computed(() => tasks.value.length > 0)
  const currentTask = computed(() =>
    currentIndex.value >= 0 ? (tasks.value[currentIndex.value] ?? null) : null,
  )

  const summary = computed<UploadBatchSummary>(() => {
    const total = tasks.value.length
    const waiting = tasks.value.filter((item) => item.status === 'waiting').length
    const uploadingCount = tasks.value.filter((item) => item.status === 'uploading').length
    const success = tasks.value.filter((item) => item.status === 'success').length
    const failed = tasks.value.filter((item) => item.status === 'error').length
    const cancelled = tasks.value.filter((item) => item.status === 'cancelled').length
    return {
      total,
      waiting,
      uploading: uploadingCount,
      success,
      failed,
      cancelled,
    }
  })

  const hasRetryable = computed(() =>
    tasks.value.some((item) => item.status === 'error' || item.status === 'cancelled'),
  )

  /** 按已完成任务数 + 当前任务进度估算总进度 */
  const overallPercent = computed(() => {
    if (tasks.value.length === 0) return 0

    const doneWeight = tasks.value.reduce((acc, item) => {
      if (item.status === 'success' || item.status === 'error' || item.status === 'cancelled') {
        return acc + 100
      }
      if (item.status === 'uploading') return acc + item.percent
      return acc
    }, 0)

    return Math.round(doneWeight / tasks.value.length)
  })

  const currentTaskLabel = computed(() => {
    const task = currentTask.value
    if (!task) return ''
    return task.file.name
  })

  const currentTaskOrdinal = computed(() => {
    if (currentIndex.value < 0) return 0
    return currentIndex.value + 1
  })

  function clearTasks() {
    if (running.value) return
    tasks.value = []
    currentIndex.value = -1
    cancelRequested.value = false
  }

  function enqueueFiles(files: File[]) {
    if (files.length === 0) return

    const connection = getOssConnectionConfig()
    const strategy = getDuplicateStrategy()
    const planner = new ObjectKeyPlanner(
      connection.dir,
      strategy,
      tasks.value.map((item) => item.objectKey),
    )

    const nextTasks: UploadTask[] = files.map((file) => ({
      id: createTaskId(),
      file,
      objectKey: planner.plan(file.name),
      status: 'waiting',
      percent: 0,
    }))

    tasks.value = [...tasks.value, ...nextTasks]
  }

  /** 取消当前上传，并将仍等待的任务标记为已取消 */
  function cancelAll() {
    if (!running.value && summary.value.waiting === 0) return

    cancelRequested.value = true
    activeAbort?.abort()

    for (const task of tasks.value) {
      if (task.status === 'waiting') {
        task.status = 'cancelled'
        task.error = '已取消'
        task.percent = 0
      }
    }
  }

  function resetTaskForRetry(task: UploadTask) {
    task.status = 'waiting'
    task.percent = 0
    task.error = undefined
    task.result = undefined
  }

  async function startUpload(): Promise<UploadBatchSummary> {
    if (running.value) {
      return summary.value
    }

    running.value = true
    cancelRequested.value = false

    try {
      for (let index = 0; index < tasks.value.length; index += 1) {
        if (cancelRequested.value) {
          break
        }

        const task = tasks.value[index]
        // 仅处理 waiting；失败/取消需显式 retry 后再跑
        if (!task || task.status !== 'waiting') {
          continue
        }

        currentIndex.value = index
        task.status = 'uploading'
        task.percent = 0
        task.error = undefined

        const controller = new AbortController()
        activeAbort = controller

        try {
          const result = await uploadFileToOss({
            file: task.file,
            objectKey: task.objectKey,
            signal: controller.signal,
            onProgress: (percent) => {
              task.percent = percent
            },
          })
          task.result = result
          task.status = 'success'
          task.percent = 100
          fileStore.addFromUploadSuccess(result)
        } catch (error) {
          if (cancelRequested.value || isCancelledError(error)) {
            task.status = 'cancelled'
            task.error = '已取消'
          } else {
            task.status = 'error'
            task.error = getErrorMessage(error)
          }
        } finally {
          if (activeAbort === controller) {
            activeAbort = null
          }
        }
      }
    } finally {
      running.value = false
      currentIndex.value = -1
      activeAbort = null
    }

    return summary.value
  }

  async function retryTask(taskId: string): Promise<UploadBatchSummary | null> {
    const task = tasks.value.find((item) => item.id === taskId)
    if (!task) return null
    if (task.status !== 'error' && task.status !== 'cancelled') return null

    resetTaskForRetry(task)
    return startUpload()
  }

  async function retryFailed(): Promise<UploadBatchSummary> {
    for (const task of tasks.value) {
      if (task.status === 'error' || task.status === 'cancelled') {
        resetTaskForRetry(task)
      }
    }
    return startUpload()
  }

  return {
    tasks,
    running,
    uploading,
    hasTasks,
    hasRetryable,
    currentTask,
    currentTaskLabel,
    currentTaskOrdinal,
    summary,
    overallPercent,
    enqueueFiles,
    startUpload,
    cancelAll,
    retryTask,
    retryFailed,
    clearTasks,
  }
}
