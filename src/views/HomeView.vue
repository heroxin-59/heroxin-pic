<script setup lang="ts">
import { computed } from 'vue'
import UploadPanel from '@/components/upload/UploadPanel.vue'
import UploadProgressBar from '@/components/upload/UploadProgressBar.vue'
import UploadQueueList from '@/components/upload/UploadQueueList.vue'
import RecentUploads from '@/components/upload/RecentUploads.vue'
import { useOss } from '@/composables/useOss'
import { useUploader } from '@/composables/useUploader'
import { getDuplicateStrategy } from '@/config/upload'
import { AppError } from '@/types/error'
import { getCredentialSourceLabel } from '@/services/sts'
import { filterAllowedFiles, findDuplicateFilenames, sumFileSizes } from '@/utils/fileValidate'
import { formatBytes } from '@/utils/format'
import { showAppError, showAppSuccess, showAppWarning } from '@/utils/message'

const {
  configured: connectionReady,
  missingEnvKeys: missing,
  uploadLimits,
} = useOss()
const credentialSource = getCredentialSourceLabel()

const {
  tasks,
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
  resolvingArchive,
} = useUploader()

const canUpload = computed(() => connectionReady.value && credentialSource !== '未配置')
const queueBytes = computed(() => sumFileSizes(tasks.value.map((item) => item.file)))
const activeTaskId = computed(() => currentTask.value?.id ?? null)
const queueBusy = computed(() => uploading.value || resolvingArchive.value)

async function reportBatchResult() {
  const result = summary.value

  if (result.failed === 0 && result.cancelled === 0) {
    showAppSuccess(`全部上传成功（${result.success}/${result.total}）`)
    return
  }

  if (result.cancelled > 0 && result.failed === 0 && result.success === 0) {
    showAppWarning(`已取消上传（${result.cancelled} 个）`)
    return
  }

  if (result.success === 0 && result.cancelled === 0) {
    showAppError(new AppError('UNKNOWN', `上传失败（${result.failed}/${result.total}）`))
    return
  }

  showAppWarning(
    `上传结束：成功 ${result.success}，失败 ${result.failed}，取消 ${result.cancelled}`,
  )
}

async function onSelectFiles(files: File[]) {
  if (files.length === 0) return

  if (!canUpload.value) {
    showAppError(
      new AppError(
        'CONFIG',
        missing.value.length
          ? `请先配置：${missing.value.join(', ')}`
          : '未配置凭证，请设置 VITE_STS_URL 或本地调试 Key',
      ),
    )
    return
  }

  const existingBatchBytes = sumFileSizes(tasks.value.map((item) => item.file))
  const { accepted, rejected } = filterAllowedFiles(files, { existingBatchBytes })

  if (rejected.length > 0) {
    const preview = rejected
      .slice(0, 2)
      .map((item) => item.message)
      .join('；')
    const suffix = rejected.length > 2 ? ` 等 ${rejected.length} 个` : ''
    showAppError(
      new AppError(rejected[0]?.code ?? 'UNKNOWN', `有文件未通过校验：${preview}${suffix}`),
    )
  }

  if (accepted.length === 0) {
    return
  }

  if (getDuplicateStrategy() === 'overwrite') {
    const duplicates = findDuplicateFilenames(accepted)
    if (duplicates.length > 0) {
      showAppWarning(`覆盖模式下同名文件将互相覆盖：${duplicates.join('、')}（最终以最后一个为准）`)
    }
  }

  await enqueueFiles(accepted)
  await startUpload()
  await reportBatchResult()
}

function onCancelAll() {
  cancelAll()
  showAppWarning('正在取消上传…')
}

async function onRetryTask(taskId: string) {
  await retryTask(taskId)
  await reportBatchResult()
}

async function onRetryFailed() {
  await retryFailed()
  await reportBatchResult()
}

function onClearQueue() {
  clearTasks()
}
</script>

<template>
  <div class="home-view">
    <el-alert
      v-if="!canUpload"
      type="warning"
      :closable="false"
      show-icon
      class="home-view__alert"
      title="上传尚未就绪"
      :description="
        missing.length
          ? `请在 .env.local 填写：${missing.join(', ')}，并配置 STS 或本地调试 Key 后重启开发服务。`
          : '连接配置已有，但仍缺凭证：请设置 VITE_STS_URL 或本地调试 AccessKey。'
      "
    />

    <el-card shadow="never" class="home-view__card">
      <template #header>
        <div class="card-header">
          <span class="card-header__title">上传文件</span>
          <div class="card-header__tags">
            <el-tag v-if="hasTasks" size="small" type="info">
              队列 {{ summary.success }}/{{ summary.total }} · {{ formatBytes(queueBytes) }} /
              {{ uploadLimits.maxTotalSizeMb }} MB
            </el-tag>
            <el-tag size="small" :type="canUpload ? 'success' : 'info'">
              {{ canUpload ? '可上传' : '待配置' }}
            </el-tag>
          </div>
        </div>
      </template>

      <UploadPanel multiple :disabled="!canUpload || queueBusy" @select="onSelectFiles" />

      <p v-if="resolvingArchive" class="home-view__resolving">正在解析图片归档日期…</p>

      <UploadProgressBar
        :uploading="uploading"
        :percent="overallPercent"
        :summary="summary"
        :current-label="currentTaskLabel"
        :current-ordinal="currentTaskOrdinal"
        @cancel="onCancelAll"
      />

      <UploadQueueList
        :tasks="tasks"
        :active-task-id="activeTaskId"
        :uploading="queueBusy"
        @retry="onRetryTask"
      />

      <div v-if="hasTasks && !queueBusy" class="queue-actions">
        <el-button v-if="hasRetryable" size="small" type="primary" plain @click="onRetryFailed">
          重试失败/取消项
        </el-button>
        <el-button size="small" @click="onClearQueue">清空队列</el-button>
      </div>
    </el-card>

    <RecentUploads />
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.home-view__alert {
  margin: 0;
}

.home-view__resolving {
  margin: 12px 0 0;
  font-size: 13px;
  color: #909399;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-header__title {
  font-weight: 600;
}

.card-header__tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.queue-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .card-header {
    flex-wrap: nowrap;
    gap: 8px;
  }

  .card-header__title {
    flex-shrink: 0;
  }

  .card-header__tags {
    margin-left: auto;
    flex-shrink: 0;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .queue-actions {
    flex-direction: column;
  }

  .queue-actions :deep(.el-button) {
    width: 100%;
    min-height: 44px;
    font-size: 15px;
    touch-action: manipulation;
  }
}
</style>
