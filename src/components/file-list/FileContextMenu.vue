<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CopyDocument, Delete, Download, View } from '@element-plus/icons-vue'
import type { FileRecord } from '@/types/file'

const props = defineProps<{
  /** 正在删除的文件 key（用于禁用 / loading） */
  deletingKey?: string | null
}>()

const emit = defineEmits<{
  preview: [record: FileRecord]
  download: [record: FileRecord]
  copy: [record: FileRecord]
  delete: [record: FileRecord]
}>()

const visible = ref(false)
const left = ref(0)
const top = ref(0)
const current = ref<FileRecord | null>(null)
const menuRef = ref<HTMLElement | null>(null)

const MENU_PAD = 8

function clampPosition(x: number, y: number) {
  const el = menuRef.value
  const width = el?.offsetWidth ?? 160
  const height = el?.offsetHeight ?? 160
  const maxX = window.innerWidth - width - MENU_PAD
  const maxY = window.innerHeight - height - MENU_PAD
  left.value = Math.max(MENU_PAD, Math.min(x, maxX))
  top.value = Math.max(MENU_PAD, Math.min(y, maxY))
}

async function open(event: MouseEvent, record: FileRecord) {
  event.preventDefault()
  event.stopPropagation()
  current.value = record
  visible.value = true
  left.value = event.clientX
  top.value = event.clientY
  await nextTick()
  clampPosition(event.clientX, event.clientY)
}

function close() {
  visible.value = false
  current.value = null
}

function onAction(action: 'preview' | 'download' | 'copy' | 'delete') {
  const record = current.value
  if (!record) return
  close()
  emit(action, record)
}

function onDocPointerDown(event: Event) {
  if (!visible.value) return
  const target = event.target as Node | null
  if (menuRef.value?.contains(target)) return
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

function onScrollOrResize() {
  if (visible.value) close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onScrollOrResize)
  window.addEventListener('scroll', onScrollOrResize, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onScrollOrResize)
  window.removeEventListener('scroll', onScrollOrResize, true)
})

defineExpose({ open, close })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && current"
      ref="menuRef"
      class="file-context-menu"
      role="menu"
      :style="{ left: `${left}px`, top: `${top}px` }"
      @contextmenu.prevent
    >
      <button type="button" class="file-context-menu__item" role="menuitem" @click="onAction('preview')">
        <el-icon :size="16"><View /></el-icon>
        <span>预览</span>
      </button>
      <button type="button" class="file-context-menu__item" role="menuitem" @click="onAction('download')">
        <el-icon :size="16"><Download /></el-icon>
        <span>下载</span>
      </button>
      <button type="button" class="file-context-menu__item" role="menuitem" @click="onAction('copy')">
        <el-icon :size="16"><CopyDocument /></el-icon>
        <span>复制链接</span>
      </button>
      <div class="file-context-menu__divider" role="separator" />
      <button
        type="button"
        class="file-context-menu__item is-danger"
        role="menuitem"
        :disabled="deletingKey === current.key"
        @click="onAction('delete')"
      >
        <el-icon :size="16"><Delete /></el-icon>
        <span>{{ deletingKey === current.key ? '删除中…' : '删除' }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.file-context-menu {
  position: fixed;
  z-index: 4000;
  min-width: 148px;
  padding: 6px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.file-context-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #303133;
  font-size: 13px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
}

.file-context-menu__item:hover:not(:disabled) {
  background: #f5f7fa;
}

.file-context-menu__item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.file-context-menu__item.is-danger {
  color: #f56c6c;
}

.file-context-menu__item.is-danger:hover:not(:disabled) {
  background: #fef0f0;
}

.file-context-menu__divider {
  height: 1px;
  margin: 4px 6px;
  background: #ebeef5;
}
</style>
