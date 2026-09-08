<script setup lang="ts">
import { computed } from 'vue'
import UploadPanel from '@/components/upload/UploadPanel.vue'
import UploadProgressBar from '@/components/upload/UploadProgressBar.vue'
import UploadQueueList from '@/components/upload/UploadQueueList.vue'
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
    <header class="home-view__masthead">
      <div class="home-view__masthead-copy">
        <h1 class="home-view__title">上传</h1>
        <p class="home-view__lede">源文件直传 OSS，图片按拍摄日归档</p>
      </div>
      <div class="home-view__masthead-actions">
        <span
          class="home-view__status"
          :class="canUpload ? 'is-ready' : 'is-wait'"
        >
          {{ canUpload ? '可上传' : '待配置' }}
        </span>
        <span v-if="hasTasks" class="home-view__queue-chip">
          {{ summary.success }}/{{ summary.total }} · {{ formatBytes(queueBytes) }}
        </span>
      </div>
    </header>

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

    <section class="home-view__stage">
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
    </section>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
}

.home-view__masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 2px 18px;
}

.home-view__masthead-copy {
  min-width: 0;
}

.home-view__title {
  margin: 0;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--app-text);
}

.home-view__lede {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: var(--app-text-secondary);
}

.home-view__masthead-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 2px;
}

.home-view__status,
.home-view__queue-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.home-view__status.is-ready {
  color: var(--app-text);
  background: color-mix(in srgb, var(--brand-success) 18%, white);
  border: 1px solid color-mix(in srgb, var(--brand-success) 35%, white);
}

.home-view__status.is-wait {
  color: var(--app-text-secondary);
  background: var(--app-surface-muted);
  border: 1px solid var(--app-border);
}

.home-view__queue-chip {
  color: var(--app-text);
  background: color-mix(in srgb, var(--brand-chip) 50%, white);
  border: 1px solid color-mix(in srgb, var(--brand-chip) 65%, white);
}

.home-view__alert {
  margin: 0;
}

.home-view__stage {
  padding: 16px 14px 18px;
  border-radius: var(--app-radius);
  background: color-mix(in srgb, var(--app-surface) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-border) 80%, transparent);
  box-shadow: var(--app-shadow);
  backdrop-filter: blur(6px);
}

.home-view__resolving {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

.queue-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 767px) {
  .home-view__masthead {
    align-items: flex-start;
    padding: 0 0 14px;
  }

  .home-view__lede {
    font-size: 13px;
  }

  .home-view__stage {
    margin: 0 -4px;
    padding: 14px 10px 16px;
    border-radius: 14px;
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
