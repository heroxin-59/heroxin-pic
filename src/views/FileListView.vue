<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  CopyDocument,
  Delete,
  Download,
  Folder,
  Refresh,
  Search,
  View,
} from '@element-plus/icons-vue'
import FileTypeIcon from '@/components/file-list/FileTypeIcon.vue'
import FileContextMenu from '@/components/file-list/FileContextMenu.vue'
import ImageAlbumView from '@/components/file-list/ImageAlbumView.vue'
import FilePreviewDialog from '@/components/preview/FilePreviewDialog.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import {
  FILE_CATEGORY_FILTERS,
  FILE_PAGE_SIZE_OPTIONS,
  FILE_SORT_OPTIONS,
  useFileListQuery,
} from '@/composables/useFileListQuery'
import { getCategoryLabel, getCategoryTagType } from '@/constants/fileTypes'
import { getAccessUrl, downloadOssFile } from '@/services/fileList'
import { useFileStore, type FolderBreadcrumb } from '@/stores/files'
import type { FileRecord, FolderEntry } from '@/types/file'
import type { AlbumImageMeta } from '@/services/imageMeta'
import { formatBytes } from '@/utils/format'
import { groupRecordsByUploadDay } from '@/utils/albumGroup'
import { showAppError, showAppSuccess, showAppWarning } from '@/utils/message'

const router = useRouter()
const { isMobile } = useBreakpoint()
const fileStore = useFileStore()
const {
  records,
  folders,
  showAllFiles,
  breadcrumbs,
  total,
  folderCount,
  totalBytes,
  hasListContent,
  loading,
  loaded,
  errorMessage,
  deletingKey,
} = storeToRefs(fileStore)

const {
  keyword,
  category,
  imagesOnly,
  sortValue,
  page,
  pageSize,
  filteredTotal,
  filteredBytes,
  filteredRecords,
  paginatedRecords,
  pageRangeStart,
  pageRangeEnd,
  setImagesOnly,
  resetQuery,
} = useFileListQuery(() => records.value)

const hasActiveQuery = computed(
  () =>
    keyword.value.trim().length > 0 ||
    category.value !== 'all' ||
    imagesOnly.value ||
    sortValue.value !== 'time-desc',
)

const filteredFolders = computed(() => {
  if (imagesOnly.value) return []
  const query = keyword.value.trim().toLowerCase()
  if (!query) return folders.value
  return folders.value.filter(
    (item) => item.name.toLowerCase().includes(query) || item.prefix.toLowerCase().includes(query),
  )
})

const showEmptyFilter = computed(() => {
  if (!loaded.value || errorMessage.value) return false
  if (!hasListContent.value) return false
  return filteredTotal.value === 0 && filteredFolders.value.length === 0
})

const paginationLayout = computed(() =>
  isMobile.value ? 'total, sizes, prev, pager, next' : 'total, sizes, prev, pager, next, jumper',
)

const canGoParent = computed(() => !showAllFiles.value && breadcrumbs.value.length > 1)

const previewVisible = ref(false)
const previewRecord = ref<FileRecord | null>(null)
const albumMetaMap = shallowRef(new Map<string, AlbumImageMeta>())
const contextMenuRef = ref<InstanceType<typeof FileContextMenu> | null>(null)

/** 相册预览切换顺序：与按日分组展示一致（优先 OSS 归档目录日） */
const albumPreviewGallery = computed(() => {
  if (!imagesOnly.value) return undefined
  return groupRecordsByUploadDay(filteredRecords.value, albumMetaMap.value).flatMap(
    (group) => group.records,
  )
})

function onAlbumMetaMapChange(metaMap: Map<string, AlbumImageMeta>) {
  albumMetaMap.value = metaMap
}

function openFileContextMenu(row: FileRecord, event: MouseEvent) {
  contextMenuRef.value?.open(event, row)
}

function onTableRowContextMenu(row: FileRecord, _column: unknown, event: Event) {
  openFileContextMenu(row, event as MouseEvent)
}

