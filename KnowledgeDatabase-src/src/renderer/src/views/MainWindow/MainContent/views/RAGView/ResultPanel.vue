<template>
  <div class="kb-rag-results right-panel">
    <div class="results-header">
      <span>召回结果 ({{ hasCompleted ? results.length : '...' }})</span>
      <span>
        耗时:
        <span class="time-badge">
          {{ isSearching ? '...' : searchElapsedMs != null ? searchElapsedMs + 'ms' : '-' }}
        </span>
      </span>
    </div>

    <div class="results-list">
      <template v-if="hasCompleted && results.length > 0">
        <!-- 按嵌入表分组显示 -->
        <div v-for="group in groupedResults" :key="group.tableName" class="mb-4">
          <!-- 表头信息 -->
          <div class="flex items-center gap-2 mb-2 px-1">
            <div class="flex items-center gap-2 flex-1">
              <svg
                class="w-3.5 h-3.5 text-indigo-500"
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
              <span class="text-xs font-semibold text-slate-700">
                {{ group.configName || '未知模型' }}
              </span>
              <span class="text-[10px] text-slate-400">
                {{ group.dimensions }}维 · {{ group.hits.length }} 条
              </span>
            </div>
          </div>

          <!-- 该表的召回结果 -->
          <div class="flex flex-col gap-2">
            <div v-for="(hit, idx) in group.hits" :key="hit.id" class="glass-card result-card">
              <div class="result-header">
                <div class="result-info">
                  <div class="result-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                    </svg>
                  </div>
                  <div>
                    <h4 class="result-title">{{ hit.file_name || '未知文件' }}</h4>
                    <p class="result-meta">
                      #{{ idx + 1 }}
                      <template v-if="hit.chunk_index != null"> · Chunk {{ hit.chunk_index }}</template>
                      <template v-if="hit.distance != null"> · Distance: {{ hit.distance.toFixed(4) }}</template>
                    </p>
                  </div>
                </div>
                <span class="badge emerald small">
                  <svg
                    class="badge-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    ></path>
                  </svg>
                  Match
                </span>
              </div>
              <p class="result-excerpt">
                {{ truncate(hit.content, 200) }}
              </p>
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { VectorRecallHit } from '@renderer/stores/rag/rag.types'

const props = defineProps<{
  isSearching: boolean
  hasCompleted: boolean
  results: VectorRecallHit[]
  searchElapsedMs: number | null
}>()

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
