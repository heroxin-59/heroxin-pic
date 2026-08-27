<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import ImagePreview from '@/components/preview/ImagePreview.vue'
import { AsyncPdfPreview, AsyncWordPreview } from '@/components/preview/asyncPreview'
import TextPreview from '@/components/preview/TextPreview.vue'
import VideoPreview from '@/components/preview/VideoPreview.vue'
import PreviewFallback from '@/components/preview/PreviewFallback.vue'
import { useFilePreview } from '@/composables/useFilePreview'
import { getCategoryLabel, getCategoryTagType } from '@/constants/fileTypes'
import type { FileRecord } from '@/types/file'
import { formatBytes } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const { current, loading, errorMessage, previewKind, imageGallery, load, setCurrent, clear, download } =
  useFilePreview()

const queryKey = computed(() => {
  const value = route.query.key
  return typeof value === 'string' ? value : ''
})

const queryName = computed(() => {
  const value = route.query.name
  return typeof value === 'string' ? value : undefined
})

async function loadPreview() {
  if (!queryKey.value) {
    clear()
    return
  }
  await load({ key: queryKey.value, name: queryName.value })
}

function onChangeImage(record: FileRecord) {
  setCurrent(record)
  router.replace({
    name: 'preview',
    query: { key: record.key, name: record.name },
  })
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.push({ name: 'files' })
}

function goFiles() {
  router.push({ name: 'files' })
}

watch(
  () => [queryKey.value, queryName.value] as const,
  ([key]) => {
    if (!key) {
      clear()
      return
    }
    // 左右切换已在 onChangeImage 同步 current，勿整页 loading 卸载预览（会闪白）
    if (current.value?.key === key) return
    void loadPreview()
  },
  { immediate: true },
)
</script>

<template>
  <div class="preview-view">
    <el-card shadow="never">
      <template #header>
        <div class="preview-view__header">
          <div class="preview-view__title-wrap">
            <el-button text :icon="ArrowLeft" class="preview-view__back" @click="goBack">
              返回
            </el-button>
            <div class="preview-view__heading">
              <span class="preview-view__title">
                {{ current?.name || '文件预览' }}
              </span>
              <div v-if="current && previewKind !== 'text'" class="preview-view__tags">
                <el-tag size="small" :type="getCategoryTagType(current.category)">{{
                  getCategoryLabel(current.category)
                }}</el-tag>
                <el-tag v-if="current.size" size="small" type="success">
                  {{ formatBytes(current.size) }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-if="loading" v-loading="true" class="preview-view__loading" />

      <el-empty v-else-if="!queryKey" description="请从文件列表选择文件进行预览">
        <el-button type="primary" @click="goFiles">打开文件列表</el-button>
      </el-empty>

      <el-result
        v-else-if="errorMessage || !current"
        icon="error"
        :title="errorMessage || '预览失败'"
      >
        <template #extra>
          <el-button type="primary" @click="loadPreview">重试</el-button>
          <el-button @click="goFiles">返回列表</el-button>
        </template>
      </el-result>

      <ImagePreview
        v-else-if="previewKind === 'image'"
        :current="current"
        :gallery="imageGallery"
        @change="onChangeImage"
        @download="download"
      />

      <AsyncPdfPreview v-else-if="previewKind === 'pdf'" :record="current" @download="download" />

      <AsyncWordPreview
        v-else-if="previewKind === 'word'"
        :record="current"
        @download="download"
      />

      <TextPreview v-else-if="previewKind === 'text'" :record="current" @download="download" />

      <VideoPreview v-else-if="previewKind === 'video'" :record="current" @download="download" />

      <PreviewFallback
        v-else
        :record="current"
        :kind="previewKind || 'unsupported'"
        @download="download"
      />
    </el-card>
  </div>
</template>

<style scoped>
.preview-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-view__title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.preview-view__back {
  flex-shrink: 0;
  min-height: 40px;
  touch-action: manipulation;
}

.preview-view__heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-view__title {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
  word-break: break-all;
  line-height: 1.4;
}

.preview-view__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preview-view__loading {
  min-height: 280px;
}

@media (max-width: 767px) {
  .preview-view__title {
    font-size: 15px;
  }
}
</style>
