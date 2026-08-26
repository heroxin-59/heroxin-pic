<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Check, Download, Location, Delete } from '@element-plus/icons-vue'
import ImageAlbumThumb from '@/components/file-list/ImageAlbumThumb.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useWindowVirtualRows } from '@/composables/useWindowVirtualRows'
import type { AlbumImageMeta } from '@/services/imageMeta'
import type { FileRecord } from '@/types/file'
import { groupRecordsByUploadDay } from '@/utils/albumGroup'
import { buildAlbumWaterfallLayout, findAlbumDateOffset } from '@/utils/albumVirtual'

const props = defineProps<{
  records: FileRecord[]
  loading?: boolean
  /** 批量操作进行中（禁用按钮） */
  batchBusy?: boolean
}>()

const emit = defineEmits<{
  select: [record: FileRecord]
  'meta-map-change': [metaMap: Map<string, AlbumImageMeta>]
  'batch-download': [records: FileRecord[]]
  'batch-delete': [records: FileRecord[]]
  'context-menu': [payload: { record: FileRecord; event: MouseEvent }]
}>()

const rootRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const metaByKey = shallowRef(new Map<string, AlbumImageMeta>())
/** 触发布局重算的宽高比版本（实际比例在 imageAspect 缓存） */
const aspectRev = ref(0)
const selectionMode = ref(false)
const selectedKeys = shallowRef(new Set<string>())
const jumpDateKey = ref('')
const { width: viewportWidth, isMobile } = useBreakpoint()

const groups = computed(() => groupRecordsByUploadDay(props.records, metaByKey.value))

const layout = computed(() => {
  void aspectRev.value
  return buildAlbumWaterfallLayout(groups.value, containerWidth.value, viewportWidth.value)
})

const items = computed(() => layout.value.items)
const totalHeight = computed(() => layout.value.totalHeight)

const dateOptions = computed(() =>
  groups.value.map((group) => ({
    value: group.dateKey,
    label: `${group.label}（${group.records.length}）`,
  })),
)

const selectedCount = computed(() => selectedKeys.value.size)

const selectedRecords = computed(() =>
  props.records.filter((item) => selectedKeys.value.has(item.key)),
)

const allSelected = computed(
  () => props.records.length > 0 && selectedKeys.value.size === props.records.length,
)

const { visibleRows: visibleItems, scheduleUpdate } = useWindowVirtualRows({
  rootRef,
  rows: items,
  overscan: 6,
  overscanPx: 900,
})

let resizeObserver: ResizeObserver | null = null
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let suppressClick = false
let aspectRaf = 0

function onThumbMeta(meta: AlbumImageMeta) {
  const next = new Map(metaByKey.value)
  next.set(meta.key, meta)
  metaByKey.value = next
  emit('meta-map-change', next)
}

function onThumbAspect() {
  if (aspectRaf) return
  aspectRaf = window.requestAnimationFrame(() => {
    aspectRaf = 0
    aspectRev.value += 1
  })
}

function syncWidth() {
  const el = rootRef.value
  if (!el) return
  const next = Math.round(el.clientWidth)
  if (next !== containerWidth.value) {
    containerWidth.value = next
  }
  scheduleUpdate()
}

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function enterSelectionMode() {
  selectionMode.value = true
}

function exitSelectionMode() {
  selectionMode.value = false
  selectedKeys.value = new Set()
  clearLongPress()
}

function toggleKey(key: string) {
  const next = new Set(selectedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedKeys.value = next
}

function isSelected(key: string) {
  return selectedKeys.value.has(key)
}

function selectAll() {
  selectedKeys.value = new Set(props.records.map((item) => item.key))
}

function clearSelection() {
  selectedKeys.value = new Set()
}

function selectDay(dateKey: string) {
  const group = groups.value.find((item) => item.dateKey === dateKey)
  if (!group) return
  const next = new Set(selectedKeys.value)
  for (const item of group.records) next.add(item.key)
  selectedKeys.value = next
  enterSelectionMode()
}

function onTileClick(item: FileRecord) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (selectionMode.value) {
    toggleKey(item.key)
    return
  }
  emit('select', item)
}

function onTileContextMenu(item: FileRecord, event: MouseEvent) {
  // 右键菜单优先，取消长按多选计时
  onTilePointerCancel()
  emit('context-menu', { record: item, event })
}

function onTilePointerDown(item: FileRecord) {
  clearLongPress()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    suppressClick = true
    enterSelectionMode()
    if (!selectedKeys.value.has(item.key)) {
      toggleKey(item.key)
    }
  }, 480)
}

