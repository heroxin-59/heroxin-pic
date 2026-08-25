<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessageBox } from 'element-plus'
import { CopyDocument, Delete, Download, Refresh, Search, View } from '@element-plus/icons-vue'
import FileTypeIcon from '@/components/file-list/FileTypeIcon.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import {
  FILE_CATEGORY_FILTERS,
  FILE_PAGE_SIZE_OPTIONS,
  FILE_SORT_OPTIONS,
  useFileListQuery,
} from '@/composables/useFileListQuery'
import { getCategoryLabel } from '@/constants/fileTypes'
import { getAccessUrl, getDownloadUrl } from '@/services/fileList'
import { useFileStore } from '@/stores/files'
import type { FileRecord } from '@/types/file'
import { formatBytes } from '@/utils/format'
import { showAppError, showAppSuccess, showAppWarning } from '@/utils/message'

const router = useRouter()
const { isMobile } = useBreakpoint()
const fileStore = useFileStore()
const { records, total, totalBytes, loading, loaded, errorMessage, deletingKey } =
  storeToRefs(fileStore)

const {
  keyword,
  category,
  sortValue,
  page,
  pageSize,
  filteredTotal,
  filteredBytes,
  paginatedRecords,
  pageRangeStart,
  pageRangeEnd,
  resetQuery,
} = useFileListQuery(() => records.value)

const hasActiveQuery = computed(
  () =>
    keyword.value.trim().length > 0 || category.value !== 'all' || sortValue.value !== 'time-desc',
)

const showEmptyFilter = computed(
  () => loaded.value && !errorMessage.value && total.value > 0 && filteredTotal.value === 0,
)

const paginationLayout = computed(() =>
  isMobile.value ? 'total, sizes, prev, pager, next' : 'total, sizes, prev, pager, next, jumper',
)

function formatTime(value: string) {
  return new Date(value).toLocaleString()
}

function goUpload() {
  router.push({ name: 'home' })
}

async function refresh() {
  try {
    await fileStore.loadFromOss()
    if (fileStore.total === 0) {
      showAppWarning('当前前缀下暂无文件')
    } else {
      showAppSuccess(`已加载 ${fileStore.total} 个文件`)
    }
  } catch (error) {
    showAppError(error)
  }
}

async function copyUrl(row: FileRecord) {
  try {
    const url = await getAccessUrl(row.key)
    await navigator.clipboard.writeText(url)
    showAppSuccess('签名 URL 已复制')
  } catch (error) {
    showAppError(error)
  }
}

async function downloadFile(row: FileRecord) {
  try {
    const url = await getDownloadUrl(row.key, row.name)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = row.name
    anchor.rel = 'noopener'
    anchor.target = '_blank'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } catch (error) {
    showAppError(error)
  }
}

function previewFile(row: FileRecord) {
  router.push({
    name: 'preview',
    query: { key: row.key, name: row.name },
  })
}

