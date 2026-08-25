<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowLeft } from '@element-plus/icons-vue'
import ImagePreview from '@/components/preview/ImagePreview.vue'
import PdfPreview from '@/components/preview/PdfPreview.vue'
import TextPreview from '@/components/preview/TextPreview.vue'
import WordPreview from '@/components/preview/WordPreview.vue'
import PreviewFallback from '@/components/preview/PreviewFallback.vue'
import { getCategoryLabel } from '@/constants/fileTypes'
import { getPreviewKind, openPreviewDownload, resolvePreviewRecord } from '@/services/preview'
import { useFileStore } from '@/stores/files'
import type { FileRecord } from '@/types/file'
import { formatBytes } from '@/utils/format'
import { showAppError, showAppSuccess } from '@/utils/message'

const route = useRoute()
const router = useRouter()
const fileStore = useFileStore()
const { records } = storeToRefs(fileStore)

const loading = ref(false)
const errorMessage = ref('')
const current = ref<FileRecord | null>(null)

const queryKey = computed(() => {
  const value = route.query.key
  return typeof value === 'string' ? value : ''
})

const queryName = computed(() => {
  const value = route.query.name
  return typeof value === 'string' ? value : undefined
})

const previewKind = computed(() => (current.value ? getPreviewKind(current.value) : null))

const imageGallery = computed(() => {
  const images = records.value.filter((item) => item.category === 'image')
  if (!current.value || current.value.category !== 'image') return images
  if (!images.some((item) => item.key === current.value!.key)) {
    return [current.value, ...images]
  }
  return images
})

async function loadPreview() {
  if (!queryKey.value) {
    current.value = null
    errorMessage.value = ''
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    current.value = await resolvePreviewRecord({
      key: queryKey.value,
      name: queryName.value,
    })
  } catch (error) {
    current.value = null
    errorMessage.value = '无法加载预览'
    showAppError(error)
  } finally {
    loading.value = false
  }
}

function onChangeImage(record: FileRecord) {
  current.value = record
  router.replace({
    name: 'preview',
    query: { key: record.key, name: record.name },
  })
}

async function onDownload() {
  if (!current.value) return
  try {
    await openPreviewDownload(current.value)
    showAppSuccess('已开始下载')
  } catch (error) {
    showAppError(error)
  }
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
  () => {
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
                <el-tag size="small" type="info">{{ getCategoryLabel(current.category) }}</el-tag>
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
        @download="onDownload"
      />

      <PdfPreview v-else-if="previewKind === 'pdf'" :record="current" @download="onDownload" />

      <WordPreview v-else-if="previewKind === 'word'" :record="current" @download="onDownload" />

      <TextPreview v-else-if="previewKind === 'text'" :record="current" @download="onDownload" />

      <PreviewFallback
        v-else
        :record="current"
        :kind="previewKind || 'unsupported'"
        @download="onDownload"
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
