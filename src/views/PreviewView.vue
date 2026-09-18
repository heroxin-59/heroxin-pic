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
import CategoryTag from '@/components/file-list/CategoryTag.vue'
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
    <header class="preview-view__masthead">
      <div class="preview-view__masthead-main">
        <el-button text :icon="ArrowLeft" class="preview-view__back" @click="goBack">
          返回
        </el-button>
        <div class="preview-view__heading">
          <h1 class="preview-view__title">
            {{ current?.name || '预览' }}
          </h1>
          <p class="preview-view__lede">源文件在线预览，不做转码</p>
          <div v-if="current && previewKind !== 'text'" class="preview-view__tags">
            <CategoryTag :category="current.category" />
            <span v-if="current.size" class="preview-view__size">{{ formatBytes(current.size) }}</span>
          </div>
        </div>
      </div>
    </header>

    <div class="preview-view__stage">
      <div v-if="loading" v-loading="true" class="preview-view__loading" />

      <el-empty v-else-if="!queryKey" description="请从文件列表选择文件进行预览">
        <el-button type="primary" @click="goFiles">打开文件</el-button>
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
    </div>
  </div>
</template>

<style scoped>
.preview-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.preview-view__masthead {
  padding: 4px 2px 18px;
}

.preview-view__masthead-main {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.preview-view__back {
  flex-shrink: 0;
  min-height: 40px;
  touch-action: manipulation;
  margin-top: 2px;
}

.preview-view__heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-view__title {
  margin: 0;
  font-size: clamp(1.35rem, 4vw, 1.85rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--app-text);
  word-break: break-all;
  line-height: 1.25;
}

.preview-view__lede {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--app-text-secondary);
}

.preview-view__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.preview-view__size {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text);
  background: color-mix(in srgb, var(--brand-chip) 50%, white);
  border: 1px solid color-mix(in srgb, var(--brand-chip) 65%, white);
}

.preview-view__stage {
  flex: 1;
  min-width: 0;
  padding: 14px 12px 20px;
  border-radius: var(--app-radius);
  background: color-mix(in srgb, var(--app-surface) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-border) 80%, transparent);
  box-shadow: var(--app-shadow);
  backdrop-filter: blur(6px);
}

.preview-view__loading {
  min-height: 280px;
}

@media (max-width: 767px) {
  .preview-view__masthead {
    padding: 0 0 14px;
  }

  .preview-view__stage {
    margin: 0 -4px;
    padding: 12px 8px 16px;
    border-radius: 14px;
  }
}
</style>
