<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Refresh, Search } from '@element-plus/icons-vue'
import FileContextMenu from '@/components/file-list/FileContextMenu.vue'
import ImageAlbumView from '@/components/file-list/ImageAlbumView.vue'
import FilePreviewDialog from '@/components/preview/FilePreviewDialog.vue'
import { FILE_SORT_OPTIONS } from '@/composables/useFileListQuery'
import { useImageAlbumQuery } from '@/composables/useImageAlbumQuery'
import { getAccessUrl, downloadOssFile } from '@/services/fileList'
import { useFileStore } from '@/stores/files'
import type { FileRecord } from '@/types/file'
import type { AlbumImageMeta } from '@/services/imageMeta'
import { formatBytes } from '@/utils/format'
import { groupRecordsByUploadDay } from '@/utils/albumGroup'
import { confirmApp, confirmAppDelete, showAppError, showAppSuccess, showAppWarning } from '@/utils/message'

const router = useRouter()
const fileStore = useFileStore()
const {
  records,
  loading,
  loaded,
  errorMessage,
  deletingKey,
} = storeToRefs(fileStore)

const { keyword, sortValue, imageRecords, filteredRecords, filteredTotal, filteredBytes, resetQuery } =
  useImageAlbumQuery(() => records.value)

const hasActiveQuery = computed(
  () => keyword.value.trim().length > 0 || sortValue.value !== 'time-desc',
)

const previewVisible = ref(false)
const previewRecord = ref<FileRecord | null>(null)
const albumMetaMap = shallowRef(new Map<string, AlbumImageMeta>())
const contextMenuRef = ref<InstanceType<typeof FileContextMenu> | null>(null)
const albumBatchBusy = ref(false)

const albumPreviewGallery = computed(() =>
  groupRecordsByUploadDay(filteredRecords.value, albumMetaMap.value).flatMap(
    (group) => group.records,
  ),
)

const statsLabel = computed(() => {
  if (!loaded.value || errorMessage.value) return ''
  if (filteredTotal.value !== imageRecords.value.length) {
    return `图片 ${filteredTotal.value}/${imageRecords.value.length} · ${formatBytes(filteredBytes.value)}`
  }
  return `图片 ${filteredTotal.value} 张 · ${formatBytes(filteredBytes.value)}`
})

function onAlbumMetaMapChange(metaMap: Map<string, AlbumImageMeta>) {
  albumMetaMap.value = metaMap
}

function openFileContextMenu(row: FileRecord, event: MouseEvent) {
  contextMenuRef.value?.open(event, row)
}

function onAlbumContextMenu(payload: { record: FileRecord; event: MouseEvent }) {
  openFileContextMenu(payload.record, payload.event)
}

function goUpload() {
  router.push({ name: 'home' })
}

async function refresh() {
  try {
    await fileStore.loadAllFilesForGallery()
    const count = imageRecords.value.length
    if (count === 0) {
      showAppWarning('当前 OSS 前缀下暂无图片')
    } else {
      showAppSuccess(`已加载 ${count} 张图片`)
    }
  } catch (error) {
    showAppError(error)
  }
}

async function copyUrl(row: FileRecord) {
  try {
    const url = await getAccessUrl(row.key)
    await navigator.clipboard.writeText(url)
    showAppSuccess('已复制链接')
  } catch (error) {
    showAppError(error)
  }
}

async function downloadFile(row: FileRecord): Promise<boolean> {
  try {
    await downloadOssFile(row.key, row.name)
    return true
  } catch (error) {
    showAppError(error)
    return false
  }
}

function previewFile(row: FileRecord) {
  previewRecord.value = row
  previewVisible.value = true
}

