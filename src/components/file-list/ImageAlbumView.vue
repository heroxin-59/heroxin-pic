<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ArrowDown, Check, Download, Location, Delete } from '@element-plus/icons-vue'
import ImageAlbumThumb from '@/components/file-list/ImageAlbumThumb.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useWindowVirtualRows } from '@/composables/useWindowVirtualRows'
import type { AlbumImageMeta } from '@/services/imageMeta'
import { subscribeAlbumMetaUpdate } from '@/services/imageMeta'
import type { FileRecord } from '@/types/file'
import {
  getAlbumJumpPlaceholder,
  getAlbumSelectGroupLabel,
  groupRecordsByDate,
  type AlbumGroupGranularity,
} from '@/utils/albumGroup'
import type { AlbumMediaFilter } from '@/composables/useImageAlbumQuery'
import { buildAlbumTimelineSpineLayout, findAlbumDateOffset, type AlbumVirtualSpineItem } from '@/utils/albumVirtual'

const props = defineProps<{
  records: FileRecord[]
  loading?: boolean
  /** 批量操作进行中（禁用按钮） */
  batchBusy?: boolean
  /** 分组粒度：日 / 月 / 年 */
  granularity?: AlbumGroupGranularity
  /** 媒体类型：全部 / 图片 / 视频 */
  mediaFilter?: AlbumMediaFilter
}>()

const emit = defineEmits<{
  select: [record: FileRecord]
  'meta-map-change': [metaMap: Map<string, AlbumImageMeta>]
  'batch-download': [records: FileRecord[]]
  'batch-delete': [records: FileRecord[]]
  'context-menu': [payload: { record: FileRecord; event: MouseEvent }]
  'update:granularity': [value: AlbumGroupGranularity]
  'update:mediaFilter': [value: AlbumMediaFilter]
}>()

