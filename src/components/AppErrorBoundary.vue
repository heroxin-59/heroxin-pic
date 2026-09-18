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
    <div v-if="captured" class="app-error-boundary__panel">
      <header class="app-error-boundary__masthead">
        <h2 class="app-error-boundary__title">出错了</h2>
        <p class="app-error-boundary__lede">{{ message }}</p>
      </header>
      <section class="app-error-boundary__stage">
        <div class="app-error-boundary__actions">
          <el-button type="primary" :icon="Refresh" @click="retry">重试</el-button>
          <el-button :icon="House" @click="goHome">回相册</el-button>
        </div>
      </section>
    </div>
    <slot v-else />
  </div>
</template>

<style scoped>
.app-error-boundary__panel {
  display: flex;
  flex-direction: column;
  min-height: min(50vh, 420px);
  padding: 8px 0 16px;
}

.app-error-boundary__masthead {
  padding: 4px 2px 16px;
}

.app-error-boundary__title {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
  color: var(--app-text);
}

.app-error-boundary__lede {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--app-text-secondary);
  max-width: 42rem;
}

.app-error-boundary__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 16px;
  border-radius: var(--app-radius);
  background: color-mix(in srgb, var(--app-surface) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--app-border) 80%, transparent);
  box-shadow: var(--app-shadow);
  backdrop-filter: blur(6px);
}

.app-error-boundary__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

@media (max-width: 767px) {
  .app-error-boundary__masthead {
    padding: 0 0 12px;
  }

  .app-error-boundary__stage {
    margin: 0 -4px;
    border-radius: 14px;
  }
}
</style>
