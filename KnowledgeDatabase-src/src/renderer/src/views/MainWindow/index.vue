<template>
  <div class="main-window">
    <MainContent />
  </div>
</template>

<script setup lang="ts">
import MainContent from './MainContent/index.vue'
</script>

<style scoped>
.main-window {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>