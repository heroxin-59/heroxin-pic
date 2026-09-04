<script setup lang="ts">
import { onErrorCaptured, ref, watch } from 'vue'
import { Refresh, House } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { getErrorMessage, toAppError } from '@/utils/error'

const props = defineProps<{
  /** 重置错误态的依赖（如路由 path），切换后自动恢复 */
  resetKey?: string | number
}>()

const emit = defineEmits<{
  error: [error: unknown]
}>()

const router = useRouter()
const captured = ref<Error | null>(null)

const message = ref('')

function report(error: unknown) {
  const appError = toAppError(error)
  captured.value = appError
  message.value = getErrorMessage(appError) || '页面渲染出错'
  emit('error', appError)
  // 阻止继续向上冒泡，由本边界承接
  return false
}

onErrorCaptured((err) => report(err))

watch(
  () => props.resetKey,
  () => {
    captured.value = null
    message.value = ''
  },
)

function retry() {
  captured.value = null
  message.value = ''
}

function goHome() {
  captured.value = null
  message.value = ''
  void router.push({ name: 'images' })
}
</script>

<template>
  <div class="app-error-boundary">
    <el-result
      v-if="captured"
      icon="error"
      title="出错了"
      :sub-title="message"
      class="app-error-boundary__result"
    >
      <template #extra>
        <div class="app-error-boundary__actions">
          <el-button type="primary" :icon="Refresh" @click="retry">重试</el-button>
          <el-button :icon="House" @click="goHome">回相册</el-button>
        </div>
      </template>
    </el-result>
    <slot v-else />
  </div>
</template>

<style scoped>
.app-error-boundary__result {
  min-height: min(50vh, 360px);
}

.app-error-boundary__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
</style>
