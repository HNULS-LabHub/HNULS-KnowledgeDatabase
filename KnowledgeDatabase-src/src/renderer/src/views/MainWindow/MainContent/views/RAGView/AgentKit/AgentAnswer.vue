<template>
  <div v-if="answer || isGenerating" class="agent-answer-bubble">
    <!-- 气泡主体 -->
    <div class="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-gray-200 shadow-sm">
      <!-- 流式内容 -->
      <div
        v-if="answer"
        class="prose prose-sm max-w-none text-gray-800 leading-relaxed"
        v-html="renderedAnswer"
      ></div>

      <!-- 等待生成的光标动画 -->
      <div v-else-if="isGenerating" class="flex items-center gap-1 py-1">
        <span
          class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style="animation-delay: 0ms"
        ></span>
        <span
          class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style="animation-delay: 150ms"
        ></span>
        <span
          class="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
          style="animation-delay: 300ms"
        ></span>
      </div>

      <!-- 正在生成时的闪烁光标 -->
      <span
        v-if="answer && isGenerating"
        class="inline-block w-0.5 h-4 ml-0.5 bg-blue-500 animate-pulse align-text-bottom"
      ></span>
    </div>

    <!-- 状态指示 -->
    <div class="mt-1 px-1 flex items-center gap-2">
      <span v-if="isGenerating" class="text-[11px] text-blue-500">生成中...</span>
      <span v-else-if="currentStatus === 'completed'" class="text-[11px] text-gray-400">
        {{ formatElapsed }} · 完成
      </span>
      <span v-else-if="currentStatus === 'error'" class="text-[11px] text-red-400"> 生成中断 </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import { marked } from 'marked'

const agentStore = useAgentStore()

const isGenerating = computed(() => agentStore.isRunning)
const answer = computed(() => agentStore.currentAnswer)
const currentStatus = computed(() => agentStore.currentStatus)

// 渲染 Markdown
const renderedAnswer = computed(() => {
  if (!answer.value) return ''
  try {
    return marked.parse(answer.value)
  } catch {
    return answer.value
  }
})

// 格式化耗时
const formatElapsed = computed(() => {
  const ms = agentStore.currentElapsedMs
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
})
</script>
