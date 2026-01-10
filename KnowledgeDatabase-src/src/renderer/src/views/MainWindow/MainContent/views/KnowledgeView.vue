<template>
  <div class="knowledge-view">
    <div class="page-header">
      <div>
        <h1 class="page-title">知识库管理</h1>
        <p class="page-subtitle">创建、配置和管理您的个人知识库集合。</p>
      </div>
      <div class="header-actions">
        <button class="action-btn primary">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="btn-icon"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          新建知识库
        </button>
      </div>
    </div>

    <!-- Knowledge Base Grid -->
    <div class="kb-grid">
      <!-- Create New Card (Optional, purely visual for now) -->
      <div class="glass-card kb-card create-card">
        <div class="create-content">
          <div class="create-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
          <span class="create-text">新建知识库</span>
        </div>
      </div>

      <!-- Example Cards -->
      <div v-for="kb in knowledgeBases" :key="kb.id" class="glass-card kb-card">
        <div class="kb-header">
          <div class="kb-icon" :class="kb.color">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>
          <button class="kb-more-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
        
        <div class="kb-info">
          <h3 class="kb-name">{{ kb.name }}</h3>
          <p class="kb-desc">{{ kb.description }}</p>
        </div>

        <div class="kb-stats">
          <div class="stat-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
            <span>{{ kb.docCount }} 文档</span>
          </div>
          <div class="stat-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span>{{ kb.vectorCount }} 向量</span>
          </div>
        </div>
        
        <div class="kb-footer">
          <span class="update-time">更新于 {{ kb.lastUpdated }}</span>
          <button class="enter-btn">进入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const knowledgeBases = ref([
  {
    id: 1,
    name: '产品文档库',
    description: '包含所有产品说明书、API 文档和技术规范。',
    docCount: 124,
    vectorCount: '12.5k',
    lastUpdated: '2 小时前',
    color: 'blue'
  },
  {
    id: 2,
    name: '法律法规',
    description: '公司法务相关的合规文档、合同模板和法律条文。',
    docCount: 45,
    vectorCount: '4.2k',
    lastUpdated: '1 天前',
    color: 'purple'
  },
  {
    id: 3,
    name: '研发技术栈',
    description: '前端、后端、DevOps 相关的技术积累和最佳实践。',
    docCount: 312,
    vectorCount: '28.9k',
    lastUpdated: '3 天前',
    color: 'emerald'
  },
  {
    id: 4,
    name: '市场调研',
    description: '2025 年度市场分析报告与竞品研究。',
    docCount: 89,
    vectorCount: '8.1k',
    lastUpdated: '1 周前',
    color: 'amber'
  }
])
</script>

<style scoped>
.knowledge-view {
  padding: 2rem;
  animation: fadeIn 500ms;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(1rem); }
  to { opacity: 1; transform: translateY(0); }
}

/* Header Styles (Consistent with Dashboard) */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

.page-subtitle {
  color: #64748b;
  margin: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 300ms;
  border: none;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

.action-btn.primary {
  background: #0f172a;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.2);
}

.action-btn.primary:hover {
  background: #1e293b;
  box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.3);
}

/* Grid Layout */
.kb-grid {
  display: grid;
  /* Responsive grid: min 240px width per card */
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

/* Card Styles */
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(48px);
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 1rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition: all 300ms;
  display: flex;
  flex-direction: column;
}

.glass-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border-color: rgba(199, 210, 254, 0.5);
  transform: translateY(-2px);
}

.kb-card {
  padding: 1rem;
  height: 100%;
  min-height: 180px;
  box-sizing: border-box;
}

/* Create New Card Special Styles */
.create-card {
  border: 2px dashed #e2e8f0;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.create-card:hover {
  border-color: #4f46e5;
  background: rgba(255, 255, 255, 0.8);
}

.create-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #64748b;
  transition: all 300ms;
}

.create-card:hover .create-content {
  color: #4f46e5;
}

.create-icon {
  width: 2.5rem;
  height: 2.5rem;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.create-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.create-text {
  font-weight: 500;
}

/* KB Card Content */
.kb-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.kb-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kb-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* Icon Colors */
.kb-icon.blue { background: #eff6ff; color: #2563eb; }
.kb-icon.purple { background: #faf5ff; color: #7c3aed; }
.kb-icon.emerald { background: #ecfdf5; color: #10b981; }
.kb-icon.amber { background: #fffbeb; color: #f59e0b; }

.kb-more-btn {
  padding: 0.5rem;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 200ms;
}

.kb-more-btn:hover {
  color: #475569;
  background: #f1f5f9;
}

.kb-more-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.kb-info {
  margin-bottom: 1rem;
  flex: 1;
}

.kb-name {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.375rem 0;
}

.kb-desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-stats {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}

.stat-item svg {
  width: 1rem;
  height: 1rem;
}

.kb-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.update-time {
  font-size: 0.75rem;
  color: #94a3b8;
}

.enter-btn {
  padding: 0.375rem 0.75rem;
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms;
}

.enter-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}
</style>