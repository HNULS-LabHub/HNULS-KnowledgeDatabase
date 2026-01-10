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
.rag-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
  animation: fadeIn 500ms;
  overflow-y: auto;
  box-sizing: border-box;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.rag-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #94a3b8;
}

.page-subtitle {
  color: #64748b;
  margin: 0;
}

.badges {
  display: flex;
  gap: 0.5rem;
}

.badge {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.375rem;
  border: 1px solid;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.badge.indigo {
  background: #eef2ff;
  color: #4f46e5;
  border-color: #c7d2fe;
}

.badge.emerald {
  background: #ecfdf5;
  color: #10b981;
  border-color: #d1fae5;
}

.badge.small {
  padding: 0.125rem 0.5rem;
  font-size: 0.625rem;
}

.badge-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.rag-content {
  display: grid;
  grid-template-columns: 5fr 7fr;
  gap: 1.5rem;
  flex: 1;
  min-height: 500px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(48px);
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 1rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition: all 300ms;
}

.glass-card:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-color: rgba(199, 210, 254, 0.5);
}

.input-card {
  padding: 1.5rem;
}

.input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.label-icon {
  width: 1rem;
  height: 1rem;
  color: #94a3b8;
}

.input-wrapper {
  position: relative;
}

.query-input {
  width: 100%;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  padding-right: 3rem;
  color: #0f172a;
  outline: none;
  transition: all 300ms;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.query-input::placeholder {
  color: #94a3b8;
}

.query-input:focus {
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  background: white;
}

.submit-btn {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  padding: 0.375rem;
  background: #4f46e5;
  border-radius: 0.5rem;
  color: white;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: all 300ms;
  box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);
}

.input-wrapper:hover .submit-btn {
  opacity: 1;
}

.submit-btn:hover {
  background: #4338ca;
}

.submit-btn svg {
  width: 1rem;
  height: 1rem;
}

.steps-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: white;
  border: 1px solid #f1f5f9;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  animation: slideIn 300ms;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-1rem);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.step-icon {
  padding: 0.5rem;
  border-radius: 0.5rem;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.step-icon.blue {
  background: #eff6ff;
  color: #2563eb;
}

.step-icon.purple {
  background: #faf5ff;
  color: #7c3aed;
}

.step-icon.amber {
  background: #fffbeb;
  color: #f59e0b;
}

.step-icon.emerald {
  background: #ecfdf5;
  color: #10b981;
}

.step-content {
  flex: 1;
}

.step-text {
  color: #475569;
  font-size: 0.875rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
}

.progress-bar {
  height: 0.25rem;
  width: 100%;
  background: #f1f5f9;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  width: 100%;
  background: #4f46e5;
  animation: loading 1s ease-in-out infinite;
}

@keyframes loading {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(100%);
  }
}

.zap-icon {
  width: 1rem;
  height: 1rem;
  color: #f59e0b;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  border: 2px dashed #e2e8f0;
  background: rgba(248, 250, 252, 0.5);
  border-radius: 1rem;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.75rem;
  opacity: 0.2;
}

.empty-state p {
  font-weight: 500;
  margin: 0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #64748b;
  padding: 0 0.5rem;
}

.results-header span:first-child {
  font-weight: 500;
}

.time-badge {
  color: #10b981;
  font-family: monospace;
  font-weight: 700;
  background: #ecfdf5;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
}

.results-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.result-card {
  padding: 1.25rem;
  cursor: pointer;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.result-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.result-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
}

.result-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.result-title {
  color: #0f172a;
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0 0 0.125rem 0;
  transition: color 300ms;
}

.result-card:hover .result-title {
  color: #4f46e5;
}

.result-meta {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
  margin: 0;
}

.result-excerpt {
  color: #475569;
  font-size: 0.875rem;
  line-height: 1.5;
  border-left: 2px solid #e2e8f0;
  padding-left: 0.75rem;
  background: rgba(248, 250, 252, 0.5);
  padding: 0.5rem 0.75rem;
  border-radius: 0 0.5rem 0.5rem 0;
  margin: 0;
  transition: border-color 300ms;
}

.result-card:hover .result-excerpt {
  border-color: #a5b4fc;
}

.empty-results {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-results-content {
  text-align: center;
  position: relative;
}

.glow-effect {
  position: absolute;
  inset: 0;
  background: rgba(199, 210, 254, 0.3);
  filter: blur(3rem);
  border-radius: 9999px;
}

.database-icon {
  width: 6rem;
  height: 6rem;
  color: #e2e8f0;
  margin: 0 auto;
  position: relative;
  z-index: 10;
}

.empty-results-content p {
  margin-top: 1rem;
  color: #94a3b8;
  font-weight: 500;
}
</style>