const granularityOptions: { value: AlbumGroupGranularity; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

const mediaFilterOptions: { value: AlbumMediaFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
]

const activeGranularity = computed({
  get: () => props.granularity ?? 'day',
  set: (value: AlbumGroupGranularity) => emit('update:granularity', value),
})

const activeMediaFilter = computed({
  get: () => props.mediaFilter ?? 'all',
  set: (value: AlbumMediaFilter) => emit('update:mediaFilter', value),
})

const rootRef = ref<HTMLElement | null>(null)
const wrapRef = ref<HTMLElement | null>(null)
const toolbarRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const metaByKey = shallowRef(new Map<string, AlbumImageMeta>())
/** 触发布局重算的宽高比版本（实际比例在 imageAspect 缓存） */
const aspectRev = ref(0)
const selectionMode = ref(false)
const selectedKeys = shallowRef(new Set<string>())
const jumpDateKey = ref('')
const collapsedDateKeys = shallowRef(new Set<string>())
const { width: viewportWidth, isMobile } = useBreakpoint()

/** 筛选条吸顶偏移；脊标签吸顶在其下方 */
const toolbarStickyTop = ref(0)
const spineStickyTop = ref(56)
/** 当前视口对应的时间脊节点（固定条展示，不依赖 CSS sticky 进虚拟项） */
const activeSpine = shallowRef<AlbumVirtualSpineItem | null>(null)

const groups = computed(() =>
  groupRecordsByDate(props.records, metaByKey.value, activeGranularity.value),
)

const jumpPlaceholder = computed(() => getAlbumJumpPlaceholder(activeGranularity.value))
const selectGroupLabel = computed(() => getAlbumSelectGroupLabel(activeGranularity.value))

const layout = computed(() => {
  void aspectRev.value
  return buildAlbumTimelineSpineLayout(
    groups.value,
    containerWidth.value,
    viewportWidth.value,
    undefined,
    collapsedDateKeys.value,
  )
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
let stickyObserver: ResizeObserver | null = null
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let unsubscribeMetaUpdate: (() => void) | null = null
let suppressClick = false
let suppressContextMenuUntil = 0
let aspectRaf = 0
let stickyRaf = 0
let activeSpineRaf = 0

function onStickyMetricsChange() {
  if (stickyRaf) return
  stickyRaf = window.requestAnimationFrame(() => {
    stickyRaf = 0
    measureStickyOffsets()
    updateActiveSpine()
  })
}

function spinesInLayout(): AlbumVirtualSpineItem[] {
  return items.value.filter((item): item is AlbumVirtualSpineItem => item.type === 'spine')
}

function updateActiveSpine() {
  const spines = spinesInLayout()
  if (!rootRef.value || spines.length === 0) {
    if (activeSpine.value) activeSpine.value = null
    return
  }

  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  const listTop = rootRef.value.getBoundingClientRect().top + scrollTop
  // 探测线落在吸顶条稍下，避免边界闪烁
  const probe = scrollTop - listTop + spineStickyTop.value + 20

  let current = spines[0]!
  for (const spine of spines) {
    if (spine.offset <= probe) current = spine
    else break
  }

  if (activeSpine.value?.dateKey !== current.dateKey) {
    activeSpine.value = current
  } else if (
    activeSpine.value.label !== current.label ||
    activeSpine.value.locationLabel !== current.locationLabel ||
    activeSpine.value.count !== current.count
  ) {
    activeSpine.value = current
  }
}

function onScrollOrResizeForSpine() {
  if (activeSpineRaf) return
  activeSpineRaf = window.requestAnimationFrame(() => {
    activeSpineRaf = 0
    updateActiveSpine()
  })
}

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

function measureStickyOffsets() {
  const header = document.querySelector('.app-header') as HTMLElement | null
  const headerVisible =
    !!header && getComputedStyle(header).display !== 'none' && header.getBoundingClientRect().height > 0
  const headerH = headerVisible ? Math.round(header.getBoundingClientRect().height) : 0
  const toolbarH = Math.round(toolbarRef.value?.getBoundingClientRect().height ?? 48)
  toolbarStickyTop.value = headerH
  spineStickyTop.value = headerH + toolbarH + 6
  wrapRef.value?.style.setProperty('--album-toolbar-sticky-top', `${toolbarStickyTop.value}px`)
  wrapRef.value?.style.setProperty('--album-spine-sticky-top', `${spineStickyTop.value}px`)
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

function isGroupFullySelected(dateKey: string) {
  const group = groups.value.find((item) => item.dateKey === dateKey)
  if (!group || group.records.length === 0) return false
  return group.records.every((item) => selectedKeys.value.has(item.key))
}

function toggleGroupSelection(dateKey: string) {
  const group = groups.value.find((item) => item.dateKey === dateKey)
  if (!group) return
  enterSelectionMode()
  const next = new Set(selectedKeys.value)
  if (isGroupFullySelected(dateKey)) {
    for (const item of group.records) next.delete(item.key)
  } else {
    for (const item of group.records) next.add(item.key)
  }
  selectedKeys.value = next
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
  onTilePointerCancel()

  // 移动端长按会合成 contextmenu；多选已触发时不再弹出右键菜单
  if (isMobile.value || Date.now() < suppressContextMenuUntil) {
    event.preventDefault()
    return
  }

  emit('context-menu', { record: item, event })
}

function onTilePointerDown(item: FileRecord) {
  clearLongPress()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    suppressClick = true
    suppressContextMenuUntil = Date.now() + 800
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

function isDateCollapsed(dateKey: string) {
  return collapsedDateKeys.value.has(dateKey)
}

function toggleDateCollapse(dateKey: string) {
  const next = new Set(collapsedDateKeys.value)
  if (next.has(dateKey)) next.delete(dateKey)
  else next.add(dateKey)
  collapsedDateKeys.value = next
  scheduleUpdate()
}

function expandDate(dateKey: string) {
  if (!collapsedDateKeys.value.has(dateKey)) return
  const next = new Set(collapsedDateKeys.value)
  next.delete(dateKey)
  collapsedDateKeys.value = next
}

async function jumpToDate(dateKey: string) {
  if (!dateKey || !rootRef.value) return
  if (isDateCollapsed(dateKey)) {
    expandDate(dateKey)
    await nextTick()
    scheduleUpdate()
    await nextTick()
  }
  const offset = findAlbumDateOffset(items.value, dateKey)
  if (offset == null) return
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  const listTop = rootRef.value.getBoundingClientRect().top + scrollTop
  const stickyPad = spineStickyTop.value + 8
  const target = Math.max(0, listTop + offset - stickyPad)
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

/** 时间脊日记层级：从 dateKey 拆年/月/日（日 YYYY-MM-DD；月 YYYY-MM；年 YYYY） */
function spineParts(dateKey: string): { year: string; month?: string; day?: string; fallback: string } {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (dayMatch) {
    return {
      year: dayMatch[1]!,
      month: String(Number(dayMatch[2])),
      day: String(Number(dayMatch[3])),
      fallback: dateKey,
    }
  }
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(dateKey)
  if (monthMatch) {
    return {
      year: monthMatch[1]!,
      month: String(Number(monthMatch[2])),
      fallback: dateKey,
    }
  }
  if (/^\d{4}$/.test(dateKey)) {
    return { year: dateKey, fallback: dateKey }
  }
  return { year: '', fallback: dateKey }
}

watch(activeGranularity, () => {
  jumpDateKey.value = ''
})

watch(activeMediaFilter, () => {
  jumpDateKey.value = ''
})

watch(
  groups,
  (next) => {
    const alive = new Set(next.map((group) => group.dateKey))
    const pruned = new Set([...collapsedDateKeys.value].filter((key) => alive.has(key)))
    if (pruned.size !== collapsedDateKeys.value.size) {
      collapsedDateKeys.value = pruned
    }
  },
  { deep: true },
)

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

watch(isMobile, () => {
  onStickyMetricsChange()
})

watch([items, totalHeight], () => {
  scheduleUpdate()
  onScrollOrResizeForSpine()
})

watch(selectionMode, (enabled) => {
  if (!enabled) selectedKeys.value = new Set()
})

onMounted(() => {
  syncWidth()
  measureStickyOffsets()
  updateActiveSpine()
  unsubscribeMetaUpdate = subscribeAlbumMetaUpdate(onThumbMeta)
  if (typeof ResizeObserver !== 'undefined') {
    if (rootRef.value) {
      resizeObserver = new ResizeObserver(() => syncWidth())
      resizeObserver.observe(rootRef.value)
    }
    stickyObserver = new ResizeObserver(() => onStickyMetricsChange())
    if (toolbarRef.value) stickyObserver.observe(toolbarRef.value)
    const header = document.querySelector('.app-header')
    if (header) stickyObserver.observe(header)
  }
  window.addEventListener('resize', onStickyMetricsChange, { passive: true })
  window.addEventListener('scroll', onScrollOrResizeForSpine, { passive: true })
  // 审阅/开发：允许向当前页注入地点元数据（不影响生产包体积外行为）
  if (import.meta.env.DEV) {
    ;(window as unknown as { __seedAlbumMeta?: (rows: AlbumImageMeta[]) => void }).__seedAlbumMeta = (
      rows,
    ) => {
      for (const row of rows) onThumbMeta(row)
    }
  }
})

onUnmounted(() => {
  unsubscribeMetaUpdate?.()
  unsubscribeMetaUpdate = null
  if (import.meta.env.DEV) {
    delete (window as unknown as { __seedAlbumMeta?: unknown }).__seedAlbumMeta
  }
  clearLongPress()
  if (aspectRaf) window.cancelAnimationFrame(aspectRaf)
  if (stickyRaf) window.cancelAnimationFrame(stickyRaf)
  if (activeSpineRaf) window.cancelAnimationFrame(activeSpineRaf)
  window.removeEventListener('resize', onStickyMetricsChange)
  window.removeEventListener('scroll', onScrollOrResizeForSpine)
  resizeObserver?.disconnect()
  resizeObserver = null
  stickyObserver?.disconnect()
  stickyObserver = null
})
</script>

<template>
  <div ref="wrapRef" class="image-album-wrap">
    <div ref="toolbarRef" class="image-album__toolbar">
      <div class="image-album__filters">
        <el-segmented
          v-model="activeGranularity"
          class="image-album__granularity"
          :options="granularityOptions"
          :disabled="batchBusy"
        />

        <el-segmented
          v-model="activeMediaFilter"
          class="image-album__media-filter"
          :options="mediaFilterOptions"
          :disabled="batchBusy"
        />
      </div>

      <el-select
        :model-value="jumpDateKey || undefined"
        class="image-album__jump"
        :placeholder="jumpPlaceholder"
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
    </div>

    <div
      v-if="activeSpine"
      class="image-album__spine-pin"
      :class="{ 'is-collapsed': isDateCollapsed(activeSpine.dateKey) }"
    >
      <button
        type="button"
        class="image-album__spine-pin-btn"
        :aria-expanded="!isDateCollapsed(activeSpine.dateKey)"
        :aria-label="activeSpine.label"
        @click="toggleDateCollapse(activeSpine.dateKey)"
      >
        <span class="image-album__spine-track" aria-hidden="true">
          <span class="image-album__spine-node" />
        </span>
        <span
          v-for="parts in [spineParts(activeSpine.dateKey)]"
          :key="`${activeSpine.dateKey}-pin`"
          class="image-album__spine-copy"
        >
          <template v-if="parts.day">
            <span class="image-album__spine-head">
              <span class="image-album__spine-day">{{ parts.day }}</span>
              <span class="image-album__spine-meta">
                <span class="image-album__spine-month">{{ parts.month }}月</span>
                <span class="image-album__spine-year">{{ parts.year }}</span>
              </span>
            </span>
          </template>
          <template v-else-if="parts.month">
            <span class="image-album__spine-head">
              <span class="image-album__spine-day">{{ parts.month }}</span>
              <span class="image-album__spine-meta">
                <span class="image-album__spine-month">月</span>
                <span class="image-album__spine-year">{{ parts.year }}</span>
              </span>
            </span>
          </template>
          <template v-else-if="parts.year">
            <span class="image-album__spine-head is-year-only">
              <span class="image-album__spine-day image-album__spine-day--year">{{ parts.year }}</span>
            </span>
          </template>
          <span v-else class="image-album__spine-date">{{ activeSpine.label }}</span>
          <span
            v-if="activeSpine.locationLabel"
            class="image-album__spine-place"
            :title="activeSpine.locationLabel"
          >
            <el-icon class="image-album__spine-place-icon" :size="11"><Location /></el-icon>
            <span class="image-album__spine-place-text">{{ activeSpine.locationLabel }}</span>
          </span>
          <span class="image-album__spine-count">{{ activeSpine.count }} 张</span>
        </span>
      </button>
      <el-button
        v-if="selectionMode"
        class="image-album__spine-select"
        size="small"
        text
        type="primary"
        :disabled="batchBusy"
        @click.stop="toggleGroupSelection(activeSpine.dateKey)"
      >
        {{ isGroupFullySelected(activeSpine.dateKey) ? '取消' : selectGroupLabel }}
      </el-button>
    </div>

    <div
      ref="rootRef"
      v-loading="loading"
      class="image-album image-album--timeline"
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
          width:
            item.type === 'header' ? '100%' : `${item.width}px`,
          height: `${item.height}px`,
        }"
      >
        <aside
          v-if="item.type === 'spine'"
          class="image-album__spine image-album__spine--marker"
          :class="{
            'is-collapsed': isDateCollapsed(item.dateKey),
            'is-active': activeSpine?.dateKey === item.dateKey,
          }"
          :aria-hidden="activeSpine?.dateKey === item.dateKey"
        >
          <span class="image-album__spine-track" aria-hidden="true">
            <span class="image-album__spine-node" />
          </span>
        </aside>

        <header
          v-else-if="item.type === 'header'"
          class="image-album__header"
          :class="{ 'is-collapsed': isDateCollapsed(item.dateKey) }"
        >
          <button
            type="button"
            class="image-album__heading-btn"
            :aria-expanded="!isDateCollapsed(item.dateKey)"
            @click="toggleDateCollapse(item.dateKey)"
          >
            <el-icon class="image-album__collapse-icon" :size="16"><ArrowDown /></el-icon>
            <div class="image-album__heading">
              <h3 class="image-album__date">{{ item.label }}</h3>
              <p v-if="item.locationLabel" class="image-album__location">
                <span>{{ item.locationLabel }}</span>
                <el-icon class="image-album__location-icon" :size="14"><Location /></el-icon>
              </p>
            </div>
          </button>
          <div class="image-album__header-aside">
            <span class="image-album__count image-album__day-chip">{{ item.count }} 个</span>
            <el-button
              v-if="selectionMode"
              size="small"
              text
              type="primary"
              :disabled="batchBusy"
              @click.stop="toggleGroupSelection(item.dateKey)"
            >
              {{ isGroupFullySelected(item.dateKey) ? '取消' : selectGroupLabel }}
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
        <span class="album-action-bar__count">已选 {{ selectedCount }} 个</span>
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
          <el-button size="small" :disabled="batchBusy" @click="exitSelectionMode">
            取消
          </el-button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.image-album-wrap {
  --album-spine-width: 68px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.image-album__toolbar {
  position: sticky;
  top: var(--album-toolbar-sticky-top, 0px);
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin: 0 -2px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--app-surface) 92%, var(--app-bg));
  border: 1px solid color-mix(in srgb, var(--app-border) 85%, transparent);
  box-shadow: var(--app-shadow);
  backdrop-filter: blur(12px);
}

.image-album__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: min(320px, 100%);
}

.image-album__granularity,
.image-album__media-filter {
  flex: 1;
  min-width: min(156px, 100%);
}

.image-album__granularity :deep(.el-segmented),
.image-album__media-filter :deep(.el-segmented) {
  --el-border-radius-base: 8px;
  width: 100%;
}

.image-album__jump {
  width: min(220px, 100%);
  flex: 0 1 220px;
  min-width: 0;
}

@media (min-width: 768px) {
  .image-album-wrap {
    --album-spine-width: 88px;
  }
}

@media (max-width: 767px) {
  .image-album-wrap {
    gap: 8px;
  }

  /* 窄屏两行：筛选一行、跳转一行，避免 select 压住 segmented */
  .image-album__toolbar {
    flex-wrap: wrap;
    align-items: stretch;
    gap: 6px;
    padding: 6px;
    overflow: visible;
  }

  .image-album__filters {
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
    flex-wrap: nowrap;
    gap: 6px;
  }

  .image-album__granularity,
  .image-album__media-filter {
    flex: 1 1 0;
    min-width: 0;
    width: auto;
  }

  .image-album__granularity :deep(.el-segmented),
  .image-album__media-filter :deep(.el-segmented) {
    width: 100%;
  }

  .image-album__granularity :deep(.el-segmented__item),
  .image-album__media-filter :deep(.el-segmented__item) {
    padding: 0 6px;
    font-size: 12px;
  }

  .image-album__jump {
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
  }

  .image-album__jump :deep(.el-select__wrapper) {
    min-height: 32px;
    font-size: 12px;
  }
}

.image-album {
  position: relative;
  min-height: 160px;
}

.image-album--timeline {
  --album-spine-width: 68px;
  --album-spine-rail-x: 11px;
}

@media (min-width: 768px) {
  .image-album--timeline {
    --album-spine-width: 88px;
    --album-spine-rail-x: 14px;
  }
}

.image-album--timeline::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: var(--album-spine-rail-x);
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--brand-spine) 12%, transparent),
    color-mix(in srgb, var(--brand-spine) 42%, transparent) 12%,
    color-mix(in srgb, var(--brand-chip) 55%, transparent) 50%,
    color-mix(in srgb, var(--brand-spine) 42%, transparent) 88%,
    color-mix(in srgb, var(--brand-spine) 12%, transparent)
  );
  pointer-events: none;
  z-index: 0;
}

