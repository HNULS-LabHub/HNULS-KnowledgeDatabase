<template>
  <div class="rag-view">
    <div class="rag-header">
      <div>
        <h2 class="page-title">
          <svg
            class="title-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          检索增强生成 (RAG)
        </h2>
        <p class="page-subtitle">实时调试向量检索与上下文召回。</p>
      </div>
      <div class="badges">
        <span class="badge indigo">
          <svg
            class="badge-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Hybrid Search
        </span>
        <span class="badge emerald">
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
          Cohere Rerank
        </span>
      </div>
    </div>

    <div class="rag-content">
      <!-- Left: Input & Process -->
      <div class="left-panel">
        <div class="glass-card input-card">
          <form @submit.prevent="simulateSearch">
            <label class="input-label">
              <svg
                class="label-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="9 10 4 15 9 20"></polyline>
                <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
              </svg>
              测试查询
            </label>
            <div class="input-wrapper">
              <input
                type="text"
                v-model="query"
                placeholder="例如：如何配置 Graph RAG 的节点权重？"
                class="query-input"
              />
              <button type="submit" class="submit-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </form>
        </div>

        <div class="steps-container">
          <div v-for="(step, idx) in steps" :key="step.id" class="step-item">
            <div :class="['step-icon', step.colorClass]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                v-html="step.iconPath"
              ></svg>
            </div>
            <div class="step-content">
              <p class="step-text">{{ step.text }}</p>
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
            </div>
            <svg
              v-if="idx === steps.length - 1 && isSearching"
              class="zap-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <div v-if="steps.length === 0 && !isSearching" class="empty-state">
            <svg
              class="empty-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <p>输入查询以开始检索模拟</p>
          </div>
        </div>
      </div>

      <!-- Right: Results -->
      <div class="right-panel">
        <div class="results-header">
          <span>召回结果 (Top 3)</span>
          <span
            >耗时:
            <span class="time-badge">{{
              isSearching ? '...' : steps.length >= 4 ? '124ms' : '-'
            }}</span></span
          >
        </div>

        <div class="results-list">
          <div
            v-if="steps.length >= 4"
            v-for="item in 3"
            :key="item"
            class="glass-card result-card"
          >
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const query = ref('')
const isSearching = ref(false)
const steps = ref<any[]>([])

const simulateSearch = () => {
  if (!query.value) return
  isSearching.value = true
  steps.value = []

  const timeline = [
    {
      id: 1,
      text: '正在向量化查询语句...',
      iconPath:
        '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect>',
      colorClass: 'blue'
    },
    {
      id: 2,
      text: '在 128 维空间中检索相似块...',
      iconPath: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>',
      colorClass: 'purple'
    },
    {
      id: 3,
      text: '重排序 (Re-ranking) Top-K 结果...',
      iconPath:
        '<path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
      colorClass: 'amber'
    },
    {
      id: 4,
      text: '上下文组装完成',
      iconPath:
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline>',
      colorClass: 'emerald'
    }
  ]

  timeline.forEach((step, index) => {
    setTimeout(
      () => {
        steps.value.push(step)
        if (index === timeline.length - 1) isSearching.value = false
      },
      (index + 1) * 800
    )
  })
}
</script>

<style scoped>
/* 所有样式已迁移到全局 tailwind.css 中的组件类 */
</style>
