<template>
  <div class="kg-query-bar flex items-center gap-2 flex-1">
    <!-- 知识库选择 -->
    <div class="relative" ref="kbDropRef">
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors max-w-[140px]"
        @click="showKbDrop = !showKbDrop"
      >
        <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <span class="text-slate-700 truncate">{{ selectedKbLabel }}</span>
        <svg class="w-3 h-3 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div
        v-if="showKbDrop"
        class="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto"
      >
        <button
          v-for="kb in kbStore.knowledgeBases"
          :key="kb.id"
          class="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors"
          :class="{ 'bg-indigo-50': kb.id === kgStore.selectedKbId }"
          @click="selectKb(kb.id)"
        >
          <span class="truncate" :class="kb.id === kgStore.selectedKbId ? 'text-indigo-700 font-medium' : 'text-slate-700'">
            {{ kb.name }}
          </span>
        </button>
        <div v-if="kbStore.knowledgeBases.length === 0" class="px-3 py-2 text-xs text-slate-400">
          暂无知识库
        </div>
      </div>
    </div>

    <!-- KG 配置选择 -->
    <div class="relative" ref="kgCfgDropRef">
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors max-w-[160px]"
        :class="{ 'opacity-50 cursor-not-allowed': !kgStore.selectedKbId }"
        :disabled="!kgStore.selectedKbId"
        @click="kgStore.selectedKbId && (showKgCfgDrop = !showKgCfgDrop)"
      >
        <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2v4"></path><path d="M12 18v4"></path>
          <path d="m4.93 4.93 2.83 2.83"></path><path d="m16.24 16.24 2.83 2.83"></path>
          <path d="M2 12h4"></path><path d="M18 12h4"></path>
        </svg>
        <span class="text-slate-700 truncate">{{ selectedKgCfgLabel }}</span>
        <svg class="w-3 h-3 text-slate-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div
        v-if="showKgCfgDrop"
        class="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto"
      >
        <button
          v-for="cfg in kgStore.availableKgConfigs"
          :key="cfg.id"
          class="w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
          :class="{ 'bg-teal-50': cfg.id === kgStore.selectedKgConfigId }"
          @click="selectKgCfg(cfg.id)"
        >
          <span class="text-xs" :class="cfg.id === kgStore.selectedKgConfigId ? 'text-teal-700 font-medium' : 'text-slate-700'">
            {{ cfg.name }}
          </span>
          <span class="text-[10px] text-slate-400">{{ cfg.graphTableBase }}</span>
        </button>
        <div v-if="kgStore.availableKgConfigs.length === 0" class="px-3 py-2 text-xs text-slate-400">
          无可用图谱配置
        </div>
      </div>
    </div>

    <!-- 模式选择 -->
    <div class="relative" ref="modeDropRef">
      <button
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
        @click="showModeDrop = !showModeDrop"
      >
        <span class="text-slate-700">{{ currentModeOption?.label ?? '模式' }}</span>
        <svg class="w-3 h-3 text-slate-400 transition-transform" :class="{ 'rotate-180': showModeDrop }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <div
        v-if="showModeDrop"
        class="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
      >
        <button
          v-for="opt in MODES"
          :key="opt.value"
          class="w-full flex flex-col gap-0.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
          :class="{ 'bg-teal-50': opt.value === kgStore.mode }"
          @click="selectMode(opt.value)"
        >
          <span class="text-xs font-medium" :class="opt.value === kgStore.mode ? 'text-teal-700' : 'text-slate-700'">
            {{ opt.label }}
          </span>
          <span class="text-[10px] text-slate-400">{{ opt.description }}</span>
        </button>
      </div>
    </div>

    <!-- 搜索输入 -->
    <form class="flex-1 relative" @submit.prevent="handleSubmit">
      <input
        v-model="kgStore.query"
        type="text"
        :placeholder="kgStore.validationHint ?? '输入检索词...'"
        class="query-input !py-1.5 !rounded-lg !text-sm"
        :disabled="kgStore.isSearching"
      />
      <button
        type="submit"
        class="submit-btn !opacity-100 !top-0.5 !right-0.5"
        :disabled="!kgStore.canSearch"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    </form>

    <!-- 高级参数折叠按钮 -->
    <button
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-50"
      @click="kgStore.advancedExpanded = !kgStore.advancedExpanded"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useKGSearchStore } from '@renderer/stores/kg-search/kg-search.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import type { KGRetrievalMode, KGSearchModeOption } from '@renderer/stores/kg-search/kg-search.types'

const kgStore = useKGSearchStore()
const kbStore = useKnowledgeLibraryStore()

const MODES: KGSearchModeOption[] = [
  { value: 'local', label: '局部检索', description: '关键词向量匹配 + 图扩展', icon: '' },
  { value: 'global', label: '全局检索', description: '高层关键词，全局视角检索', icon: '' },
  { value: 'hybrid', label: '混合检索', description: 'Local + Global 合并去重', icon: '' },
  { value: 'naive', label: '朴素向量', description: '直接 chunk 向量 KNN', icon: '' }
]

const showKbDrop = ref(false)
const showKgCfgDrop = ref(false)
const showModeDrop = ref(false)
const kbDropRef = ref<HTMLElement | null>(null)
const kgCfgDropRef = ref<HTMLElement | null>(null)
const modeDropRef = ref<HTMLElement | null>(null)

const currentModeOption = computed(() => MODES.find((m) => m.value === kgStore.mode))
const selectedKbLabel = computed(() => kgStore.selectedKb?.name ?? '选择知识库')
const selectedKgCfgLabel = computed(() => kgStore.selectedKgConfig?.name ?? '选择图谱配置')

function selectKb(id: number) {
  kgStore.setKb(id)
  showKbDrop.value = false
}

function selectKgCfg(id: string) {
  kgStore.setKgConfig(id)
  showKgCfgDrop.value = false
}

function selectMode(m: KGRetrievalMode) {
  kgStore.setMode(m)
  showModeDrop.value = false
}

function handleSubmit() {
  kgStore.executeSearch()
}

function onClickOutside(e: MouseEvent) {
  const t = e.target as Node
  if (kbDropRef.value && !kbDropRef.value.contains(t)) showKbDrop.value = false
  if (kgCfgDropRef.value && !kgCfgDropRef.value.contains(t)) showKgCfgDrop.value = false
  if (modeDropRef.value && !modeDropRef.value.contains(t)) showModeDrop.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>