.image-album__item {
  position: absolute;
  box-sizing: border-box;
  z-index: 1;
}

.image-album__item--spine {
  z-index: 2;
  pointer-events: none;
}

/* 固定当前时间节点：只占脊栏宽，绝不盖住右侧照片井 */
.image-album__spine-pin {
  position: sticky;
  top: var(--album-spine-sticky-top, 56px);
  z-index: 5;
  display: flex;
  align-items: flex-start;
  gap: 2px;
  box-sizing: border-box;
  width: var(--album-spine-width, 68px);
  max-width: var(--album-spine-width, 68px);
  margin: 0;
  padding: 2px 2px 8px 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: hidden;
  pointer-events: none;
}

.image-album__spine-pin-btn {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: start;
  gap: 2px;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  min-width: 0;
  width: 100%;
  pointer-events: auto;
}

.image-album__spine-pin-btn:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  border-radius: 6px;
}

.image-album__spine--marker {
  display: flex;
  justify-content: flex-start;
  height: 100%;
  padding: 6px 0 0;
}

.image-album__spine--marker .image-album__spine-track {
  min-height: 16px;
  padding-top: 2px;
}

.image-album__spine--marker.is-active .image-album__spine-node {
  opacity: 0.3;
}

.image-album__spine-track {
  position: relative;
  display: flex;
  justify-content: center;
  width: 18px;
  padding-top: 6px;
}

