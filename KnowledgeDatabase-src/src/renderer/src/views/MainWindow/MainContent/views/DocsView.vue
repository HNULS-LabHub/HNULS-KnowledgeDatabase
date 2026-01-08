<template>
  <div class="docs-view">
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
        </svg>
      </div>
      <p class="empty-text">文档管理模块演示占位符</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Docs view logic
</script>

<style scoped>
.docs-view {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 300ms;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #94a3b8;
}

.empty-icon-wrapper {
  width: 5rem;
  height: 5rem;
  background: #f1f5f9;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  width: 2.5rem;
  height: 2.5rem;
  opacity: 0.3;
}

.empty-text {
  font-weight: 500;
  margin: 0;
}
</style>