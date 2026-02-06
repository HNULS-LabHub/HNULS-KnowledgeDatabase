<template>
  <div class="kb-rag-results right-panel">
    <div class="results-header">
      <span>召回结果 (Top 3)</span>
      <span>
        耗时:
        <span class="time-badge">{{ isSearching ? '...' : hasCompleted ? '124ms' : '-' }}</span>
      </span>
    </div>

    <div class="results-list">
      <template v-if="hasCompleted">
        <div v-for="item in 3" :key="item" class="glass-card result-card">
          <div class="result-header">
            <div class="result-info">
              <div class="result-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                </svg>
              </div>
              <div>
                <h4 class="result-title">Technical_Spec_v2.pdf</h4>
                <p class="result-meta">Page {{ item * 12 }} • Similarity: 0.{{ 98 - item }}</p>
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
            ...在这种情况下，Graph RAG
            利用图遍历算法优先识别核心实体节点，随后通过边缘权重计算（Edge Weight
            Calculation）来扩展上下文窗口，从而避免了传统向量检索中的信息孤岛问题...
          </p>
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
          <p>等待数据召回...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isSearching: boolean
  hasCompleted: boolean
}>()
</script>
