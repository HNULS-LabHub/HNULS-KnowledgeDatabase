<script setup lang="ts">
import { ref } from 'vue'
import WelcomePage from './views/WelcomePage/index.vue'
import MainWindow from './views/MainWindow/index.vue'

const currentView = ref<'welcome' | 'main'>('welcome')

const handleEnterApp = () => {
  currentView.value = 'main'
}
</script>

<template>
  <div class="app">
    <WelcomePage v-if="currentView === 'welcome'" @enter-app="handleEnterApp" />
    <MainWindow v-else />
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
.app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
