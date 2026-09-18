<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Back, Folder, House } from '@element-plus/icons-vue'

const router = useRouter()

function goHome() {
  void router.push({ name: 'images' })
}

function goFiles() {
  void router.push({ name: 'files' })
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  goHome()
}
</script>

<template>
  <div class="not-found">
    <header class="not-found__masthead">
      <h1 class="not-found__title">找不到页面</h1>
      <p class="not-found__lede">地址可能写错了，或页面已被移除</p>
    </header>

    <section class="not-found__stage">
      <p class="not-found__code" aria-hidden="true">404</p>
      <div class="not-found__actions">
        <el-button type="primary" :icon="House" @click="goHome">回相册</el-button>
        <el-button :icon="Folder" @click="goFiles">文件</el-button>
        <el-button text :icon="Back" @click="goBack">返回上一页</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  min-height: min(70vh, 560px);
  padding: 8px 0 24px;
}

.not-found__masthead {
  padding: 4px 2px 18px;
}

.not-found__title {
  margin: 0;
  font-size: clamp(1.75rem, 5vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--app-text);
}

.not-found__lede {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: var(--app-text-secondary);
}

.not-found__stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 40px 16px;
  border-radius: var(--app-radius);
  background: color-mix(in srgb, var(--app-surface) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-border) 80%, transparent);
  box-shadow: var(--app-shadow);
  backdrop-filter: blur(6px);
}

.not-found__code {
  margin: 0;
  font-size: clamp(4rem, 18vw, 6.5rem);
  font-weight: 700;
  letter-spacing: -0.06em;
  line-height: 1;
  color: color-mix(in srgb, var(--brand-primary) 35%, var(--app-bg));
  user-select: none;
}

.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

@media (max-width: 767px) {
  .not-found__masthead {
    padding: 0 0 14px;
  }

  .not-found__stage {
    margin: 0 -4px;
    border-radius: 14px;
  }
}
</style>
