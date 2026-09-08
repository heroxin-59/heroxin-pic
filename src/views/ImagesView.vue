<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Refresh } from '@element-plus/icons-vue'
import FileContextMenu from '@/components/file-list/FileContextMenu.vue'
import BackToTop from '@/components/common/BackToTop.vue'
import ImageAlbumView from '@/components/file-list/ImageAlbumView.vue'
import FilePreviewDialog from '@/components/preview/FilePreviewDialog.vue'
import { useImageAlbumQuery } from '@/composables/useImageAlbumQuery'
import { getAccessUrl, downloadOssFile } from '@/services/fileList'
import { useFileStore } from '@/stores/files'
import type { FileRecord } from '@/types/file'
import type { AlbumImageMeta } from '@/services/imageMeta'
import { formatBytes } from '@/utils/format'
import { groupRecordsByDate, type AlbumGroupGranularity } from '@/utils/albumGroup'
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

const { albumRecords, filteredRecords, filteredTotal, filteredBytes, mediaFilter } =
  useImageAlbumQuery(() => records.value)

const previewVisible = ref(false)
const previewRecord = ref<FileRecord | null>(null)
const albumMetaMap = shallowRef(new Map<string, AlbumImageMeta>())
const contextMenuRef = ref<InstanceType<typeof FileContextMenu> | null>(null)
const albumBatchBusy = ref(false)
const albumGranularity = ref<AlbumGroupGranularity>('day')

const albumPreviewGallery = computed(() =>
  groupRecordsByDate(filteredRecords.value, albumMetaMap.value, albumGranularity.value).flatMap(
    (group) => group.records,
  ),
)

const statsLabel = computed(() => {
  if (!loaded.value || errorMessage.value) return ''
  return `${filteredTotal.value} 个 · ${formatBytes(filteredBytes.value)}`
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
  router.push({ name: 'upload' })
}

async function refresh() {
  try {
    await fileStore.loadAllFilesForGallery({ force: true })
    const count = albumRecords.value.length
    if (count === 0) {
      showAppWarning('当前 OSS 前缀下暂无相册内容')
    } else {
      showAppSuccess(`已加载 ${count} 个`)
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
    `确定从 OSS 删除选中的 ${items.length} 个文件吗？此操作不可恢复。`,
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
    if (ok > 0) showAppSuccess(`已删除 ${ok} 个`)
    if (ok < items.length) showAppWarning(`${items.length - ok} 个删除失败`)
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
  <div class="images-view">
    <header class="images-view__masthead">
      <div class="images-view__masthead-copy">
        <h1 class="images-view__title">相册</h1>
        <p class="images-view__lede">按拍摄日浏览，照片本身是主角</p>
      </div>
      <div class="images-view__masthead-actions">
        <span v-if="statsLabel" class="images-view__stats">{{ statsLabel }}</span>
        <el-button
          circle
          text
          type="primary"
          :icon="Refresh"
          :loading="loading"
          aria-label="刷新相册"
          class="images-view__refresh-btn"
          @click="refresh"
        />
      </div>
    </header>

    <div class="images-view__stage">
      <div v-if="loading && !loaded" class="images-view__state">
        <div v-loading="true" class="images-view__loading-box" />
        <p class="images-view__loading-text">正在从 OSS 加载相册…</p>
      </div>

      <el-result v-else-if="errorMessage" icon="error" title="加载失败" :sub-title="errorMessage">
        <template #extra>
          <el-button type="primary" :loading="loading" @click="refresh">重试</el-button>
        </template>
      </el-result>

      <el-empty v-else-if="loaded && albumRecords.length === 0" class="images-view__empty">
        <template #description>
          <p>还没有照片或视频</p>
          <p class="images-view__empty-hint">上传后会按拍摄日出现在这里</p>
        </template>
        <el-button type="primary" @click="goUpload">去上传</el-button>
      </el-empty>

      <ImageAlbumView
        v-else
        v-model:granularity="albumGranularity"
        v-model:media-filter="mediaFilter"
        :records="filteredRecords"
        :loading="loading"
        :batch-busy="albumBatchBusy"
        @select="previewFile"
        @meta-map-change="onAlbumMetaMapChange"
        @batch-download="onAlbumBatchDownload"
        @batch-delete="onAlbumBatchDelete"
        @context-menu="onAlbumContextMenu"
      />
    </div>
  </div>

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

  <BackToTop v-if="loaded && albumRecords.length > 0" />
</template>

<style scoped>
.images-view {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 100%;
}

.images-view__masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 4px 2px 18px;
}

.images-view__masthead-copy {
  min-width: 0;
}

.images-view__title {
  margin: 0;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--app-text);
}

.images-view__lede {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: var(--app-text-secondary);
}

.images-view__masthead-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-bottom: 2px;
}

.images-view__stats {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
  background: color-mix(in srgb, var(--brand-chip) 50%, white);
  border: 1px solid color-mix(in srgb, var(--brand-chip) 65%, white);
  white-space: nowrap;
}

.images-view__refresh-btn {
  --el-button-size: 36px;
}

.images-view__stage {
  flex: 1;
  min-width: 0;
  padding: 14px 12px 20px;
  border-radius: var(--app-radius);
  background: color-mix(in srgb, var(--app-surface) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-border) 80%, transparent);
  box-shadow: var(--app-shadow);
  backdrop-filter: blur(6px);
}

.images-view__state {
  padding: 48px 0;
  text-align: center;
}

.images-view__loading-box {
  min-height: 140px;
}

.images-view__loading-text {
  margin: 12px 0 0;
  color: var(--app-text-secondary);
}

.images-view__empty {
  padding: 32px 0 40px;
}

.images-view__empty-hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--app-text-muted);
}

@media (max-width: 767px) {
  .images-view__masthead {
    align-items: flex-start;
    padding: 0 0 14px;
  }

  .images-view__lede {
    font-size: 13px;
  }

  .images-view__stage {
    margin: 0 -4px;
    padding: 12px 8px 16px;
    border-radius: 14px;
  }
}
</style>