function onAlbumContextMenu(payload: { record: FileRecord; event: MouseEvent }) {
  openFileContextMenu(payload.record, payload.event)
}

watch(imagesOnly, (enabled) => {
  if (!enabled) {
    albumMetaMap.value = new Map()
  }
})

const imageCountInScope = computed(
  () => records.value.filter((item) => item.category === 'image').length,
)

/** 列表统计文案 */
const statsLabel = computed(() => {
  if (!loaded.value || errorMessage.value) return ''
  if (imagesOnly.value) {
    if (filteredTotal.value !== imageCountInScope.value) {
      return `图片 ${filteredTotal.value}/${imageCountInScope.value} · ${formatBytes(filteredBytes.value)}`
    }
    return `图片 ${filteredTotal.value} 张 · ${formatBytes(filteredBytes.value)}`
  }
  if (showAllFiles.value) {
    if (filteredTotal.value !== total.value) {
      return `匹配 ${filteredTotal.value}/${total.value} · ${formatBytes(filteredBytes.value)}`
    }
    return `${total.value} 个 · ${formatBytes(totalBytes.value)}`
  }
  return `${filteredFolders.value.length}/${folderCount.value} 文件夹 · ${filteredTotal.value}/${total.value} 文件`
})

function onImagesOnlyChange(value: string | number | boolean) {
  setImagesOnly(Boolean(value))
}

function formatTime(value: string) {
  return new Date(value).toLocaleString()
}

function goUpload() {
  router.push({ name: 'home' })
}

async function refresh() {
  try {
    await fileStore.loadFromOss()
    if (!fileStore.hasListContent) {
      showAppWarning(showAllFiles.value ? '当前前缀下暂无文件' : '当前目录为空')
    } else if (showAllFiles.value) {
      showAppSuccess(`已加载 ${fileStore.total} 个文件`)
    } else {
      showAppSuccess(`本目录 ${fileStore.folderCount} 个文件夹 · ${fileStore.total} 个文件`)
    }
  } catch (error) {
    showAppError(error)
  }
}

async function onShowAllFilesChange(value: string | number | boolean) {
  try {
    resetQuery()
    await fileStore.setShowAllFiles(Boolean(value))
    if (!fileStore.hasListContent) {
      showAppWarning(value ? '当前前缀下暂无文件' : '当前目录为空')
    }
  } catch (error) {
    showAppError(error)
  }
}

async function openFolder(folder: FolderEntry) {
  try {
    resetQuery()
    await fileStore.enterFolder(folder.prefix)
  } catch (error) {
    showAppError(error)
  }
}

async function onBreadcrumbClick(crumb: FolderBreadcrumb) {
  try {
    resetQuery()
    await fileStore.navigateToPrefix(crumb.prefix)
  } catch (error) {
    showAppError(error)
  }
}

