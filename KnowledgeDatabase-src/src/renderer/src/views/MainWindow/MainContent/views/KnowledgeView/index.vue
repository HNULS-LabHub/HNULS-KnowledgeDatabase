<template>
  <div
    class="flex flex-col h-full overflow-hidden box-border"
    style="animation: fadeIn 500ms ease-out"
  >
    <!-- List View Mode -->
    <template v-if="currentView === 'list'">
      <!-- Page Header -->
      <div class="flex justify-between items-end mb-8 flex-shrink-0 px-8 pt-8">
        <div>
          <h1 class="text-3xl font-bold text-slate-900 m-0 mb-2">知识库管理</h1>
          <p class="text-slate-500 m-0">创建、配置和管理您的个人知识库集合。</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-300 border-none bg-slate-900 text-white shadow-md hover:bg-slate-800 hover:shadow-lg"
            @click="showCreateDialog = true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="w-4 h-4"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            新建知识库
          </button>
        </div>
      </div>

      <!-- Knowledge Base Grid -->
      <div class="flex-1 overflow-y-auto px-8 pb-8">
        <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 content-start">
          <!-- Create New Card -->
          <div
            class="create-card flex flex-col items-center justify-center cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 transition-all duration-300 p-4 min-h-[180px] box-border"
            style="background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(48px)"
            @click="showCreateDialog = true"
          >
            <div
              class="flex flex-col items-center gap-4 text-slate-500 transition-colors duration-300"
            >
              <div
                class="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="w-5 h-5"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </div>
              <span class="font-medium">新建知识库</span>
            </div>
          </div>

          <!-- Knowledge Base Cards -->
          <div
            v-for="kb in knowledgeBases"
            :key="kb.id"
            class="kb-card flex flex-col cursor-pointer rounded-2xl border transition-all duration-300 p-4 min-h-[180px] box-border flex-shrink-0"
            style="
              background: rgba(255, 255, 255, 0.7);
              backdrop-filter: blur(48px);
              border-color: rgba(226, 232, 240, 0.6);
              box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            "
            @click="handleEnterKb(kb)"
          >
            <!-- KB Header -->
            <div class="flex justify-between items-start mb-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                :style="{
                  background: getLightColor(kb.color),
                  color: kb.color
                }"
                v-html="kb.icon"
              ></div>
              <KnowledgeBaseMenu
                :kb-id="kb.id"
                :kb-name="kb.name"
                @delete="handleDeleteKnowledgeBase"
              />
            </div>

            <!-- KB Info -->
            <div class="mb-4 flex-1 min-h-0">
              <h3 class="text-base font-semibold text-slate-900 m-0 mb-1.5 line-clamp-1">
                {{ kb.name }}
              </h3>
              <p class="text-sm text-slate-500 m-0 leading-6 line-clamp-2">{{ kb.description }}</p>
            </div>

            <!-- KB Stats -->
            <div class="flex gap-3 mb-4 pb-3 border-b border-slate-100 flex-shrink-0">
              <div class="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="w-4 h-4 flex-shrink-0"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                </svg>
                <span class="whitespace-nowrap">{{ kb.docCount }} 文档</span>
              </div>
              <div class="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="w-4 h-4 flex-shrink-0"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                <span class="whitespace-nowrap">{{ kb.chunkCount }} 分片</span>
              </div>
            </div>

            <!-- KB Footer -->
            <div class="flex justify-between items-center flex-shrink-0">
              <span class="text-xs text-slate-400 whitespace-nowrap"
                >更新于 {{ formatLastUpdated(kb.lastUpdated) }}</span
              >
              <button
                class="px-3 py-1.5 bg-slate-100 text-slate-600 border-none rounded text-xs font-semibold cursor-pointer transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 flex-shrink-0"
              >
                进入
              </button>
            </div>
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
    <KnowledgeDetail 
      v-else-if="selectedKb" 
      ref="detailRef"
      :kb="selectedKb" 
      @enter-embedding-detail="handleEnterEmbeddingDetail"
      @leave-embedding-detail="handleLeaveEmbeddingDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import CreateKnowledgeBaseDialog, {
  type KnowledgeBaseFormData
} from './CreateKnowledgeBaseDialog.vue'
import KnowledgeDetail from './KnowledgeDetail/index.vue'
import KnowledgeBaseMenu from './KnowledgeBaseMenu.vue'
import type { KnowledgeBase } from './types'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'

// Emits for breadcrumb management
const emit = defineEmits<{
  (e: 'enter-detail', kbName: string): void
  (e: 'leave-detail'): void
}>()

const showCreateDialog = ref(false)
const currentView = ref<'list' | 'detail'>('list')
const selectedKb = ref<KnowledgeBase | null>(null)
const detailRef = ref<any>(null)
const kbNameBreadcrumb = ref('')

// 使用知识库 Store
const knowledgeLibraryStore = useKnowledgeLibraryStore()

// 从 Store 获取知识库列表
const knowledgeBases = computed(() => knowledgeLibraryStore.knowledgeBases)

// 格式化时间显示
const formatLastUpdated = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return date.toLocaleDateString('zh-CN')
}

// 页面加载时获取知识库列表
onMounted(async () => {
  await knowledgeLibraryStore.fetchAll()
})

const handleCreateKnowledgeBase = async (data: KnowledgeBaseFormData) => {
  try {
    await knowledgeLibraryStore.create({
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon
    })
  } catch (error) {
    console.error('Failed to create knowledge base:', error)
    // TODO: 显示错误提示
  }
}

const handleEnterKb = (kb: KnowledgeBase) => {
  selectedKb.value = kb
  kbNameBreadcrumb.value = kb.name
  currentView.value = 'detail'
  emit('enter-detail', kb.name)
}

function handleEnterEmbeddingDetail(breadcrumbText: string) {
  // 组合知识库名称和嵌入配置路径
  emit('enter-detail', `${kbNameBreadcrumb.value} > ${breadcrumbText}`)
}

function handleLeaveEmbeddingDetail() {
  // 返回到知识库详情页，只显示知识库名称
  emit('enter-detail', kbNameBreadcrumb.value)
}


const handleBack = () => {
  // 检查子组件是否能处理返回 (二级详情返回)
  if (detailRef.value?.handleBack?.()) {
    return
  }

  currentView.value = 'list'
  selectedKb.value = null
  emit('leave-detail')
}

const handleDeleteKnowledgeBase = async (id: number) => {
  try {
    await knowledgeLibraryStore.delete(id)

    // 如果删除的是当前正在查看的知识库，返回列表视图
    if (selectedKb.value?.id === id) {
      handleBack()
    }
  } catch (error) {
    console.error('Failed to delete knowledge base:', error)
    // TODO: 显示错误提示
  }
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

/* Create Card 样式 */
.create-card {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(48px);
}

.create-card:hover {
  border-color: #4f46e5;
  background: rgba(255, 255, 255, 0.8);
}

.create-card:hover .flex.flex-col.items-center.gap-4 {
  color: #4f46e5;
}

/* KB Card 样式 */
.kb-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(48px);
  border-color: rgba(226, 232, 240, 0.6);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.kb-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border-color: rgba(199, 210, 254, 0.5);
  transform: translateY(-2px);
}

/* 确保图标 SVG 大小正确 */
:deep([v-html] svg) {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
