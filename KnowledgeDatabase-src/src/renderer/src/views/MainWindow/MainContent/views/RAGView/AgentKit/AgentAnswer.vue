<template>
  <div class="agent-answer">
    <div class="answer-header flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-gray-700">Agent 回答</h3>
      <span
        v-if="isGenerating"
        class="text-xs text-blue-500 flex items-center gap-1"
      >
        <span class="animate-pulse">●</span>
        生成中...
      </span>
      <span
        v-else-if="answer"
        class="text-xs text-emerald-500"
      >
        ✓ 已完成
      </span>
    </div>

    <div
      v-if="answer"
      class="answer-content prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg border border-gray-200"
      v-html="renderedAnswer"
    ></div>

    <div
      v-else-if="!isGenerating"
      class="text-sm text-gray-400 italic p-4"
    >
      等待 Agent 生成回答...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import { marked } from 'marked'

const agentStore = useAgentStore()

// 是否正在生成
const isGenerating = computed(() => {
  return agentStore.isRunning
})

// 当前答案
const answer = computed(() => {
  return agentStore.currentAnswer
})

// 渲染 Markdown
const renderedAnswer = computed(() => {
  if (!answer.value) return ''
  try {
    return marked.parse(answer.value)
  } catch (e) {
    console.error('[AgentAnswer] Markdown parse error:', e)
    return answer.value
  }
})
</script>
