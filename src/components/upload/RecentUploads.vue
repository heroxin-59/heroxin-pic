<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { getCategoryLabel } from '@/constants/fileTypes'
import { useFileStore } from '@/stores/files'
import { formatBytes } from '@/utils/format'

const router = useRouter()
const fileStore = useFileStore()
const { records, total, totalBytes } = storeToRefs(fileStore)

const recentRecords = computed(() => records.value.slice(0, 5))

function formatTime(value: string) {
  return new Date(value).toLocaleString()
}

function goToFileList() {
  router.push('/files')
}
</script>

<template>
  <el-card v-if="total > 0" shadow="never" class="recent-uploads">
    <template #header>
      <div class="recent-uploads__header">
        <span>本次会话已上传（{{ total }}）</span>
        <el-button text type="primary" class="recent-uploads__link" @click="goToFileList">
          查看全部
        </el-button>
      </div>
    </template>

    <el-table :data="recentRecords" size="small" stripe class="recent-uploads__table">
      <el-table-column prop="name" label="文件名" min-width="140" show-overflow-tooltip />
      <el-table-column label="类型" width="88">
        <template #default="{ row }">
          {{ getCategoryLabel(row.category) }}
        </template>
      </el-table-column>
      <el-table-column label="大小" width="88">
        <template #default="{ row }">
          {{ formatBytes(row.size) }}
        </template>
      </el-table-column>
      <el-table-column label="上传时间" width="168">
        <template #default="{ row }">
          {{ formatTime(row.uploadedAt) }}
        </template>
      </el-table-column>
    </el-table>

    <ul class="recent-uploads__cards">
      <li v-for="row in recentRecords" :key="row.id" class="recent-uploads__card">
        <div class="recent-uploads__card-name">{{ row.name }}</div>
        <div class="recent-uploads__card-meta">
          <el-tag size="small" type="info">{{ getCategoryLabel(row.category) }}</el-tag>
          <span>{{ formatBytes(row.size) }}</span>
          <span>{{ formatTime(row.uploadedAt) }}</span>
        </div>
      </li>
    </ul>

    <p class="recent-uploads__summary">
      合计 {{ formatBytes(totalBytes) }} · 完整历史请打开「文件」页从 OSS 刷新
    </p>
  </el-card>
</template>

<style scoped>
.recent-uploads__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.recent-uploads__link {
  min-height: 40px;
  touch-action: manipulation;
}

.recent-uploads__cards {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
}

.recent-uploads__card {
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
}

.recent-uploads__card:last-child {
  border-bottom: none;
}

.recent-uploads__card-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
}

.recent-uploads__card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.recent-uploads__summary {
  margin: 12px 0 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .recent-uploads__table {
    display: none;
  }

  .recent-uploads__cards {
    display: block;
  }
}
</style>
