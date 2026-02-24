<template>
  <div class="kg-result-panel right-panel flex-1 flex flex-col min-h-0">
    <!-- 结果头 -->
    <div class="results-header">
      <span>图谱检索结果 ({{ kgStore.isSearching ? '...' : kgStore.hitCount }})</span>
      <span>
        耗时:
        <span class="time-badge">
          {{
            kgStore.isSearching
              ? '...'
              : kgStore.result?.elapsedMs != null
                ? kgStore.result.elapsedMs + 'ms'
                : '-'
          }}
        </span>
      </span>
    </div>

    <!-- 结果列表 -->
    <div class="results-list flex-1 min-h-0 overflow-y-auto">
      <template v-if="kgStore.hasResult">
        <div class="flex flex-col gap-3 p-1">
          <div
            v-for="hit in kgStore.result!.hits"
            :key="hit.node.id"
            class="glass-card result-card"
          >
            <!-- 节点头部 -->
            <div class="result-header">
              <div class="result-info">
                <div class="result-icon !w-8 !h-8" :class="nodeTypeColor(hit.node.type)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path :d="nodeTypeIcon(hit.node.type)"></path>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="result-title truncate">{{ hit.node.label }}</h4>
                  <p class="result-meta">
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600"
                    >
                      {{ hit.node.type }}
                    </span>
                    <span class="ml-2 text-amber-600 font-semibold"
                      >Score {{ hit.score.toFixed(2) }}</span
                    >
                    <span class="ml-2 text-slate-400"
                      >{{ hit.edges.length }} 条关系 · {{ hit.neighbors.length }} 个邻居</span
                    >
                  </p>
                </div>
              </div>
            </div>

            <!-- 高亮片段 -->
            <p
              v-if="hit.highlight"
              class="result-excerpt text-sm text-slate-600 mt-2"
              v-html="hit.highlight"
            ></p>

            <!-- 关系列表 -->
            <div v-if="hit.edges.length > 0" class="mt-3 flex flex-wrap gap-1.5">
              <span
                v-for="edge in hit.edges"
                :key="edge.id"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-indigo-50 text-indigo-600 border border-indigo-100"
              >
                <svg
                  class="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
                {{ edge.relation }}
                <span class="text-indigo-400">→</span>
                {{ getNeighborLabel(hit, edge.to) }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
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
          <p>{{ kgStore.isSearching ? '正在检索图谱...' : '输入检索词开始知识图谱检索' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useKGSearchStore } from '@renderer/stores/kg-search/kg-search.store'
import type { KGSearchHit } from '@renderer/stores/kg-search/kg-search.types'

const kgStore = useKGSearchStore()

function nodeTypeIcon(type: string): string {
  switch (type) {
    case 'concept':
      return 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
    case 'document':
      return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6'
    case 'person':
      return 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
    default:
      return 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5'
  }
}

function nodeTypeColor(type: string): string {
  switch (type) {
    case 'concept':
      return '!bg-amber-50 !text-amber-500'
    case 'document':
      return '!bg-blue-50 !text-blue-500'
    case 'person':
      return '!bg-emerald-50 !text-emerald-500'
    default:
      return ''
  }
}

function getNeighborLabel(hit: KGSearchHit, nodeId: string): string {
  const neighbor = hit.neighbors.find((n) => n.id === nodeId)
  return neighbor?.label ?? nodeId
}
</script>
