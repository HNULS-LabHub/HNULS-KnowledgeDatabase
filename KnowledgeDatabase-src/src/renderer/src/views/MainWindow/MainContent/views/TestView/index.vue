<template>
  <div class="ts-root flex flex-col h-full bg-slate-50">
    <!-- 页面头部 -->
    <header class="ts-header flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <svg class="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h1 class="text-lg font-semibold text-slate-800">测试工具</h1>
      </div>
      <!-- 页面切换 -->
      <div class="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
          :class="activeTab === tab.id 
            ? 'bg-white text-slate-900 shadow-sm' 
            : 'text-slate-500 hover:text-slate-700'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </header>

    <!-- 内容区 -->
    <main class="ts-main flex-1 overflow-hidden">
      <KgModelTest v-if="activeTab === 'kg-model'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import KgModelTest from './KgModelTest.vue'

const activeTab = ref('kg-model')

const tabs = [
  { id: 'kg-model', label: '知识图谱模型测试' }
]
</script>
