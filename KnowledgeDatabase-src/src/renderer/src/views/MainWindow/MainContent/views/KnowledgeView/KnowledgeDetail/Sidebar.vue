<template>
  <div class="KnowledgeView_KnowledgeDetail_Sidebar_container">
    <!-- 顶部 KB 信息卡片 -->
    <div class="KnowledgeView_KnowledgeDetail_Sidebar_infoCard">
      <div class="KnowledgeView_KnowledgeDetail_Sidebar_infoHeader">
        <div
          class="KnowledgeView_KnowledgeDetail_Sidebar_iconWrapper"
          :style="{
            background: getLightColor(kb.color),
            color: kb.color
          }"
          v-html="kb.icon"
        ></div>
        <div class="KnowledgeView_KnowledgeDetail_Sidebar_textInfo">
          <h2 class="KnowledgeView_KnowledgeDetail_Sidebar_kbName" :title="kb.name">
            {{ kb.name }}
          </h2>
          <span class="KnowledgeView_KnowledgeDetail_Sidebar_kbId"
            >ID: {{ String(kb.id).padStart(4, '0') }}</span
          >
        </div>
      </div>

      <div class="KnowledgeView_KnowledgeDetail_Sidebar_statsRow">
        <div class="KnowledgeView_KnowledgeDetail_Sidebar_statItem">
          <span class="KnowledgeView_KnowledgeDetail_Sidebar_statValue">{{ currentKB?.docCount ?? kb.docCount }}</span>
          <span class="KnowledgeView_KnowledgeDetail_Sidebar_statLabel">文件</span>
        </div>
        <div class="KnowledgeView_KnowledgeDetail_Sidebar_statDivider"></div>
        <div class="KnowledgeView_KnowledgeDetail_Sidebar_statItem">
          <span class="KnowledgeView_KnowledgeDetail_Sidebar_statValue">{{ currentKB?.chunkCount ?? kb.chunkCount }}</span>
          <span class="KnowledgeView_KnowledgeDetail_Sidebar_statLabel">分片</span>
        </div>
      </div>
    </div>

    <!-- 导航菜单 -->
    <nav class="KnowledgeView_KnowledgeDetail_Sidebar_navMenu">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="KnowledgeView_KnowledgeDetail_Sidebar_navItem"
        :class="{ KnowledgeView_KnowledgeDetail_Sidebar_navItem_active: currentNav === item.id }"
        @click="$emit('update:currentNav', item.id)"
      >
        <span class="KnowledgeView_KnowledgeDetail_Sidebar_navIcon" v-html="item.icon"></span>
        <span class="KnowledgeView_KnowledgeDetail_Sidebar_navLabel">{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeBase, NavItem } from '../types'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'

const props = defineProps<{
  kb: KnowledgeBase
  currentNav: NavItem
}>()

defineEmits<{
  (e: 'update:currentNav', val: NavItem): void
}>()

// 使用 Store 获取最新的知识库数据
const knowledgeLibraryStore = useKnowledgeLibraryStore()
const currentKB = computed(() => {
  return knowledgeLibraryStore.getById(props.kb.id)
})

const navItems: { id: NavItem; label: string; icon: string }[] = [
  {
    id: 'files',
    label: '文件列表',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
  },
  {
    id: 'search',
    label: '检索测试',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><path d="M11 8V14"></path><path d="M8 11H14"></path></svg>`
  },
  {
    id: 'logs',
    label: '日志',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`
  },
  {
    id: 'settings',
    label: '配置',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`
  }
]

// 辅助函数：生成浅色背景色
const getLightColor = (hex: string) => {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) return 'rgba(0,0,0,0.05)'
  let c = hex.substring(1).split('')
  if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]]
  const r = parseInt(c[0] + c[1], 16)
  const g = parseInt(c[2] + c[3], 16)
  const b = parseInt(c[4] + c[5], 16)
  return `rgba(${r}, ${g}, ${b}, 0.1)`
}
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_Sidebar_container {
  width: 260px;
  height: 100%;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(226, 232, 240, 0.8);
  display: flex;
  flex-direction: column;
  gap: 2rem;
  flex-shrink: 0;
  box-sizing: border-box;
}

.KnowledgeView_KnowledgeDetail_Sidebar_infoCard {
  background: white;
  border-radius: 1rem;
  padding: 1rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(226, 232, 240, 0.6);
}

.KnowledgeView_KnowledgeDetail_Sidebar_infoHeader {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  align-items: center;
}

.KnowledgeView_KnowledgeDetail_Sidebar_iconWrapper {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.KnowledgeView_KnowledgeDetail_Sidebar_iconWrapper :deep(svg) {
  width: 1.5rem;
  height: 1.5rem;
}

.KnowledgeView_KnowledgeDetail_Sidebar_textInfo {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.KnowledgeView_KnowledgeDetail_Sidebar_kbName {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.KnowledgeView_KnowledgeDetail_Sidebar_kbId {
  font-size: 0.75rem;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, monospace;
  margin-top: 0.125rem;
}

.KnowledgeView_KnowledgeDetail_Sidebar_statsRow {
  display: flex;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid #f1f5f9;
}

.KnowledgeView_KnowledgeDetail_Sidebar_statItem {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
}

.KnowledgeView_KnowledgeDetail_Sidebar_statValue {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.KnowledgeView_KnowledgeDetail_Sidebar_statLabel {
  font-size: 0.7rem;
  color: #94a3b8;
}

.KnowledgeView_KnowledgeDetail_Sidebar_statDivider {
  width: 1px;
  height: 1.5rem;
  background: #f1f5f9;
}

.KnowledgeView_KnowledgeDetail_Sidebar_navMenu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.KnowledgeView_KnowledgeDetail_Sidebar_navItem {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 200ms;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 500;
}

.KnowledgeView_KnowledgeDetail_Sidebar_navItem:hover {
  background: #f8fafc;
  color: #0f172a;
}

.KnowledgeView_KnowledgeDetail_Sidebar_navItem_active {
  background: #eff6ff; /* blue-50 */
  color: #2563eb; /* blue-600 */
}

.KnowledgeView_KnowledgeDetail_Sidebar_navItem_active:hover {
  background: #eff6ff;
  color: #2563eb;
}

.KnowledgeView_KnowledgeDetail_Sidebar_navIcon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.KnowledgeView_KnowledgeDetail_Sidebar_navIcon :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
