<template>
  <div class="kgs-result-view flex-1 flex flex-col min-h-0">
    <!-- 视图切换按钮 -->
    <div class="flex items-center justify-center gap-1 mb-2 flex-shrink-0">
      <div
        class="inline-flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-0.5"
      >
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
          :class="
            activeView === 'graph'
              ? 'bg-teal-50 text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          "
          @click="activeView = 'graph'"
        >
          <svg
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 2v4"></path>
            <path d="M12 18v4"></path>
            <path d="m4.93 4.93 2.83 2.83"></path>
            <path d="m16.24 16.24 2.83 2.83"></path>
            <path d="M2 12h4"></path>
            <path d="M18 12h4"></path>
            <path d="m4.93 19.07 2.83-2.83"></path>
            <path d="m16.24 7.76 2.83-2.83"></path>
          </svg>
          图谱视图
        </button>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200"
          :class="
            activeView === 'list'
              ? 'bg-teal-50 text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          "
          @click="activeView = 'list'"
        >
          <svg
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          列表视图
        </button>
      </div>
    </div>

    <!-- 图谱视图 -->
    <div v-show="activeView === 'graph'" class="flex-1 min-h-0 flex flex-col">
      <KGGraphCanvas />
    </div>

    <!-- 列表视图 -->
    <div v-show="activeView === 'list'" class="flex-1 min-h-0 flex flex-col">
      <KGResultPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import KGGraphCanvas from './KGGraphCanvas.vue'
import KGResultPanel from './KGResultPanel.vue'

type ViewMode = 'graph' | 'list'

const activeView = ref<ViewMode>('graph')
</script>