.image-album__spine-node {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--app-surface);
  border: 2.5px solid var(--brand-spine);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--brand-spine-soft) 80%, transparent),
    0 1px 3px color-mix(in srgb, var(--brand-spine) 18%, transparent);
}

.image-album__spine-pin.is-collapsed .image-album__spine-node,
.image-album__spine--marker.is-collapsed .image-album__spine-node {
  border-color: color-mix(in srgb, var(--brand-spine) 45%, var(--app-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-spine-soft) 50%, transparent);
}

.image-album__spine-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.image-album__spine-head {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  min-width: 0;
}

.image-album__spine-head.is-year-only {
  align-items: baseline;
}

.image-album__spine-day {
  flex-shrink: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 1;
  color: var(--brand-spine);
  font-variant-numeric: tabular-nums;
}

.image-album__spine-day--year {
  font-size: 22px;
  letter-spacing: -0.03em;
}

.image-album__spine-meta {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1px;
  min-width: 0;
  padding-bottom: 0;
  overflow: visible;
}

.image-album__spine-month {
  font-size: 11px;
  font-weight: 600;
  color: var(--app-text);
  line-height: 1.2;
  white-space: nowrap;
}

.image-album__spine-year {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--app-text-muted);
  line-height: 1.2;
  white-space: nowrap;
}

