<template>
  <div class="knowledge-view">
    <!-- List View Mode -->
    <template v-if="currentView === 'list'">
      <div class="page-header px-8 pt-8">
        <div>
          <h1 class="page-title">知识库管理</h1>
          <p class="page-subtitle">创建、配置和管理您的个人知识库集合。</p>
        </div>
        <div class="header-actions">
          <button class="action-btn primary" @click="showCreateDialog = true">
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
      <div class="kb-grid px-8 pb-8 overflow-y-auto flex-1">
        <!-- Create New Card -->
        <div class="glass-card kb-card create-card" @click="showCreateDialog = true">
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
        <div
          v-for="kb in knowledgeBases"
          :key="kb.id"
          class="glass-card kb-card"
          @click="handleEnterKb(kb)"
        >
          <div class="kb-header">
            <!-- 动态图标与颜色 -->
            <div
              class="kb-icon"
              :style="{
                background: getLightColor(kb.color),
                color: kb.color
              }"
              v-html="kb.icon"
            ></div>
            <button class="kb-more-btn" @click.stop>
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

      <!-- 新建知识库对话框 -->
      <CreateKnowledgeBaseDialog
        v-model:visible="showCreateDialog"
        @submit="handleCreateKnowledgeBase"
      />
    </template>

    <!-- Detail View Mode -->
    <KnowledgeDetail v-else-if="selectedKb" :kb="selectedKb" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CreateKnowledgeBaseDialog, {
  type KnowledgeBaseFormData
} from './CreateKnowledgeBaseDialog.vue'
import KnowledgeDetail from './KnowledgeDetail/index.vue'
import type { KnowledgeBase } from './types'

// Emits for breadcrumb management
const emit = defineEmits<{
  (e: 'enter-detail', kbName: string): void
  (e: 'leave-detail'): void
}>()

const showCreateDialog = ref(false)
const currentView = ref<'list' | 'detail'>('list')
const selectedKb = ref<KnowledgeBase | null>(null)

// 预设 SVG 字符串 (与 Dialog 中保持一致或简化，这里直接硬编码到 mock 数据中)
const icons = {
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
}

const knowledgeBases = ref<KnowledgeBase[]>([
  {
    id: 1,
    name: '产品文档库',
    description: '包含所有产品说明书、API 文档和技术规范。',
    docCount: 124,
    vectorCount: '12.5k',
    lastUpdated: '2 小时前',
    color: '#2563eb', // blue-600
    icon: icons.folder
  },
  {
    id: 2,
    name: '法律法规',
    description: '公司法务相关的合规文档、合同模板和法律条文。',
    docCount: 45,
    vectorCount: '4.2k',
    lastUpdated: '1 天前',
    color: '#7c3aed', // violet-600
    icon: icons.scale
  },
  {
    id: 3,
    name: '研发技术栈',
    description: '前端、后端、DevOps 相关的技术积累和最佳实践。',
    docCount: 312,
    vectorCount: '28.9k',
    lastUpdated: '3 天前',
    color: '#10b981', // emerald-500
    icon: icons.code
  },
  {
    id: 4,
    name: '市场调研',
    description: '2025 年度市场分析报告与竞品研究。',
    docCount: 89,
    vectorCount: '8.1k',
    lastUpdated: '1 周前',
    color: '#f59e0b', // amber-500
    icon: icons.chart
  }
])

const handleCreateKnowledgeBase = (data: KnowledgeBaseFormData) => {
  const newKB: KnowledgeBase = {
    id: Date.now(),
    name: data.name,
    description: data.description,
    docCount: 0,
    vectorCount: '0',
    lastUpdated: '刚刚',
    color: data.color,
    icon: data.icon
  }

  knowledgeBases.value.unshift(newKB)
}

const handleEnterKb = (kb: KnowledgeBase) => {
  selectedKb.value = kb
  currentView.value = 'detail'
  emit('enter-detail', kb.name)
}

const handleBack = () => {
  currentView.value = 'list'
  selectedKb.value = null
  emit('leave-detail')
}

// 辅助函数：生成浅色背景色 (Hex 转 RGBA)
const getLightColor = (hex: string) => {
  // 简单验证 hex 格式
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) return 'rgba(0,0,0,0.05)'

  let c = hex.substring(1).split('')
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]]
  }
  const r = parseInt(c[0] + c[1], 16)
  const g = parseInt(c[2] + c[3], 16)
  const b = parseInt(c[4] + c[5], 16)

  return `rgba(${r}, ${g}, ${b}, 0.1)`
}

// Expose handleBack for parent components to use when breadcrumb is clicked
defineExpose({
  handleBack
})
</script>

<style scoped>
@reference "tailwindcss";

.knowledge-view {
  @apply flex flex-col h-full overflow-hidden box-border;
  animation: fadeIn 500ms ease-out;
}

/* 所有其他样式已迁移到全局 tailwind.css 中的组件类 */
</style>
