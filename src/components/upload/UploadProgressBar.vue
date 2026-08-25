<script setup lang="ts">
import type { UploadBatchSummary } from '@/types/upload'

defineProps<{
  uploading: boolean
  percent: number
  summary: UploadBatchSummary
  currentLabel: string
  currentOrdinal: number
}>()

const emit = defineEmits<{
  cancel: []
}>()

function progressStatus(uploading: boolean, failed: number, cancelled: number) {
  if (uploading) return undefined
  if (failed > 0) return 'exception'
  if (cancelled > 0) return 'warning'
  return 'success'
}
</script>

<template>
  <div v-if="summary.total > 0" class="upload-progress">
    <div class="upload-progress__header">
      <div class="upload-progress__title">
        <template v-if="uploading">
          正在上传 {{ currentOrdinal }}/{{ summary.total }}
          <span v-if="currentLabel" class="upload-progress__file" :title="currentLabel">
            · {{ currentLabel }}
          </span>
        </template>
        <template v-else> 上传进度 </template>
      </div>
      <div class="upload-progress__actions">
        <span class="upload-progress__percent">{{ percent }}%</span>
        <el-button v-if="uploading" size="small" type="danger" plain @click="emit('cancel')">
          取消上传
        </el-button>
      </div>
    </div>

    <el-progress
      :percentage="percent"
      :status="progressStatus(uploading, summary.failed, summary.cancelled)"
      :stroke-width="10"
      striped
      :striped-flow="uploading"
    />

    <div class="upload-progress__stats">
      <span>等待 {{ summary.waiting }}</span>
      <span>上传中 {{ summary.uploading }}</span>
      <span class="is-success">成功 {{ summary.success }}</span>
      <span class="is-failed">失败 {{ summary.failed }}</span>
      <span class="is-cancelled">取消 {{ summary.cancelled }}</span>
    </div>
  </div>
</template>

<style scoped>
.upload-progress {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
}

.upload-progress__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.upload-progress__title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-progress__file {
  color: #606266;
}

.upload-progress__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.upload-progress__percent {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
}

.upload-progress__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}

.upload-progress__stats .is-success {
  color: #67c23a;
}

.upload-progress__stats .is-failed {
  color: #f56c6c;
}

.upload-progress__stats .is-cancelled {
  color: #e6a23c;
}

@media (max-width: 767px) {
  .upload-progress {
    padding: 16px;
  }

  .upload-progress__header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .upload-progress__title {
    white-space: normal;
    line-height: 1.4;
  }

  .upload-progress__actions {
    justify-content: space-between;
  }

  .upload-progress__actions :deep(.el-button) {
    min-height: 44px;
    padding: 10px 18px;
    font-size: 15px;
    touch-action: manipulation;
  }

  .upload-progress__stats {
    gap: 8px 14px;
  }
}
</style>
