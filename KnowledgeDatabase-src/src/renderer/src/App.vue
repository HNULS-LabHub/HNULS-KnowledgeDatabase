<script setup lang="ts">
import { ref, provide } from 'vue'
import WelcomePage from './views/WelcomePage/index.vue'
import MainWindow from './views/MainWindow/index.vue'
import MessageToast from './components/MessageToast/index.vue'

const currentView = ref<'welcome' | 'main'>('welcome')
const toastRef = ref<InstanceType<typeof MessageToast> | null>(null)

// 提供全局 toast
provide('toast', {
  success: (...args: any[]) => toastRef.value?.success(...args),
  error: (...args: any[]) => toastRef.value?.error(...args),
  warning: (...args: any[]) => toastRef.value?.warning(...args),
  info: (...args: any[]) => toastRef.value?.info(...args)
})

const handleEnterApp = () => {
  currentView.value = 'main'
}
</script>

<template>
  <div class="app">
    <WelcomePage v-if="currentView === 'welcome'" @enter-app="handleEnterApp" />
    <MainWindow v-else />
    <MessageToast ref="toastRef" />
  </div>
</template>

<style>
/* 全局样式重置 - 只重置必要的元素 */
html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>

<style scoped>
@reference "tailwindcss";

.app {
  @apply w-full h-full overflow-hidden flex flex-col;
}
</style>
