<template>
  <div class="kb-rag-results right-panel">
    <!-- Tab 切换（仅在 LLM 驱动开启时显示） -->
    <div v-if="showAgentTab" class="flex items-center px-4 py-0 border-b border-gray-200 bg-white">
      <button
        class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent transition-all"
        :class="
          activeTab === 'results'
            ? 'text-blue-600 border-blue-600 bg-blue-50'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        "
        @click="activeTab = 'results'"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        检索结果
      </button>
      <button
        class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 border-transparent transition-all"
        :class="
          activeTab === 'agent'
            ? 'text-blue-600 border-blue-600 bg-blue-50'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        "
        @click="activeTab = 'agent'"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
          ></path>
        </svg>
        Agent 流程
      </button>
    </div>

    <!-- 原有的检索结果面板 -->
    <div v-show="!showAgentTab || activeTab === 'results'" class="results-header">
      <span>召回结果 ({{ hasCompleted ? results.length : '...' }})</span>
      <span>
        耗时:
        <span class="time-badge">
          {{ isSearching ? '...' : searchElapsedMs != null ? searchElapsedMs + 'ms' : '-' }}
        </span>
      </span>
    </div>

    <div v-show="!showAgentTab || activeTab === 'results'" class="results-list">
      <template v-if="hasCompleted && results.length > 0">
        <!-- 横向栏布局：等分容器宽度 -->
        <div class="flex gap-3 h-full">
          <div
            v-for="group in groupedResults"
            :key="group.tableName"
            class="flex-1 min-w-0 flex flex-col gap-2"
          >
            <!-- 表头 -->
            <div
              class="flex-shrink-0 px-3 py-2 rounded-lg border border-slate-200 bg-white/80 backdrop-blur-sm"
            >
              <div class="flex items-center gap-2">
                <svg
                  class="w-3.5 h-3.5 text-indigo-500 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold text-slate-700 truncate">
                    {{ group.configName || '未知模型' }}
                  </div>
                  <div class="text-[10px] text-slate-400">
                    {{ group.dimensions }}维 · {{ group.hits.length }} 条
                  </div>
                </div>
              </div>
            </div>

            <!-- 该表的召回结果（垂直滚动） -->
            <div class="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1">
              <div
                v-for="(hit, idx) in group.hits"
                :key="hit.id"
                class="glass-card result-card flex-shrink-0"
              >
                <div class="result-header">
                  <div class="result-info">
                    <div class="result-icon !w-8 !h-8">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14,2 14,8 20,8"></polyline>
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="result-title truncate" :title="hit.file_name">
                        {{ hit.file_name || '未知文件' }}
                      </h4>
                      <p class="result-meta truncate">
                        #{{ idx + 1 }}
                        <template v-if="hit.chunk_index != null">
                          · Chunk {{ hit.chunk_index }}</template
                        >
                        <template v-if="hit.rerank_score != null">
                          ·
                          <span class="text-amber-600 font-semibold"
                            >Rerank {{ hit.rerank_score.toFixed(4) }}</span
                          ></template
                        >
                        <template v-if="hit.distance != null">
                          · Dist {{ hit.distance.toFixed(4) }}</template
                        >
                      </p>
                    </div>
                  </div>
                </div>
                <p class="result-excerpt">
                  {{ truncate(hit.content, 150) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="empty-results">
        <div class="empty-results-content">
          <div class="glow-effect"></div>
          <svg
            class="database-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
          <p>{{ hasCompleted ? '未召回结果' : '等待数据召回...' }}</p>
        </div>
      </div>
    </div>

    <!-- Agent 流程面板 -->
    <div v-if="showAgentTab && activeTab === 'agent'" class="flex-1 overflow-hidden">
      <AgentRunPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRagStore } from '@renderer/stores/rag/rag.store'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import type { VectorRecallHit } from '@renderer/stores/rag/rag.types'
import AgentRunPanel from './AgentKit/AgentRunPanel.vue'

const props = defineProps<{
  isSearching: boolean
  hasCompleted: boolean
  results: VectorRecallHit[]
  searchElapsedMs: number | null
}>()

const ragStore = useRagStore()
const agentStore = useAgentStore()

// 当前活跃 Tab
const activeTab = ref<'results' | 'agent'>('results')

// 是否显示 Agent Tab（仅在 LLM 驱动开启时）
const showAgentTab = computed(() => {
  return ragStore.llmDrivenEnabled
})

// 当 Agent 开始运行时，自动切换到 Agent Tab
watch(
  () => agentStore.currentRunId,
  (newRunId) => {
    if (newRunId && showAgentTab.value) {
      activeTab.value = 'agent'
    }
  }
)

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

// 按 tableName 分组
const groupedResults = computed(() => {
  const groups = new Map<
    string,
    { tableName: string; configName?: string; dimensions?: number; hits: VectorRecallHit[] }
  >()

  for (const hit of props.results) {
    const key = hit.tableName
    if (!groups.has(key)) {
      groups.set(key, {
        tableName: key,
        configName: hit.configName,
        dimensions: hit.dimensions,
        hits: []
      })
    }
    groups.get(key)!.hits.push(hit)
  }

  // 转成数组供 Vue v-for 遍历
  return Array.from(groups.values())
})
</script>