function onTilePointerUp() {
  clearLongPress()
}

function onTilePointerCancel() {
  clearLongPress()
}

function jumpToDate(dateKey: string) {
  if (!dateKey || !rootRef.value) return
  const offset = findAlbumDateOffset(items.value, dateKey)
  if (offset == null) return
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  const listTop = rootRef.value.getBoundingClientRect().top + scrollTop
  const target = Math.max(0, listTop + offset - 12)
  window.scrollTo({ top: target, behavior: 'smooth' })
  jumpDateKey.value = dateKey
}

function onJumpChange(value: string | number | undefined) {
  if (typeof value === 'string' && value) jumpToDate(value)
}

function onBatchDownload() {
  if (selectedRecords.value.length === 0) return
  emit('batch-download', selectedRecords.value)
}

function onBatchDelete() {
  if (selectedRecords.value.length === 0) return
  emit('batch-delete', selectedRecords.value)
}

watch(
  () => props.records.map((item) => item.key).join('|'),
  () => {
    const alive = new Set(props.records.map((item) => item.key))
    const nextMeta = new Map<string, AlbumImageMeta>()
    for (const [key, meta] of metaByKey.value) {
      if (alive.has(key)) nextMeta.set(key, meta)
    }
    metaByKey.value = nextMeta
    emit('meta-map-change', nextMeta)

    if (selectedKeys.value.size > 0) {
      const nextSelected = new Set<string>()
      for (const key of selectedKeys.value) {
        if (alive.has(key)) nextSelected.add(key)
      }
      selectedKeys.value = nextSelected
    }
  },
)

watch([items, totalHeight], () => {
  scheduleUpdate()
})

watch(selectionMode, (enabled) => {
  if (!enabled) selectedKeys.value = new Set()
})

onMounted(() => {
  syncWidth()
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver(() => syncWidth())
    resizeObserver.observe(rootRef.value)
  }
})

