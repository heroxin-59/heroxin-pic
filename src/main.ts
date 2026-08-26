import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import './styles/theme.css'
import './style.css'
import App from './App.vue'
import router from '@/router'
import { showAppError } from '@/utils/message'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

/** 未被捕获的渲染/事件异常：提示用户，避免静默失败 */
app.config.errorHandler = (error, _instance, info) => {
  if (import.meta.env.DEV) {
    console.error('[app.errorHandler]', info, error)
  }
  showAppError(error)
}

app.mount('#app')
