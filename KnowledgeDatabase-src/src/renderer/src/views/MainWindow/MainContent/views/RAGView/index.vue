<template>
  <div class="kb-rag-view rag-view">
    <!-- 顶栏：标题 + 查询输入 -->
    <div class="rag-topbar">
      <div class="flex items-center gap-3">
        <div
          class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg"
        >
          <svg
            class="w-4 h-4 text-indigo-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <span class="text-sm font-bold text-slate-900">RAG 调试</span>
        </div>
        <div class="flex gap-1.5">
          <span class="badge indigo">Hybrid Search</span>
          <span class="badge emerald">Rerank</span>
        </div>
      </div>
      <QueryForm
        v-model="ragStore.query"
        :is-searching="ragStore.isSearching"
        class="flex-1 ml-4"
        @submit="handleSubmit"
      />
    </div>

    <!-- 主区域：窄侧栏 + 宽结果区 -->
    <div class="rag-main">
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
  </div>
</template>

<script setup lang="ts">
import { useRagStore } from '@renderer/stores/rag/rag.store'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import { mockAgentRun } from '@renderer/stores/rag/agent.mock'
import QueryForm from './QueryForm.vue'
import ConfigForm from './ConfigForm.vue'
import PipelineSteps from './PipelineSteps.vue'
import ResultPanel from './ResultPanel.vue'

const ragStore = useRagStore()
const agentStore = useAgentStore()

// 处理查询提交
async function handleSubmit() {
  // 如果开启了 LLM 驱动，走 Agent 流程
  if (ragStore.llmDrivenEnabled) {
    const question = ragStore.query
    const modelId = ragStore.llmModelId || 'gpt-4'
    const kbId = ragStore.selectedKnowledgeBaseId || 1

    const runId = agentStore.startRun(question, modelId, kbId)

    // 使用 mock 数据模拟 Agent 运行
    await mockAgentRun(runId, (event) => {
      agentStore.pushEvent(event)
    })
  } else {
    // 否则走传统检索管线
    await ragStore.executeSearch()
  }
}
</script>