async function goParent() {
  try {
    resetQuery()
    await fileStore.goParentFolder()
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

const albumBatchBusy = ref(false)

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
      // 浏览器常拦截连点下载，稍作间隔
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
  try {
    await ElMessageBox.confirm(
      `确定从 OSS 删除选中的 ${items.length} 张图片吗？此操作不可恢复。`,
      '批量删除确认',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
      },
    )
  } catch {
    return
  }

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
          <div class="file-list__mode">
            <span class="file-list__mode-label">显示全部文件</span>
            <el-switch
              :model-value="showAllFiles"
              inline-prompt
              active-text="是"
              inactive-text="否"
              :disabled="loading"
              @change="onShowAllFilesChange"
            />
          </div>
          <div class="file-list__mode">
            <span class="file-list__mode-label">仅图片</span>
            <el-switch
              :model-value="imagesOnly"
              inline-prompt
              active-text="是"
              inactive-text="否"
              :disabled="loading"
              @change="onImagesOnlyChange"
            />
          </div>
          <el-button
            size="small"
            text
            type="primary"
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

    <el-empty v-else-if="loaded && !hasListContent" class="file-list__empty">
      <template #description>
        <p>{{ showAllFiles ? '当前 OSS 前缀下暂无文件' : '当前目录为空' }}</p>
        <p class="file-list__empty-hint">上传成功后会出现在此列表</p>
      </template>
      <el-button type="primary" @click="goUpload">去上传</el-button>
    </el-empty>

    <template v-else-if="hasListContent">
      <div v-if="!showAllFiles" class="file-list__breadcrumb">
        <el-button
          text
          type="primary"
          :icon="ArrowLeft"
          :disabled="!canGoParent || loading"
          class="file-list__back"
          @click="goParent"
        >
          返回上一级
        </el-button>
        <nav class="file-list__crumbs" aria-label="目录路径">
          <template v-for="(crumb, index) in breadcrumbs" :key="crumb.prefix">
            <span v-if="index > 0" class="file-list__crumb-sep">/</span>
            <button
              type="button"
              class="file-list__crumb"
              :class="{ 'is-current': index === breadcrumbs.length - 1 }"
              :disabled="loading || index === breadcrumbs.length - 1"
              @click="onBreadcrumbClick(crumb)"
            >
              {{ crumb.label }}
            </button>
          </template>
        </nav>
      </div>

      <div class="file-list__toolbar">
        <el-input
          v-model="keyword"
          class="file-list__search"
          clearable
          :placeholder="showAllFiles ? '搜索文件名 / Key / 扩展名' : '搜索本目录名称 / Key'"
          :prefix-icon="Search"
        />
        <el-select
          v-model="category"
          class="file-list__filter"
          placeholder="类型"
          :disabled="imagesOnly"
        >
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
          <p class="file-list__empty-hint">
            {{
              imagesOnly
                ? '当前范围没有图片，可关闭「仅图片」或换目录'
                : '试试调整搜索关键词或类型筛选'
            }}
          </p>
        </template>
        <el-button type="primary" plain @click="resetQuery">清除筛选</el-button>
      </el-empty>

      <template v-else>
        <p v-if="filteredTotal > 0 || filteredFolders.length > 0" class="file-list__range">
          <template v-if="imagesOnly">
            <span class="file-list__range-prefix">仅图片</span>
            <el-tag size="small" type="success">{{ statsLabel }}</el-tag>
          </template>
          <template v-else-if="showAllFiles">
            <span class="file-list__range-prefix">全部</span>
            <el-tag size="small" type="success">{{ statsLabel }}</el-tag>
            <span v-if="filteredTotal > 0" class="file-list__range-extra">
              · 第 {{ pageRangeStart }}–{{ pageRangeEnd }} 条
            </span>
          </template>
          <template v-else>
            <span class="file-list__range-prefix">本目录</span>
            <el-tag size="small" type="success">{{ statsLabel }}</el-tag>
          </template>
        </p>

        <ImageAlbumView
          v-if="imagesOnly"
          :records="filteredRecords"
          :loading="loading"
          :batch-busy="albumBatchBusy"
          @select="previewFile"
          @meta-map-change="onAlbumMetaMapChange"
          @batch-download="onAlbumBatchDownload"
          @batch-delete="onAlbumBatchDelete"
          @context-menu="onAlbumContextMenu"
        />

        <template v-else>
          <el-table
            v-if="!showAllFiles && filteredFolders.length > 0"
            v-loading="loading"
            :data="filteredFolders"
            stripe
            class="file-list__table file-list__folder-table"
          >
            <el-table-column label="名称" min-width="200">
              <template #default="{ row }">
                <button type="button" class="file-list__folder-btn" @click="openFolder(row)">
                  <el-icon class="file-list__folder-icon" :size="18"><Folder /></el-icon>
                  <span class="file-list__folder-name">{{ row.name }}</span>
                </button>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="100">
              <template #default>
                <el-tag size="small" type="warning">文件夹</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="大小" width="100">
              <template #default>—</template>
            </el-table-column>
            <el-table-column label="上传时间" width="170">
              <template #default>—</template>
            </el-table-column>
            <el-table-column label="操作" width="340" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="openFolder(row)"
                  >打开</el-button
                >
              </template>
            </el-table-column>
          </el-table>

          <el-table
            v-if="paginatedRecords.length > 0"
            v-loading="loading"
            :data="paginatedRecords"
            stripe
            class="file-list__table"
            :show-header="showAllFiles || filteredFolders.length === 0"
            @row-contextmenu="onTableRowContextMenu"
          >
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
                <el-tag size="small" :type="getCategoryTagType(row.category)">{{
                  getCategoryLabel(row.category)
                }}</el-tag>
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
            <el-table-column label="操作" width="340" fixed="right">
              <template #default="{ row }">
                <div class="file-list__actions">
                  <el-button
                    size="small"
                    text
                    type="primary"
                    :icon="View"
                    @click="previewFile(row)"
                  >
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
                </div>
              </template>
            </el-table-column>
          </el-table>

          <ul v-loading="loading" class="file-list__cards">
            <li
              v-for="folder in filteredFolders"
              :key="folder.prefix"
              class="file-list__card file-list__card--folder"
            >
              <button type="button" class="file-list__folder-card-btn" @click="openFolder(folder)">
                <el-icon class="file-list__folder-icon" :size="22"><Folder /></el-icon>
                <span class="file-list__card-name">{{ folder.name }}</span>
                <el-tag size="small" type="warning">文件夹</el-tag>
              </button>
            </li>
            <li
              v-for="row in paginatedRecords"
              :key="row.id"
              class="file-list__card"
              @contextmenu="openFileContextMenu(row, $event)"
            >
              <div class="file-list__card-head">
                <FileTypeIcon :category="row.category" :size="22" />
                <span class="file-list__card-name">{{ row.name }}</span>
                <el-tag size="small" :type="getCategoryTagType(row.category)">{{
                  getCategoryLabel(row.category)
                }}</el-tag>
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
          <template v-if="imagesOnly">
            仅图片相册：优先按拍摄日期分组；有 GPS 时显示地点（缩略图进入视口后解析 EXIF）。
          </template>
          <template v-else-if="showAllFiles">
            已从 OSS 加载全部历史文件；列表分页在本地完成（默认每页 10 条）。
          </template>
          <template v-else>
            层级目录模式（与控制台类似）：仅显示当前目录下的文件夹与文件；点击文件夹进入下一级。
          </template>
          删除会真实移除 OSS 对象（需 DeleteObject 权限）。
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
  flex-wrap: wrap;
  justify-content: flex-end;
}

