<script setup lang="ts">
import { Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const { appName, statusText } = storeToRefs(appStore)

function onTest() {
  ElMessage.success(`Pinia 状态：${statusText.value}`)
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>{{ appName }} · 上传</span>
        <el-tag type="success">{{ statusText }}</el-tag>
      </div>
    </template>
    <p>上传功能将在后续阶段实现。当前用于验证路由与 Pinia。</p>
    <el-button type="primary" :icon="Upload" @click="onTest">测试 Pinia</el-button>
  </el-card>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
