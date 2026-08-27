<script setup lang="ts">
import { ref } from 'vue'
import { Lock } from '@element-plus/icons-vue'
import { appTitle } from '@/config/appMeta'
import { verifyAccessPassphrase } from '@/config/accessGate'

const emit = defineEmits<{
  unlocked: []
}>()

const passphrase = ref('')
const submitting = ref(false)
const errorMessage = ref('')

async function submit() {
  if (submitting.value) return
  errorMessage.value = ''
  submitting.value = true
  try {
    const ok = await verifyAccessPassphrase(passphrase.value)
    if (!ok) {
      errorMessage.value = '口令不正确'
      return
    }
    emit('unlocked')
  } catch {
    errorMessage.value = '验证失败，请重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="access-gate">
    <div class="access-gate__panel">
      <div class="access-gate__icon" aria-hidden="true">
        <el-icon :size="28"><Lock /></el-icon>
      </div>
      <h1 class="access-gate__title">{{ appTitle }}</h1>
      <p class="access-gate__hint">请输入访问口令后继续</p>

      <el-form class="access-gate__form" @submit.prevent="submit">
        <el-input
          v-model="passphrase"
          type="password"
          show-password
          autocomplete="current-password"
          placeholder="访问口令"
          size="large"
          :disabled="submitting"
          @keyup.enter="submit"
        />
        <p v-if="errorMessage" class="access-gate__error" role="alert">{{ errorMessage }}</p>
        <el-button type="primary" size="large" class="access-gate__submit" :loading="submitting" @click="submit">
          进入
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.access-gate {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding:
    calc(24px + var(--safe-top, 0px)) calc(20px + var(--safe-right, 0px))
    calc(24px + var(--safe-bottom, 0px)) calc(20px + var(--safe-left, 0px));
  background: linear-gradient(160deg, var(--app-bg) 0%, var(--app-bg-accent) 100%);
}

.access-gate__panel {
  width: min(100%, 400px);
  padding: 28px 24px 24px;
  border-radius: var(--app-radius, 12px);
  background: var(--app-surface);
  box-shadow: var(--app-shadow, 0 2px 12px rgba(0, 0, 0, 0.08));
  text-align: center;
}

.access-gate__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 12px;
  border-radius: 50%;
  color: var(--brand-primary);
  background: var(--brand-primary-soft);
}

.access-gate__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--app-text);
}

.access-gate__hint {
  margin: 8px 0 20px;
  font-size: 14px;
  color: var(--app-text-muted);
}

.access-gate__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.access-gate__error {
  margin: 0;
  font-size: 13px;
  color: var(--brand-danger);
  text-align: left;
}

.access-gate__submit {
  width: 100%;
  min-height: 44px;
  margin-top: 4px;
}
</style>