.file-list__mode {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-list__mode-label {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.file-list__refresh-btn {
  min-height: 32px;
  padding: 4px 8px;
  touch-action: manipulation;
}

.file-list__breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 12px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.file-list__back {
  padding: 0 4px;
  min-height: 32px;
}

.file-list__crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.file-list__crumb {
  border: none;
  background: transparent;
  padding: 2px 4px;
  color: #409eff;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.file-list__crumb:disabled {
  color: #303133;
  text-decoration: none;
  cursor: default;
  font-weight: 600;
}

.file-list__crumb-sep {
  color: #c0c4cc;
  font-size: 12px;
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 13px;
  color: #606266;
}

.file-list__range-prefix {
  flex-shrink: 0;
}

.file-list__range-extra {
  color: #909399;
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

.file-list__actions {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0;
  white-space: nowrap;
}

.file-list__actions :deep(.el-button) {
  margin: 0;
  padding: 4px 6px;
  flex-shrink: 0;
}

.file-list__folder-table {
  margin-bottom: 8px;
}

.file-list__folder-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
}

.file-list__folder-icon {
  flex-shrink: 0;
  color: #e6a23c;
}

.file-list__folder-name {
  color: #409eff;
  text-decoration: underline;
  text-underline-offset: 2px;
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

.file-list__folder-card-btn {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  cursor: pointer;
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

.file-list__card--folder .file-list__card-name {
  color: #409eff;
  text-decoration: underline;
  text-underline-offset: 2px;
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

  .file-list__meta {
    width: 100%;
    justify-content: flex-start;
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
