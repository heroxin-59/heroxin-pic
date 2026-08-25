<script setup lang="ts">
import { Document, DocumentCopy, Files, Picture, Tickets } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import type { FileCategory } from '@/constants/fileTypes'

const props = defineProps<{
  category: FileCategory
  size?: number
}>()

const iconMap: Record<FileCategory, Component> = {
  image: Picture,
  pdf: Document,
  word: DocumentCopy,
  text: Tickets,
  other: Files,
}

const colorMap: Record<FileCategory, string> = {
  image: '#67c23a',
  pdf: '#f56c6c',
  word: '#409eff',
  text: '#e6a23c',
  other: '#909399',
}
</script>

<template>
  <el-icon class="file-type-icon" :size="props.size ?? 18" :style="{ color: colorMap[category] }">
    <component :is="iconMap[category]" />
  </el-icon>
</template>

<style scoped>
.file-type-icon {
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
