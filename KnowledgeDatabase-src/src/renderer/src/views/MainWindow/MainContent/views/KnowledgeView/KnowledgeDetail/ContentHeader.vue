<template>
  <div class="KnowledgeView_KnowledgeDetail_ContentHeader_container">
    <div class="KnowledgeView_KnowledgeDetail_ContentHeader_left">
      <h2 class="KnowledgeView_KnowledgeDetail_ContentHeader_title">{{ title }}</h2>
      <div class="KnowledgeView_KnowledgeDetail_ContentHeader_divider"></div>

      <!-- 视图切换器 -->
      <div class="KnowledgeView_KnowledgeDetail_ContentHeader_viewSwitcher">
        <button
          v-for="view in viewOptions"
          :key="view.id"
          class="KnowledgeView_KnowledgeDetail_ContentHeader_viewBtn"
          :class="{
            KnowledgeView_KnowledgeDetail_ContentHeader_viewBtn_active: currentView === view.id
          }"
          @click="$emit('update:currentView', view.id)"
          :title="view.label"
        >
          <span v-html="view.icon"></span>
        </button>
      </div>
    </div>

    <div class="KnowledgeView_KnowledgeDetail_ContentHeader_right">
      <div class="KnowledgeView_KnowledgeDetail_ContentHeader_searchWrapper">
        <svg
          class="KnowledgeView_KnowledgeDetail_ContentHeader_searchIcon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input
          type="text"
          placeholder="搜索文件..."
          class="KnowledgeView_KnowledgeDetail_ContentHeader_searchInput"
        />
      </div>

      <!-- 每页条目数选择器 (仅在列表视图显示) -->
      <PageSizeSelector
        v-if="currentView === 'list'"
        :model-value="pageSize || 20"
        @update:model-value="$emit('update:pageSize', $event)"
      />

      <button class="KnowledgeView_KnowledgeDetail_ContentHeader_primaryBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        上传文件
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ViewType } from '../types'
import PageSizeSelector from './PageSizeSelector.vue'

defineProps<{
  title: string
  currentView: ViewType
  pageSize?: number
}>()

defineEmits<{
  (e: 'update:currentView', val: ViewType): void
  (e: 'update:pageSize', val: number): void
}>()

const viewOptions: { id: ViewType; label: string; icon: string }[] = [
  {
    id: 'tree',
    label: '树形视图',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="12" x2="9" y2="12"></line><line x1="21" y1="6" x2="9" y2="6"></line><line x1="21" y1="18" x2="9" y2="18"></line><circle cx="5" cy="12" r="1"></circle><circle cx="5" cy="6" r="1"></circle><circle cx="5" cy="18" r="1"></circle></svg>`
  },
  {
    id: 'list',
    label: '列表视图',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`
  },
  {
    id: 'card',
    label: '卡片视图',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`
  }
]
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_ContentHeader_container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  position: sticky;
  top: 0;
  z-index: 10;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_divider {
  width: 1px;
  height: 1.5rem;
  background: #cbd5e1;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_viewSwitcher {
  display: flex;
  background: #f1f5f9;
  padding: 0.125rem;
  border-radius: 0.5rem;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_viewBtn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 200ms;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_viewBtn:hover {
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_viewBtn_active {
  background: white;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.KnowledgeView_KnowledgeDetail_ContentHeader_viewBtn :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_searchWrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  transition: all 200ms;
  width: 240px;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_searchWrapper:focus-within {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.KnowledgeView_KnowledgeDetail_ContentHeader_searchIcon {
  width: 1rem;
  height: 1rem;
  color: #94a3b8;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_searchInput {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  width: 100%;
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_searchInput::placeholder {
  color: #cbd5e1;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_primaryBtn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #0f172a;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_primaryBtn:hover {
  background: #1e293b;
}

.KnowledgeView_KnowledgeDetail_ContentHeader_primaryBtn svg {
  width: 1rem;
  height: 1rem;
}

</style>
