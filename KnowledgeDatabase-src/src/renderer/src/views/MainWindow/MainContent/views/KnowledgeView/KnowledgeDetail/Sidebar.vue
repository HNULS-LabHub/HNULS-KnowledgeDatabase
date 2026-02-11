<template>
  <div
    class="KnowledgeView_KnowledgeDetail_Sidebar_container sidebar-container h-full bg-white/60 backdrop-blur-[20px] border-r border-slate-200/80 flex flex-col flex-shrink-0 box-border overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out"
    :class="collapsed ? 'w-16 p-3' : 'w-[260px] p-6'"
  >
    <!-- 顶部 KB 信息卡片 -->
    <div
      class="KnowledgeView_KnowledgeDetail_Sidebar_infoCard info-card bg-white rounded-2xl shadow-sm border border-slate-200/60 transition-all duration-300"
      :class="collapsed ? 'p-2' : 'p-4 mb-8'"
    >
      <!-- 展开态：完整信息 -->
      <template v-if="!collapsed">
        <div
          class="KnowledgeView_KnowledgeDetail_Sidebar_infoHeader info-header flex gap-3 mb-4 items-center"
        >
          <div
            class="KnowledgeView_KnowledgeDetail_Sidebar_iconWrapper icon-wrapper w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            :style="{ background: getLightColor(kb.color), color: kb.color }"
            v-html="kb.icon"
          ></div>
          <div
            class="KnowledgeView_KnowledgeDetail_Sidebar_textInfo text-info flex-1 min-w-0 flex flex-col justify-center"
          >
            <h2
              class="KnowledgeView_KnowledgeDetail_Sidebar_kbName kb-name m-0 text-base font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis"
              :title="kb.name"
            >
              {{ kb.name }}
            </h2>
            <span
              class="KnowledgeView_KnowledgeDetail_Sidebar_kbId kb-id text-xs text-slate-400 font-mono mt-0.5"
              >ID: {{ String(kb.id).padStart(4, '0') }}</span
            >
          </div>
        </div>
        <div
          class="KnowledgeView_KnowledgeDetail_Sidebar_statsRow stats-row flex items-center pt-3 border-t border-slate-100"
        >
          <div class="KnowledgeView_KnowledgeDetail_Sidebar_statItem stat-item flex-1 flex flex-col items-center gap-0.5">
            <span class="KnowledgeView_KnowledgeDetail_Sidebar_statValue stat-value text-sm font-semibold text-slate-700">{{ currentKB?.docCount ?? kb.docCount }}</span>
            <span class="KnowledgeView_KnowledgeDetail_Sidebar_statLabel stat-label text-[0.7rem] text-slate-400">文件</span>
          </div>
          <div class="KnowledgeView_KnowledgeDetail_Sidebar_statDivider stat-divider w-px h-6 bg-slate-100"></div>
          <div class="KnowledgeView_KnowledgeDetail_Sidebar_statItem stat-item flex-1 flex flex-col items-center gap-0.5">
            <span class="KnowledgeView_KnowledgeDetail_Sidebar_statValue stat-value text-sm font-semibold text-slate-700">{{ currentKB?.chunkCount ?? kb.chunkCount }}</span>
            <span class="KnowledgeView_KnowledgeDetail_Sidebar_statLabel stat-label text-[0.7rem] text-slate-400">分片</span>
          </div>
        </div>
      </template>

      <!-- 收缩态：只显示图标 -->
      <template v-else>
        <div
          class="flex items-center justify-center"
          :title="kb.name"
        >
          <div
            class="KnowledgeView_KnowledgeDetail_Sidebar_iconWrapper icon-wrapper w-10 h-10 rounded-xl flex items-center justify-center"
            :style="{ background: getLightColor(kb.color), color: kb.color }"
            v-html="kb.icon"
          ></div>
        </div>
      </template>
    </div>

    <!-- 导航菜单 -->
    <nav
      class="KnowledgeView_KnowledgeDetail_Sidebar_navMenu nav-menu flex flex-col gap-2"
      :class="collapsed ? 'mt-4' : ''"
    >
      <button
        v-for="item in navItems"
        :key="item.id"
        class="KnowledgeView_KnowledgeDetail_Sidebar_navItem nav-item w-full flex items-center border-none bg-transparent text-slate-500 rounded-xl cursor-pointer transition-all duration-200 text-sm font-medium"
        :class="[
          collapsed ? 'justify-center px-0 py-3' : 'justify-start gap-3 px-4 py-3',
          currentNav === item.id
            ? 'KnowledgeView_KnowledgeDetail_Sidebar_navItem_active nav-item-active bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
            : 'hover:bg-slate-50 hover:text-slate-900'
        ]"
        :title="collapsed ? item.label : undefined"
        @click="$emit('update:currentNav', item.id)"
      >
        <span
          class="KnowledgeView_KnowledgeDetail_Sidebar_navIcon nav-icon flex items-center justify-center"
          v-html="item.icon"
        ></span>
        <span
          v-if="!collapsed"
          class="KnowledgeView_KnowledgeDetail_Sidebar_navLabel nav-label"
        >{{ item.label }}</span>
      </button>
    </nav>

    <!-- 底部展开/收缩按钮 -->
    <div class="mt-auto pt-4">
      <button
        class="w-full flex items-center justify-center py-2.5 border-none bg-transparent text-slate-400 rounded-xl cursor-pointer transition-all duration-200 hover:bg-slate-100 hover:text-slate-600"
        :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="collapsed = !collapsed"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="w-5 h-5 transition-transform duration-300"
          :class="collapsed ? 'rotate-180' : ''"
        >
          <polyline points="11 17 6 12 11 7"></polyline>
          <polyline points="18 17 13 12 18 7"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { KnowledgeBase, NavItem } from '../types'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'

const props = defineProps<{
  kb: KnowledgeBase
  currentNav: NavItem
}>()

defineEmits<{
  (e: 'update:currentNav', val: NavItem): void
}>()

// 默认收缩
const collapsed = ref(true)

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
const getLightColor = (hex: string): string => {
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
.KnowledgeView_KnowledgeDetail_Sidebar_iconWrapper :deep(svg) {
  width: 1.5rem;
  height: 1.5rem;
}

.KnowledgeView_KnowledgeDetail_Sidebar_navIcon :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}
</style>