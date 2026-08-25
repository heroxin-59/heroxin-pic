<script setup lang="ts">
import {
  CircleCheck,
  CircleClose,
  Loading,
  Clock,
  RefreshRight,
  Remove,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { UploadTask, UploadTaskStatus } from '@/types/upload'
import { formatBytes } from '@/utils/format'

defineProps<{
  tasks: UploadTask[]
  activeTaskId?: string | null
  uploading?: boolean
}>()

const emit = defineEmits<{
  retry: [taskId: string]
}>()

const statusLabel: Record<UploadTaskStatus, string> = {
  waiting: '等待中',
  uploading: '上传中',
  success: '成功',
  error: '失败',
  cancelled: '已取消',
}

const statusType: Record<UploadTaskStatus, 'info' | 'primary' | 'success' | 'danger' | 'warning'> =
  {
    waiting: 'info',
    uploading: 'primary',
    success: 'success',
    error: 'danger',
    cancelled: 'warning',
  }

const statusIcon: Record<UploadTaskStatus, Component> = {
  waiting: Clock,
  uploading: Loading,
  success: CircleCheck,
  error: CircleClose,
  cancelled: Remove,
}

function progressStatus(status: UploadTaskStatus) {
  if (status === 'success') return 'success'
  if (status === 'error') return 'exception'
  if (status === 'cancelled') return 'warning'
  return undefined
}

function canRetry(status: UploadTaskStatus, uploading: boolean | undefined) {
  return !uploading && (status === 'error' || status === 'cancelled')
}
</script>

<template>
  <div v-if="tasks.length > 0" class="upload-queue">
    <div
      v-for="task in tasks"
      :key="task.id"
      class="upload-queue__item"
      :class="{
        'is-active': activeTaskId === task.id,
        [`is-${task.status}`]: true,
      }"
    >
      <div class="upload-queue__meta">
        <div class="upload-queue__name-row">
          <el-icon class="upload-queue__icon" :class="`icon-${task.status}`">
            <component :is="statusIcon[task.status]" />
          </el-icon>
          <span class="upload-queue__name" :title="task.file.name">{{ task.file.name }}</span>
        </div>
        <div class="upload-queue__right">
          <el-tag size="small" :type="statusType[task.status]">
            {{ statusLabel[task.status] }}
            <template v-if="task.status === 'uploading'"> {{ task.percent }}% </template>
          </el-tag>
          <el-button
            v-if="canRetry(task.status, uploading)"
            size="small"
            text
            type="primary"
            :icon="RefreshRight"
            @click="emit('retry', task.id)"
          >
            重试
          </el-button>
        </div>
      </div>

      <el-progress
        :percentage="task.percent"
        :status="progressStatus(task.status)"
        :stroke-width="6"
      />

      <p v-if="task.error" class="upload-queue__error">{{ task.error }}</p>
      <template v-else>
        <p class="upload-queue__key" :title="task.objectKey">{{ task.objectKey }}</p>
        <p class="upload-queue__size">{{ formatBytes(task.file.size) }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.upload-queue {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.upload-queue__item {
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafafa;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.upload-queue__item.is-active {
  border-color: #409eff;
  background: #ecf5ff;
}

.upload-queue__item.is-success {
  border-color: #e1f3d8;
}

.upload-queue__item.is-error {
  border-color: #fde2e2;
  background: #fef0f0;
}

.upload-queue__item.is-cancelled {
  border-color: #faecd8;
  background: #fdf6ec;
}

.upload-queue__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.upload-queue__name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.upload-queue__right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.upload-queue__icon {
  flex-shrink: 0;
  font-size: 16px;
}

.icon-waiting {
  color: #909399;
}

.icon-uploading {
  color: #409eff;
  animation: spin 1s linear infinite;
}

.icon-success {
  color: #67c23a;
}

.icon-error {
  color: #f56c6c;
}

.icon-cancelled {
  color: #e6a23c;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.upload-queue__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #303133;
}

.upload-queue__size {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}

.upload-queue__key {
  margin: 4px 0 0;
  font-size: 11px;
  color: #a8abb2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-queue__error {
  margin: 4px 0 0;
  font-size: 12px;
  color: #f56c6c;
  line-height: 1.4;
}

.upload-queue__item.is-cancelled .upload-queue__error {
  color: #e6a23c;
}

@media (max-width: 767px) {
  .upload-queue__item {
    padding: 14px;
  }

  .upload-queue__meta {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .upload-queue__right {
    justify-content: space-between;
  }

  .upload-queue__right :deep(.el-button) {
    min-height: 40px;
    padding: 8px 12px;
    font-size: 14px;
    touch-action: manipulation;
  }

  .upload-queue__name {
    font-size: 14px;
  }
}
</style>