onUnmounted(() => {
  clearLongPress()
  if (aspectRaf) window.cancelAnimationFrame(aspectRaf)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<template>
  <div class="image-album-wrap">
    <div class="image-album__toolbar">
      <el-select
        :model-value="jumpDateKey || undefined"
        class="image-album__jump"
        placeholder="定位到某日"
        filterable
        clearable
        :disabled="dateOptions.length === 0 || batchBusy"
        @change="onJumpChange"
        @clear="jumpDateKey = ''"
      >
        <el-option
          v-for="opt in dateOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <div class="image-album__toolbar-actions">
        <el-button
          v-if="!selectionMode"
          class="image-album__mode-btn"
          :size="isMobile ? 'default' : 'small'"
          :disabled="records.length === 0 || batchBusy"
          @click="enterSelectionMode"
        >
          多选
        </el-button>
        <el-button
          v-else
          class="image-album__mode-btn"
          :size="isMobile ? 'default' : 'small'"
          :disabled="batchBusy"
          @click="exitSelectionMode"
        >
          取消多选
        </el-button>
      </div>
    </div>

    <p v-if="isMobile && !selectionMode" class="image-album__hint">长按图片可进入多选</p>

    <div
      ref="rootRef"
      v-loading="loading"
      class="image-album"
      :class="{ 'is-selecting': selectionMode }"
      :style="{ height: `${Math.max(totalHeight, 160)}px` }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.key"
        class="image-album__item"
        :class="`image-album__item--${item.type}`"
        :style="{
          top: `${item.offset}px`,
          left: `${item.left}px`,
          width: item.type === 'header' ? '100%' : `${item.width}px`,
          height: `${item.height}px`,
        }"
      >
        <header v-if="item.type === 'header'" class="image-album__header">
          <div class="image-album__heading">
            <h3 class="image-album__date">{{ item.label }}</h3>
            <p v-if="item.locationLabel" class="image-album__location">
              <span>{{ item.locationLabel }}</span>
              <el-icon class="image-album__location-icon" :size="14"><Location /></el-icon>
            </p>
          </div>
          <div class="image-album__header-aside">
            <span class="image-album__count">{{ item.count }} 张</span>
            <el-button
              v-if="selectionMode"
              size="small"
              text
              type="primary"
              :disabled="batchBusy"
              @click="selectDay(item.dateKey)"
            >
              选当日
            </el-button>
          </div>
        </header>

        <button
          v-else
          type="button"
          class="image-album__tile"
          :class="{ 'is-selected': isSelected(item.record.key) }"
          :title="item.record.name"
          :aria-pressed="selectionMode ? isSelected(item.record.key) : undefined"
          @click="onTileClick(item.record)"
          @contextmenu="onTileContextMenu(item.record, $event)"
          @pointerdown="onTilePointerDown(item.record)"
          @pointerup="onTilePointerUp"
          @pointercancel="onTilePointerCancel"
          @pointerleave="onTilePointerUp"
        >
          <ImageAlbumThumb
            :record="item.record"
            @meta="onThumbMeta"
            @aspect="onThumbAspect"
          />
          <span class="image-album__caption">{{ item.record.name }}</span>
          <span v-if="selectionMode" class="image-album__check" aria-hidden="true">
            <el-icon v-if="isSelected(item.record.key)" :size="14"><Check /></el-icon>
          </span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="selectionMode"
        class="album-action-bar"
        :class="{ 'is-compact': isMobile }"
        role="toolbar"
        aria-label="相册批量操作"
      >
        <span class="album-action-bar__count">已选 {{ selectedCount }} 张</span>
        <div class="album-action-bar__actions">
          <el-button
            size="small"
            text
            :disabled="batchBusy"
            @click="allSelected ? clearSelection() : selectAll()"
          >
            {{ allSelected ? '取消全选' : '全选' }}
          </el-button>
          <el-button
            size="small"
            type="primary"
            :icon="Download"
            :disabled="selectedCount === 0 || batchBusy"
            :loading="batchBusy"
            @click="onBatchDownload"
          >
            下载
          </el-button>
          <el-button
            size="small"
            type="danger"
            :icon="Delete"
            :disabled="selectedCount === 0 || batchBusy"
            :loading="batchBusy"
            @click="onBatchDelete"
          >
            删除
          </el-button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.image-album-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.image-album__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.image-album__jump {
  width: min(260px, 100%);
}

.image-album__toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.image-album__hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

@media (max-width: 767px) {
  .image-album__toolbar {
    flex-wrap: nowrap;
    align-items: stretch;
  }

  .image-album__jump {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  /* 与全局触摸按钮 --touch-min 对齐，避免选框偏矮、多选偏高 */
  .image-album__jump :deep(.el-select__wrapper) {
    min-height: var(--touch-min, 44px);
  }

  .image-album__toolbar-actions {
    margin-left: 0;
    flex-shrink: 0;
  }

  .image-album__mode-btn {
    height: var(--touch-min, 44px);
    min-height: var(--touch-min, 44px);
    padding: 0 14px;
  }
}

.image-album {
  position: relative;
  min-height: 160px;
}

.image-album__item {
  position: absolute;
  box-sizing: border-box;
}

.image-album__item--header {
  left: 0 !important;
  right: 0;
  width: 100% !important;
}

.image-album__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  height: 100%;
}

.image-album__heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-album__date {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  line-height: 1.3;
}

.image-album__location {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #909399;
  line-height: 1.3;
}

.image-album__location-icon {
  flex-shrink: 0;
  color: #c0c4cc;
}

.image-album__header-aside {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 2px;
}

.image-album__count {
  font-size: 13px;
  color: #909399;
}

.image-album__tile {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border: none;
  border-radius: 4px;
  overflow: hidden;
  background: #ebeef5;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
}

.image-album__tile:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}

.image-album__tile.is-selected {
  outline: 2px solid #409eff;
  outline-offset: -2px;
}

.image-album__tile.is-selected::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(64, 158, 255, 0.18);
  pointer-events: none;
}

.image-album__caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16px 6px 5px;
  font-size: 10px;
  line-height: 1.2;
  color: #fff;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
  pointer-events: none;
}

.image-album__check {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1.5px solid #c0c4cc;
  color: #fff;
  pointer-events: none;
}

.image-album__tile.is-selected .image-album__check {
  background: #409eff;
  border-color: #409eff;
}

@media (min-width: 768px) {
  .image-album__date {
    font-size: 20px;
  }
}
</style>

<style>
.album-action-bar {
  position: fixed;
  left: 50%;
  bottom: calc(16px + var(--safe-bottom, 0px));
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100vw - 24px);
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e4e7ed;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
}

.album-action-bar.is-compact {
  bottom: calc(var(--tabbar-height, 56px) + 12px + var(--safe-bottom, 0px));
  width: calc(100vw - 24px);
  justify-content: space-between;
}

.album-action-bar__count {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}

.album-action-bar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
