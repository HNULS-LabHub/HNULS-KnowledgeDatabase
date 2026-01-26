import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/styles/tailwind.css'
import { initEmbeddingConfig } from './services/embedding-sync.service'

// 创建 Pinia 实例
const pinia = createPinia()

// 创建 Vue 应用实例
const app = createApp(App)

// 使用 Pinia
app.use(pinia)

// 挂载应用
app.mount('#app')

// 应用启动后初始化嵌入配置
initEmbeddingConfig().catch((err) => {
  console.error('[Main] Failed to init embedding config:', err)
})
