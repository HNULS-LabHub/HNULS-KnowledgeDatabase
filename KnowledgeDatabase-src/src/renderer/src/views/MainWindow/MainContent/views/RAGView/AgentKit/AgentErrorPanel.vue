<template>
  <div v-if="error" class="agent-error-panel p-4 rounded-lg border-2 border-red-300 bg-red-50">
    <div class="flex items-start gap-3">
      <!-- 错误图标 -->
      <div class="flex-shrink-0">
        <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <!-- 错误内容 -->
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-semibold text-red-700 mb-2">运行失败</h4>
        <p class="text-sm text-red-600 mb-2">{{ error }}</p>

        <!-- 错误详情 -->
        <div v-if="errorEvent" class="mt-3 text-xs text-red-500">
          <div v-if="errorEvent.node" class="mb-1">
            <span class="font-medium">失败节点：</span>{{ errorEvent.node }}
          </div>
          <div class="mb-1">
            <span class="font-medium">发生时间：</span>{{ formatTime(errorEvent.at) }}
          </div>
          <div v-if="errorEvent.stack" class="mt-2">
            <button
              class="text-red-500 hover:text-red-600 underline"
              @click="showStack = !showStack"
            >
              {{ showStack ? '隐藏' : '查看' }}堆栈信息
            </button>
            <pre v-if="showStack" class="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto">{{ errorEvent.stack }}</pre>
          </div>
        </div>

        <!-- 重试按钮 -->
        <div class="mt-3">
          <button
            class="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
            @click="handleRetry"
          >
            重试
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import type { AgentErrorEvent } from '@renderer/stores/rag/agent.types'

const agentStore = useAgentStore()

const showStack = ref(false)

// 当前错误
const error = computed(() => {
  return agentStore.currentError
})

// 错误事件详情
const errorEvent = computed((): AgentErrorEvent | undefined => {
  const events = agentStore.currentEvents
  const errorEvt = events.find((e) => e.type === 'error')
  return errorEvt as AgentErrorEvent | undefined
})

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    hour12: false
  })
}

// 处理重试
function handleRetry() {
  agentStore.retry()
}
</script>