.image-album__spine-date {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.02em;
  color: var(--app-text);
}

.image-album__spine-place {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  margin: 0;
  font-size: 10px;
  line-height: 1.25;
  color: var(--app-text-muted);
}

.image-album__spine-place-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: color-mix(in srgb, var(--brand-spine) 70%, var(--brand-chip));
}

.image-album__spine-place-text {
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  word-break: break-all;
}

.image-album__spine-count {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--app-text-muted);
  background: none;
  white-space: nowrap;
}

.image-album__spine-select {
  flex-shrink: 0;
  margin: 2px 0 0;
  padding: 0 4px !important;
  height: auto !important;
  min-height: 0 !important;
  pointer-events: auto;
}

@media (min-width: 768px) {
  .image-album__spine-pin {
    width: var(--album-spine-width, 88px);
    max-width: var(--album-spine-width, 88px);
  }

  .image-album__spine-day {
    font-size: 26px;
  }

  .image-album__spine-day--year {
    font-size: 24px;
  }

  .image-album__spine-month {
    font-size: 12px;
  }

  .image-album__spine-year {
    font-size: 11px;
  }

  .image-album__spine-place {
    font-size: 11px;
  }

  .image-album__spine-count {
    font-size: 11px;
  }
}

@media (max-width: 767px) {
  /* 日号与月/年上下排，挤进脊栏内，不外溢盖图 */
  .image-album__spine-head:not(.is-year-only) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
  }

  .image-album__spine-meta {
    flex-direction: row;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 3px;
  }

  .image-album__spine-day {
    font-size: 20px;
  }

  .image-album__spine-month,
  .image-album__spine-year {
    font-size: 10px;
  }

  .image-album__spine-count {
    font-size: 10px;
  }

  .image-album__spine-place {
    font-size: 9px;
  }
}