async function deleteFile(row: FileRecord) {
  try {
    await ElMessageBox.confirm(`确定从 OSS 删除「${row.name}」吗？此操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger',
    })
  } catch {
    return
  }

  try {
    await fileStore.deleteRecord(row)
    showAppSuccess('已删除')
  } catch (error) {
    showAppError(error)
  }
}

onMounted(() => {
  void fileStore.loadFromOss().catch((error) => {
    showAppError(error)
  })
})
</script>

<template>
  <el-card shadow="never" class="file-list">
    <template #header>
      <div class="file-list__header">
        <div class="file-list__title-wrap">
          <span class="file-list__title">文件列表</span>
          <el-tag size="small" type="info">OSS 历史文件</el-tag>
        </div>
        <div class="file-list__meta">
          <el-tag v-if="loaded && !errorMessage" size="small" type="success">
            <template v-if="filteredTotal !== total">
              匹配 {{ filteredTotal }}/{{ total }} · {{ formatBytes(filteredBytes) }}
            </template>
            <template v-else> {{ total }} 个 · {{ formatBytes(totalBytes) }} </template>
          </el-tag>
          <el-button
            size="small"
            type="primary"
            plain
            :icon="Refresh"
            :loading="loading"
            class="file-list__refresh-btn"
            @click="refresh"
          >
            刷新
          </el-button>
        </div>
      </div>
    </template>

    <div v-if="loading && !loaded" class="file-list__state">
      <div v-loading="true" class="file-list__loading-box" />
      <p class="file-list__loading-text">正在从 OSS 加载历史文件…</p>
      <p class="file-list__loading-hint">文件较多时可能需要稍等片刻</p>
    </div>

    <el-result v-else-if="errorMessage" icon="error" title="加载失败" :sub-title="errorMessage">
      <template #extra>
        <el-button type="primary" :loading="loading" @click="refresh">重试</el-button>
      </template>
    </el-result>

    <el-empty v-else-if="loaded && total === 0" class="file-list__empty">
      <template #description>
        <p>当前 OSS 前缀下暂无文件</p>
        <p class="file-list__empty-hint">上传成功后会出现在此列表</p>
      </template>
      <el-button type="primary" @click="goUpload">去上传</el-button>
    </el-empty>

    <template v-else-if="total > 0">
      <div class="file-list__toolbar">
        <el-input
          v-model="keyword"
          class="file-list__search"
          clearable
          placeholder="搜索文件名 / Key / 扩展名"
          :prefix-icon="Search"
        />
        <el-select v-model="category" class="file-list__filter" placeholder="类型">
          <el-option
            v-for="item in FILE_CATEGORY_FILTERS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="sortValue" class="file-list__sort" placeholder="排序">
          <el-option
            v-for="item in FILE_SORT_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button v-if="hasActiveQuery" text type="primary" @click="resetQuery">重置</el-button>
      </div>

      <el-empty v-if="showEmptyFilter" class="file-list__empty">
        <template #description>
          <p>没有符合条件的文件</p>
          <p class="file-list__empty-hint">试试调整搜索关键词或类型筛选</p>
        </template>
        <el-button type="primary" plain @click="resetQuery">清除筛选</el-button>
      </el-empty>

      <template v-else>
        <p v-if="filteredTotal > 0" class="file-list__range">
          第 {{ pageRangeStart }}–{{ pageRangeEnd }} 条，共 {{ filteredTotal }} 条
        </p>

        <el-table v-loading="loading" :data="paginatedRecords" stripe class="file-list__table">
          <el-table-column label="名称" min-width="200">
            <template #default="{ row }">
              <div class="file-list__name-cell">
                <FileTypeIcon :category="row.category" />
                <span class="file-list__name" :title="row.name">{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag size="small" type="info">{{ getCategoryLabel(row.category) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="100">
            <template #default="{ row }">
              {{ formatBytes(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="上传时间" width="170">
            <template #default="{ row }">
              {{ formatTime(row.uploadedAt) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" :icon="View" @click="previewFile(row)">
                预览
              </el-button>
              <el-button
                size="small"
                text
                type="primary"
                :icon="Download"
                @click="downloadFile(row)"
              >
                下载
              </el-button>
              <el-button
                size="small"
                text
                type="primary"
                :icon="CopyDocument"
                @click="copyUrl(row)"
              >
                复制
              </el-button>
              <el-button
                size="small"
                text
                type="danger"
                :icon="Delete"
                :loading="deletingKey === row.key"
                @click="deleteFile(row)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <ul v-loading="loading" class="file-list__cards">
          <li v-for="row in paginatedRecords" :key="row.id" class="file-list__card">
            <div class="file-list__card-head">
              <FileTypeIcon :category="row.category" :size="22" />
              <span class="file-list__card-name">{{ row.name }}</span>
              <el-tag size="small" type="info">{{ getCategoryLabel(row.category) }}</el-tag>
            </div>
            <div class="file-list__card-meta">
              <span>{{ formatBytes(row.size) }}</span>
              <span>{{ formatTime(row.uploadedAt) }}</span>
            </div>
            <div class="file-list__card-actions">
              <el-button type="primary" plain size="large" @click="previewFile(row)"
                >预览</el-button
              >
              <el-button type="primary" plain size="large" @click="downloadFile(row)"
                >下载</el-button
              >
              <el-button type="primary" plain size="large" @click="copyUrl(row)">复制</el-button>
              <el-button
                type="danger"
                plain
                size="large"
                :loading="deletingKey === row.key"
                @click="deleteFile(row)"
              >
                删除
              </el-button>
            </div>
          </li>
        </ul>

        <el-pagination
          v-if="filteredTotal > 0"
          v-model:current-page="page"
          v-model:page-size="pageSize"
          class="file-list__pagination"
          :page-sizes="FILE_PAGE_SIZE_OPTIONS"
          :total="filteredTotal"
          :layout="paginationLayout"
          background
        />
      </template>

      <p class="file-list__hint">
        已从 OSS 加载全部历史文件；列表分页在本地完成（默认每页 50 条）。删除会真实移除 OSS 对象（需
        DeleteObject 权限）。
      </p>
    </template>
  </el-card>
</template>

<style scoped>
.file-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.file-list__title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-list__title {
  font-weight: 600;
}

.file-list__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-list__refresh-btn {
  min-height: 36px;
  touch-action: manipulation;
}

.file-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
  align-items: center;
}

.file-list__search {
  flex: 1 1 220px;
  min-width: 180px;
}

.file-list__filter,
.file-list__sort {
  width: 160px;
}

.file-list__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 24px 16px;
}

.file-list__loading-box {
  width: 100%;
  min-height: 120px;
}

.file-list__loading-text {
  margin: 12px 0 0;
  font-size: 14px;
  color: #606266;
}

.file-list__loading-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
}

.file-list__empty-hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}

.file-list__range {
  margin: 0 0 10px;
  font-size: 13px;
  color: #606266;
}

.file-list__name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.file-list__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-list__cards {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
}

.file-list__card {
  padding: 14px 0;
  border-bottom: 1px solid #ebeef5;
}

.file-list__card:last-child {
  border-bottom: none;
}

.file-list__card-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.file-list__card-name {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
  word-break: break-all;
}

.file-list__card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  margin-left: 30px;
  font-size: 12px;
  color: #909399;
}

.file-list__card-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.file-list__card-actions :deep(.el-button) {
  margin: 0;
  min-height: 44px;
  font-size: 14px;
  touch-action: manipulation;
}

.file-list__pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.file-list__hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .file-list__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .file-list__refresh-btn {
    min-height: 44px;
  }

  .file-list__filter,
  .file-list__sort {
    width: calc(50% - 5px);
    flex: 1 1 calc(50% - 5px);
  }

  .file-list__search {
    flex: 1 1 100%;
  }

  .file-list__table {
    display: none;
  }

  .file-list__cards {
    display: block;
  }

  .file-list__pagination {
    justify-content: center;
  }

  .file-list__pagination :deep(.el-pagination) {
    flex-wrap: wrap;
    row-gap: 8px;
  }
}
</style>
