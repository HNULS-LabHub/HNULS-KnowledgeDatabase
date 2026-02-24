<template>
  <div class="kb-rag-view rag-view">
    <!-- 顶栏：Tab 切换 + 对应查询输入 -->
    <div class="rag-topbar">
      <div class="flex items-center gap-1.5">
        <!-- RAG 调试 Tab -->
        <button
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition-all duration-200 cursor-pointer"
          :class="
            activeTab === 'rag'
              ? 'bg-indigo-50 border-indigo-200 text-slate-900'
              : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
          "
          @click="activeTab = 'rag'"
        >
          <svg
            class="w-4 h-4"
            :class="activeTab === 'rag' ? 'text-indigo-500' : 'text-slate-400'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          RAG 调试
        </button>
        <!-- 知识图谱检索 Tab -->
        <button
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition-all duration-200 cursor-pointer"
          :class="
            activeTab === 'kg'
              ? 'bg-teal-50 border-teal-200 text-slate-900'
              : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
          "
          @click="activeTab = 'kg'"
        >
          <svg
            class="w-4 h-4"
            :class="activeTab === 'kg' ? 'text-teal-500' : 'text-slate-400'"
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
          </svg>
          图谱检索
        </button>
      </div>

      <!-- RAG 模式：badges + QueryForm -->
      <template v-if="activeTab === 'rag'">
        <div class="flex gap-1.5 ml-3">
          <span class="badge indigo">Hybrid Search</span>
          <span class="badge emerald">Rerank</span>
        </div>
        <QueryForm
          v-model="ragStore.query"
          :is-searching="ragStore.isSearching"
          class="flex-1 ml-4"
          @submit="handleRagSubmit"
        />
      </template>

      <!-- 图谱检索模式：模式选择 + 搜索输入 -->
      <KGQueryBar v-if="activeTab === 'kg'" class="ml-3" />
    </div>

    <!-- RAG 主区域 -->
    <div v-show="activeTab === 'rag'" class="rag-main">
      <div class="rag-sidebar">
        <ConfigForm />
        <PipelineSteps :steps="ragStore.steps" :is-searching="ragStore.isSearching" />
      </div>
      <ResultPanel
        :is-searching="ragStore.isSearching"
        :has-completed="ragStore.hasCompleted"
        :results="ragStore.recallResults"
        :search-elapsed-ms="ragStore.searchElapsedMs"
      />
    </div>

    <!-- 知识图谱检索主区域 -->
    <div v-show="activeTab === 'kg'" class="flex flex-col flex-1 min-h-0 gap-2 overflow-hidden">
      <KGAdvancedPanel />
      <div class="flex-1 min-h-0 flex flex-col">
        <KGResultPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRagStore } from '@renderer/stores/rag/rag.store'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import QueryForm from './QueryForm.vue'
import ConfigForm from './ConfigForm.vue'
import PipelineSteps from './PipelineSteps.vue'
import ResultPanel from './ResultPanel.vue'
import KGQueryBar from './KGSearch/KGQueryBar.vue'
import KGResultPanel from './KGSearch/KGResultPanel.vue'
import KGAdvancedPanel from './KGSearch/KGAdvancedPanel.vue'

const ragStore = useRagStore()
const agentStore = useAgentStore()

/** 当前活跃 Tab */
const activeTab = ref<'rag' | 'kg'>('rag')

// 初始化 / 清理 IPC 事件监听
onMounted(() => agentStore.initIPCListener())
onUnmounted(() => agentStore.destroyIPCListener())

// RAG 查询提交
async function handleRagSubmit() {
  if (ragStore.llmDrivenEnabled) {
    const question = ragStore.query
    const llmModelId = ragStore.llmModelId || ''
    const kbId = ragStore.selectedKnowledgeBaseId || 0
    const tables = ragStore.enabledEmbeddingTables

    if (!llmModelId) {
      console.warn('[RAGView] LLM model not selected')
      return
    }
    if (!kbId) {
      console.warn('[RAGView] Knowledge base not selected')
      return
    }
    if (tables.length === 0) {
      console.warn('[RAGView] No embedding tables enabled')
      return
    }

    await agentStore.runAgent({
      question,
      llmModelId,
      kbId,
      tables,
      rerankModelId:
        ragStore.rerankEnabled && ragStore.rerankModelId ? ragStore.rerankModelId : undefined
    })
  } else {
    await ragStore.executeSearch()
  }
}
</script>