async function deleteFile(row: FileRecord) {
  const confirmed = await confirmAppDelete(row.name)
  if (!confirmed) return

  try {
    await fileStore.deleteRecord(row)
    showAppSuccess('已删除')
  } catch (error) {
    showAppError(error)
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function onAlbumBatchDownload(items: FileRecord[]) {
  if (items.length === 0 || albumBatchBusy.value) return
  albumBatchBusy.value = true
  let ok = 0
  try {
    for (const row of items) {
      const success = await downloadFile(row)
      if (success) ok += 1
      await delay(350)
    }
    if (ok > 0) showAppSuccess(`已触发 ${ok} 个下载`)
    if (ok < items.length) showAppWarning(`${items.length - ok} 个下载失败`)
  } finally {
    albumBatchBusy.value = false
  }
}

async function onAlbumBatchDelete(items: FileRecord[]) {
  if (items.length === 0 || albumBatchBusy.value) return
  const confirmed = await confirmApp(
    `确定从 OSS 删除选中的 ${items.length} 张图片吗？此操作不可恢复。`,
    {
      title: '批量删除确认',
      confirmButtonText: '删除',
      danger: true,
    },
  )
  if (!confirmed) return

  albumBatchBusy.value = true
  let ok = 0
  try {
    for (const row of items) {
      try {
        await fileStore.deleteRecord(row)
        ok += 1
      } catch (error) {
        showAppError(error)
      }
    }
    if (ok > 0) showAppSuccess(`已删除 ${ok} 张`)
    if (ok < items.length) showAppWarning(`${items.length - ok} 张删除失败`)
  } finally {
    albumBatchBusy.value = false
  }
}

onMounted(() => {
  void fileStore.loadAllFilesForGallery().catch((error) => {
    showAppError(error)
  })
})
</script>

<template>
  <el-card shadow="never" class="images-view">
    <template #header>
      <div class="images-view__header">
        <div class="images-view__title-wrap">
          <span class="images-view__title">图片</span>
          <el-tag size="small" type="success">OSS</el-tag>
        </div>
        <div class="images-view__meta">
          <el-button
            size="small"
            text
            type="primary"
            :icon="Refresh"
            :loading="loading"
            class="images-view__refresh-btn"
            @click="refresh"
          >
            刷新
          </el-button>
        </div>
      </div>
    </template>

    <div v-if="loading && !loaded" class="images-view__state">
      <div v-loading="true" class="images-view__loading-box" />
      <p class="images-view__loading-text">正在从 OSS 加载图片…</p>
    </div>

    <el-result v-else-if="errorMessage" icon="error" title="加载失败" :sub-title="errorMessage">
      <template #extra>
        <el-button type="primary" :loading="loading" @click="refresh">重试</el-button>
      </template>
    </el-result>

    <el-empty v-else-if="loaded && imageRecords.length === 0" class="images-view__empty">
      <template #description>
        <p>当前 OSS 前缀下暂无图片</p>
        <p class="images-view__empty-hint">上传图片后会出现在此相册</p>
      </template>
      <el-button type="primary" @click="goUpload">去上传</el-button>
    </el-empty>

    <template v-else>
      <div class="images-view__toolbar">
        <el-input
          v-model="keyword"
          class="images-view__search"
          clearable
          placeholder="搜索图片名称 / Key"
          :prefix-icon="Search"
        />
        <el-select v-model="sortValue" class="images-view__sort" placeholder="排序">
          <el-option
            v-for="item in FILE_SORT_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button v-if="hasActiveQuery" text type="primary" @click="resetQuery">重置</el-button>
      </div>

      <el-empty v-if="filteredTotal === 0" class="images-view__empty">
        <template #description>
          <p>没有符合条件的图片</p>
          <p class="images-view__empty-hint">试试调整搜索关键词</p>
        </template>
        <el-button type="primary" plain @click="resetQuery">清除筛选</el-button>
      </el-empty>

      <template v-else>
        <p class="images-view__range">
          <el-tag size="small" type="success">{{ statsLabel }}</el-tag>
        </p>

        <ImageAlbumView
          :records="filteredRecords"
          :loading="loading"
          :batch-busy="albumBatchBusy"
          @select="previewFile"
          @meta-map-change="onAlbumMetaMapChange"
          @batch-download="onAlbumBatchDownload"
          @batch-delete="onAlbumBatchDelete"
          @context-menu="onAlbumContextMenu"
        />

        <p class="images-view__hint">
          按拍摄日期分组展示；有 GPS 时显示地点（缩略图进入视口后解析 EXIF）。删除会真实移除 OSS
          对象（需 DeleteObject 权限）。
        </p>
      </template>
    </template>
  </el-card>

  <FilePreviewDialog
    v-model="previewVisible"
    v-model:record="previewRecord"
    :gallery="albumPreviewGallery"
  />

  <FileContextMenu
    ref="contextMenuRef"
    :deleting-key="deletingKey"
    @preview="previewFile"
    @download="downloadFile"
    @copy="copyUrl"
    @delete="deleteFile"
  />
</template>

<style scoped>
.images-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.images-view__title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.images-view__title {
  font-weight: 600;
}

.images-view__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.images-view__state {
  padding: 24px 0;
  text-align: center;
}

.images-view__loading-box {
  min-height: 120px;
}

.images-view__loading-text {
  margin: 12px 0 0;
  color: #606266;
}

.images-view__empty-hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}

.images-view__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.images-view__search {
  flex: 1 1 200px;
  min-width: 160px;
}

.images-view__sort {
  width: 180px;
}

.images-view__range {
  margin: 0 0 12px;
}

.images-view__hint {
  margin: 16px 0 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .images-view__header {
    flex-wrap: nowrap;
    gap: 8px;
  }

  .images-view__title-wrap {
    flex-shrink: 0;
  }

  .images-view__meta {
    margin-left: auto;
    flex-shrink: 0;
    justify-content: flex-end;
  }

  .images-view__sort {
    width: 100%;
  }
}
</style>
