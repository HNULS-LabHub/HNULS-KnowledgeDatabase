<template>
  <div class="kg-query-bar flex items-center gap-3 flex-1">
    <!-- 模式选择 -->
    <div class="relative" ref="dropdownRef">
      <button
        class="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
        @click="showDropdown = !showDropdown"
      >
        <svg
          class="w-4 h-4 text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path :d="currentModeOption?.icon ?? ''"></path>
        </svg>
        <span class="text-slate-700">{{ currentModeOption?.label }}</span>
        <svg
          class="w-3 h-3 text-slate-400 transition-transform"
          :class="{ 'rotate-180': showDropdown }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div
        v-if="showDropdown"
        class="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
      >
        <button
          v-for="opt in modes"
          :key="opt.value"
          class="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
          :class="{ 'bg-indigo-50': opt.value === kgStore.mode }"
          @click="selectMode(opt.value)"
        >
          <svg
            class="w-4 h-4 mt-0.5 flex-shrink-0"
            :class="opt.value === kgStore.mode ? 'text-indigo-500' : 'text-slate-400'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path :d="opt.icon"></path>
          </svg>
          <div class="min-w-0">
            <div
              class="text-sm font-medium"
              :class="opt.value === kgStore.mode ? 'text-indigo-700' : 'text-slate-700'"
            >
              {{ opt.label }}
            </div>
            <div class="text-xs text-slate-400 mt-0.5">{{ opt.description }}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- 搜索输入 -->
    <form class="flex-1 relative" @submit.prevent="handleSubmit">
      <input
        v-model="kgStore.query"
        type="text"
        placeholder="输入检索词，例如：机器学习、知识图谱构建..."
        class="query-input !py-2 !rounded-lg !text-sm"
        :disabled="kgStore.isSearching"
      />
      <button
        type="submit"
        class="submit-btn !opacity-100 !top-1 !right-1"
        :disabled="kgStore.isSearching || !kgStore.query.trim()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useKGSearchStore } from '@renderer/stores/kg-search/kg-search.store'
import { KG_SEARCH_MODES } from '@renderer/stores/kg-search/kg-search.mock'
import type { KGSearchMode } from '@renderer/stores/kg-search/kg-search.types'

const kgStore = useKGSearchStore()
const modes = KG_SEARCH_MODES

const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const currentModeOption = computed(() => modes.find((m) => m.value === kgStore.mode))

function selectMode(mode: KGSearchMode) {
  kgStore.setMode(mode)
  showDropdown.value = false
}

function handleSubmit() {
  kgStore.executeSearch()
}

// 点击外部关闭下拉
function onClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