.image-album--timeline .image-album__tile {
  border-radius: 12px;
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
  gap: 12px;
  height: 100%;
  padding: 4px 2px 0;
}

.image-album__heading-btn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
}

.image-album__heading-btn:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.image-album__collapse-icon {
  flex-shrink: 0;
  margin-top: 8px;
  color: var(--app-text-muted);
  transition: transform 0.2s ease;
}

.image-album__header.is-collapsed .image-album__collapse-icon {
  transform: rotate(-90deg);
}

.image-album__heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-album__date {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--app-text);
  line-height: 1.2;
}

.image-album__day-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
  background: color-mix(in srgb, var(--brand-chip) 55%, white);
  border: 1px solid color-mix(in srgb, var(--brand-chip) 70%, white);
}

.image-album__location {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--app-text-muted);
  line-height: 1.3;
}

.image-album__location-icon {
  flex-shrink: 0;
  color: var(--brand-chip);
}

.image-album__header-aside {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 6px;
}

.image-album__count {
  font-size: 12px;
  color: var(--app-text);
}

.image-album__tile {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 10px;
  overflow: hidden;
  background: var(--app-surface-muted);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  box-shadow: var(--app-shadow);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

@media (hover: hover) and (pointer: fine) {
  .image-album__tile:hover {
    transform: translateY(-2px);
    box-shadow: var(--app-shadow-lift);
  }
}

.image-album__tile:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 1px;
}

