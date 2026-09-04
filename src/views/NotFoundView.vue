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
    <el-result icon="warning" title="页面不存在" sub-title="地址可能写错了，或页面已被移除。">
      <template #extra>
        <div class="not-found__actions">
          <el-button type="primary" :icon="House" @click="goHome">回相册</el-button>
          <el-button :icon="Folder" @click="goFiles">文件列表</el-button>
          <el-button text :icon="Back" @click="goBack">返回上一页</el-button>
        </div>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: min(60vh, 480px);
  padding: 24px 12px;
}

.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
</style>
