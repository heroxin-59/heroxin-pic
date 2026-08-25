import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** 应用级状态（脚手架占位，后续扩展上传队列 / 文件列表等） */
export const useAppStore = defineStore('app', () => {
  const appName = ref('heroxin-pic')
  const ready = ref(true)

  const statusText = computed(() => (ready.value ? '就绪' : '初始化中'))

  function setReady(value: boolean) {
    ready.value = value
  }

  return {
    appName,
    ready,
    statusText,
    setReady,
  }
})