.image-album__tile.is-selected {
  outline: 2px solid var(--brand-primary);
  outline-offset: -2px;
}

.image-album__tile.is-selected::after {
  content: '';
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--brand-primary) 18%, transparent);
  pointer-events: none;
}

.image-album__caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18px 8px 6px;
  font-size: 10px;
  line-height: 1.2;
  color: #fff;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(transparent, rgba(15, 40, 70, 0.55));
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
  border: 1.5px solid var(--app-border-strong);
  color: #fff;
  pointer-events: none;
}

.image-album__tile.is-selected .image-album__check {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

@media (min-width: 768px) {
  .image-album__date {
    font-size: 26px;
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
  border: 1px solid var(--app-border);
  box-shadow: var(--app-shadow-lift);
  backdrop-filter: blur(8px);
}

.album-action-bar.is-compact {
  bottom: calc(var(--tabbar-height, 56px) + 12px + var(--safe-bottom, 0px));
  width: calc(100vw - 24px);
  gap: 6px;
  padding: 8px 10px;
  justify-content: space-between;
}

.album-action-bar.is-compact .album-action-bar__count {
  font-size: 12px;
  flex-shrink: 0;
}

.album-action-bar.is-compact .album-action-bar__actions {
  flex-wrap: nowrap;
  gap: 8px;
  flex-shrink: 1;
  min-width: 0;
  justify-content: flex-end;
}

.album-action-bar.is-compact .album-action-bar__actions .el-button {
  padding: 4px 10px;
  height: 28px;
  min-height: 28px;
  font-size: 12px;
  margin: 0;
}

.album-action-bar.is-compact .album-action-bar__actions .el-button.is-text {
  padding: 4px 6px;
}

.album-action-bar.is-compact .album-action-bar__actions .el-button .el-icon {
  font-size: 12px;
}

.album-action-bar.is-compact .album-action-bar__actions .el-button .el-icon + span {
  margin-left: 2px;
}

.album-action-bar__count {
  font-size: 13px;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.album-action-bar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
