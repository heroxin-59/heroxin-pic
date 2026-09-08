<script setup lang="ts">
import { Document, DocumentCopy, Files, Picture, Tickets, VideoCamera } from '@element-plus/icons-vue'
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
  video: VideoCamera,
  other: Files,
}

const colorMap: Record<FileCategory, string> = {
  image: '#3db86b',
  pdf: '#f56c6c',
  word: '#2f7dff',
  text: '#e6a23c',
  video: '#626aef',
  other: '#7a8fa3',
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
