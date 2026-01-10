<template>
  <header class="top-bar">
    <div class="breadcrumb">
      <span class="breadcrumb-item">Nexus</span>
      <svg
        class="chevron-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
      <span
        class="breadcrumb-item"
        :class="{ 'breadcrumb-current': !extraBreadcrumb }"
        @click="$emit('navigate-back')"
      >
        <svg
          v-if="currentPage === 'dashboard' || currentPage === 'index'"
          class="context-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M10.586 10.586L16.95 7.05l-3.536 6.364m-2.828-2.828L7.05 16.95l6.364-3.536m-2.828-2.828l2.828 2.828"
          ></path>
          <path
            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10m7-10h-1M6 12H5m7-7v1m0 12v1M7.05 7.05l.707.707m8.486 8.486l.707.707"
          ></path>
        </svg>
        <svg
          v-else-if="currentPage === 'rag'"
          class="context-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <svg
          v-else-if="currentPage === 'graph'"
          class="context-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="18" cy="18" r="3"></circle>
          <circle cx="6" cy="6" r="3"></circle>
          <circle cx="6" cy="18" r="3"></circle>
          <line x1="8.59" y1="7.41" x2="15.42" y2="16.59"></line>
          <line x1="8.59" y1="16.59" x2="15.42" y2="7.41"></line>
        </svg>
        {{ pageTitle }}
      </span>

      <!-- Extra Breadcrumb (Dynamic) -->
      <template v-if="extraBreadcrumb">
        <svg
          class="chevron-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <span class="breadcrumb-current">
          {{ extraBreadcrumb }}
        </span>
      </template>
    </div>

    <div class="right-actions">
      <div class="search-wrapper">
        <svg
          class="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <span class="search-text">全局搜索...</span>
        <span class="search-shortcut">⌘K</span>
      </div>
      <button class="notification-btn">
        <svg
          class="bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="notification-badge"></span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: string
  extraBreadcrumb?: string
}>()

defineEmits<{
  (e: 'navigate-back'): void
}>()

const pageTitle = computed(() => {
  const titles = {
    index: '首页',
    dashboard: '首页',
    rag: 'Retrieval',
    graph: 'Graph',
    docs: 'Docs'
  }
  return titles[props.currentPage] || props.currentPage
})
</script>

<style scoped>
.top-bar {
  height: 48px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 30;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.breadcrumb-item {
  cursor: pointer;
  transition: color 300ms;
  font-weight: 500;
}

.breadcrumb-item:hover {
  color: #0f172a;
}

.chevron-icon {
  width: 1rem;
  height: 1rem;
  color: #cbd5e1;
}

.breadcrumb-current {
  color: #0f172a;
  font-weight: 600;
  background: #f1f5f9;
  padding: 0.125rem 0.5rem;
  border-radius: 0.375rem;
  text-transform: capitalize;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.context-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  color: #94a3b8;
  font-size: 0.875rem;
  cursor: text;
  transition: all 300ms;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.search-wrapper:hover {
  border-color: #cbd5e1;
  background: white;
}

.search-icon {
  width: 1rem;
  height: 1rem;
  transition: color 300ms;
}

.search-wrapper:hover .search-icon {
  color: #4f46e5;
}

.search-text {
  display: none;
}

@media (min-width: 768px) {
  .search-text {
    display: inline;
  }
}

.search-shortcut {
  margin-left: 1.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  background: white;
  border: 1px solid #e2e8f0;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  color: #94a3b8;
}

.notification-btn {
  position: relative;
  padding: 0.5rem;
  color: #94a3b8;
  background: none;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 300ms;
}

.notification-btn:hover {
  color: #4f46e5;
  background: #eef2ff;
}

.bell-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.notification-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 0.5rem;
  height: 0.5rem;
  background: #ef4444;
  border-radius: 9999px;
  border: 1px solid white;
}
</style>
