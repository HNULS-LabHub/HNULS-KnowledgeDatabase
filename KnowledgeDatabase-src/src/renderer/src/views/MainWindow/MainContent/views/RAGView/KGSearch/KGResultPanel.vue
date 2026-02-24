<template>
  <div class="kg-result-panel flex-1 flex flex-col min-h-0">
    <!-- 错误提示 -->
    <div
      v-if="kgStore.error"
      class="mx-2 mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2 flex-shrink-0"
    >
      <svg
        class="w-4 h-4 flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      <span>{{ kgStore.error }}</span>
    </div>

    <!-- Meta 栏 -->
    <div v-if="kgStore.hasResult" class="results-header mb-2">
      <div class="flex items-center gap-3">
        <span class="text-xs px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 font-medium">
          {{ kgStore.result!.meta.mode }}
        </span>
        <span>命中 {{ kgStore.totalCount }} 条</span>
        <span>
          耗时
          <span class="text-amber-600 font-medium">{{ kgStore.result!.meta.durationMs }}ms</span>
        </span>
        <span
          v-if="kgStore.result!.meta.rerankApplied"
          class="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600"
        >
          Reranked
        </span>
      </div>
      <!-- 提取的关键词 -->
      <div v-if="hasKeywords" class="flex items-center gap-1 flex-wrap">
        <span class="text-slate-400 text-[10px]">Keywords:</span>
        <span
          v-for="kw in allKeywords"
          :key="kw"
          class="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-500"
          >{{ kw }}</span
        >
      </div>
    </div>

    <!-- Tab 切换 -->
    <div v-if="kgStore.hasResult" class="flex items-center gap-1 px-2 mb-2 flex-shrink-0">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-3 py-1 rounded-md text-xs font-medium transition-colors"
        :class="
          kgStore.activeResultTab === tab.key
            ? 'bg-teal-50 text-teal-700 border border-teal-200'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-transparent'
        "
        @click="kgStore.setResultTab(tab.key)"
      >
        {{ tab.label }} ({{ tab.count }})
      </button>
    </div>

    <!-- 结果列表 -->
    <div class="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
      <template v-if="kgStore.hasResult">
        <!-- 实体 Tab -->
        <div v-if="kgStore.activeResultTab === 'entities'" class="flex flex-col gap-2">
          <div
            v-for="entity in kgStore.result!.entities"
            :key="entity.id"
            class="glass-card p-3 !rounded-xl"
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                class="text-xs px-1.5 py-0.5 rounded font-medium"
                :class="entityTypeClass(entity.entity_type)"
              >
                {{ entity.entity_type }}
              </span>
              <span class="text-sm font-medium text-slate-800 truncate">{{ entity.name }}</span>
              <span class="ml-auto text-xs text-amber-600 font-medium flex-shrink-0">
                {{ entity.score.toFixed(3) }}
              </span>
            </div>
            <p v-if="entity.description" class="text-xs text-slate-500 line-clamp-3 m-0">
              {{ entity.description }}
            </p>
          </div>
          <div
            v-if="kgStore.result!.entities.length === 0"
            class="text-center text-xs text-slate-400 py-8"
          >
            无实体结果
          </div>
        </div>

        <!-- 关系 Tab -->
        <div v-if="kgStore.activeResultTab === 'relations'" class="flex flex-col gap-2">
          <div
            v-for="rel in kgStore.result!.relations"
            :key="rel.id"
            class="glass-card p-3 !rounded-xl"
          >
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <span class="text-sm font-medium text-indigo-700">{{ rel.source_name }}</span>
              <svg
                class="w-4 h-4 text-slate-300 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
              <span class="text-sm font-medium text-indigo-700">{{ rel.target_name }}</span>
              <span class="ml-auto text-xs text-amber-600 font-medium flex-shrink-0">
                {{ rel.score.toFixed(3) }}
              </span>
            </div>
            <div v-if="rel.keywords" class="flex items-center gap-1 mb-1 flex-wrap">
              <span
                v-for="kw in rel.keywords
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)"
                :key="kw"
                class="text-[10px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-500"
                >{{ kw }}</span
              >
            </div>
            <p v-if="rel.description" class="text-xs text-slate-500 line-clamp-3 m-0">
              {{ rel.description }}
            </p>
          </div>
          <div
            v-if="kgStore.result!.relations.length === 0"
            class="text-center text-xs text-slate-400 py-8"
          >
            无关系结果
          </div>
        </div>

        <!-- Chunks Tab -->
        <div v-if="kgStore.activeResultTab === 'chunks'" class="flex flex-col gap-2">
          <div
            v-for="chunk in kgStore.result!.chunks"
            :key="chunk.id"
            class="glass-card p-3 !rounded-xl"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <span
                class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                :class="chunkSourceClass(chunk.source)"
              >
                {{ chunkSourceLabel(chunk.source) }}
              </span>
              <span v-if="chunk.file_name" class="text-xs text-slate-500 truncate">
                {{ chunk.file_name }}
              </span>
              <span v-if="chunk.chunk_index != null" class="text-[10px] text-slate-400">
                #{{ chunk.chunk_index }}
              </span>
              <span class="ml-auto text-xs text-amber-600 font-medium flex-shrink-0">
                {{ chunk.score.toFixed(3) }}
              </span>
            </div>
            <p class="text-xs text-slate-600 leading-relaxed line-clamp-5 m-0 whitespace-pre-wrap">
              {{ chunk.content }}
            </p>
          </div>
          <div
            v-if="kgStore.result!.chunks.length === 0"
            class="text-center text-xs text-slate-400 py-8"
          >
            无文本块结果（请确认已传入 chunkTableName）
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else class="flex flex-col items-center justify-center h-full text-slate-400">
        <svg
          class="w-12 h-12 mb-3 opacity-30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
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
        <p class="text-sm">
          {{ kgStore.isSearching ? '正在检索图谱...' : '选择知识库和图谱配置，输入检索词开始' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useKGSearchStore } from '@renderer/stores/kg-search/kg-search.store'
import type { KGResultTab } from '@renderer/stores/kg-search/kg-search.types'

const kgStore = useKGSearchStore()

const tabs = computed<{ key: KGResultTab; label: string; count: number }[]>(() => [
  { key: 'entities', label: '实体', count: kgStore.entityCount },
  { key: 'relations', label: '关系', count: kgStore.relationCount },
  { key: 'chunks', label: '文本块', count: kgStore.chunkCount }
])

const hasKeywords = computed(() => {
  if (!kgStore.result) return false
  const kw = kgStore.result.meta.extractedKeywords
  return kw.highLevel.length > 0 || kw.lowLevel.length > 0
})

const allKeywords = computed(() => {
  if (!kgStore.result) return []
  const kw = kgStore.result.meta.extractedKeywords
  return [...kw.highLevel, ...kw.lowLevel]
})

function entityTypeClass(type: string): string {
  switch (type.toLowerCase()) {
    case 'concept':
      return 'bg-amber-50 text-amber-600'
    case 'person':
      return 'bg-emerald-50 text-emerald-600'
    case 'organization':
      return 'bg-blue-50 text-blue-600'
    case 'location':
      return 'bg-rose-50 text-rose-600'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function chunkSourceClass(source: string): string {
  switch (source) {
    case 'entity_expansion':
      return 'bg-amber-50 text-amber-600'
    case 'relation_expansion':
      return 'bg-indigo-50 text-indigo-600'
    case 'direct_vector':
      return 'bg-teal-50 text-teal-600'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

function chunkSourceLabel(source: string): string {
  switch (source) {
    case 'entity_expansion':
      return '实体扩展'
    case 'relation_expansion':
      return '关系扩展'
    case 'direct_vector':
      return '向量直检'
    default:
      return source
  }
}
</script>
