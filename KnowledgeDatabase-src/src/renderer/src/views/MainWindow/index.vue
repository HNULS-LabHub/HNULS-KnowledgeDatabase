<template>
  <div class="main-window">
    <MainContent />
  </div>
</template>

<script setup lang="ts">
import MainContent from './MainContent/index.vue'
</script>

<style scoped>
@reference "tailwindcss";

.main-window {
  @apply w-full h-full overflow-hidden flex flex-col;
}
</style>
