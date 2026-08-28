<script setup lang="ts">
import { computed } from 'vue'
import type { FileCategory } from '@/constants/fileTypes'
import { getCategoryLabel, getCategoryTagType } from '@/constants/fileTypes'

const props = defineProps<{
  category: FileCategory
}>()

/** 视频等自定义色走同类 light 样式，不用 el-tag dark/实心色 */
const isVideo = computed(() => props.category === 'video')
</script>

<template>
  <el-tag
    size="small"
    effect="light"
    :type="isVideo ? undefined : getCategoryTagType(category)"
    :class="{ 'category-tag--video': isVideo }"
  >
    {{ getCategoryLabel(category) }}
  </el-tag>
</template>

<style scoped>
/* 对齐 Element Plus light：浅绿/红/蓝等同款浅底描边，视频用紫色 */
.category-tag--video {
  --el-tag-bg-color: #f0f1fe;
  --el-tag-border-color: #d5d8f8;
  --el-tag-text-color: #626aef;
  background-color: #f0f1fe;
  border-color: #d5d8f8;
  color: #626aef;
}
</style>
