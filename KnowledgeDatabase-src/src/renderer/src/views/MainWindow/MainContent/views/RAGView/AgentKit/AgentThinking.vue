<template>
  <div v-if="steps.length > 0" class="agent-thinking mb-2">
    <!-- 折叠头 -->
    <button
      class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
      :class="isRunning
        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
        : 'text-gray-500 bg-gray-50 hover:bg-gray-100'"
      @click="expanded = !expanded"
    >
      <!-- 旋转箭头 -->
      <svg
        class="w-3 h-3 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>

      <!-- 加载动画（运行中） -->
      <svg
        v-if="isRunning"
        class="w-3 h-3 animate-spin"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>

      <span>{{ summaryText }}</span>
    </button>

    <!-- 展开的步骤列表 -->
    <div v-if="expanded" class="mt-1.5 ml-2 pl-3 border-l-2 border-gray-200 space-y-1">
      <div
        v-for="(step, i) in steps"
        :key="i"
        class="flex items-start gap-2 py-1 text-xs"
      >
        <!-- 状态点 -->
        <span
          class="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
          :class="getStepDotClass(step)"
        ></span>

        <div class="flex-1 min-w-0">
          <span class="text-gray-700">{{ step.label }}</span>
          <span v-if="step.detail" class="text-gray-400 ml-1">{{ step.detail }}</span>
        </div>

        <span class="text-gray-400 flex-shrink-0">{{ formatStepTime(step.at) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import type { AgentEvent } from '@renderer/stores/rag/agent.types'

const agentStore = useAgentStore()
const expanded = ref(false)

const isRunning = computed(() => agentStore.isRunning)

interface ThinkingStep {
  label: string
  detail?: string
  at: number
  status: 'done' | 'active' | 'error'
}

// 从事件流中提取有意义的步骤
const steps = computed<ThinkingStep[]>(() => {
  const events = agentStore.currentEvents
  const result: ThinkingStep[] = []

  for (const evt of events) {
    switch (evt.type) {
      case 'run_started':
        result.push({ label: '开始运行', at: evt.at, status: 'done' })
        break
      case 'node_started':
        result.push({
          label: getNodeLabel(evt.node, 'started'),
          at: evt.at,
          status: 'active'
        })
        break
      case 'node_completed':
        result.push({
          label: getNodeLabel(evt.node, 'completed'),
          detail: getNodeDetail(evt),
          at: evt.at,
          status: 'done'
        })
        break
      case 'retrieval_results':
        result.push({
          label: `检索到 ${evt.docs.length} 篇文档`,
          at: evt.at,
          status: evt.docs.length > 0 ? 'done' : 'error'
        })
        break
      case 'run_completed':
        result.push({ label: '运行完成', at: evt.at, status: 'done' })
        break
      case 'error':
        result.push({
          label: '错误',
          detail: evt.message,
          at: evt.at,
          status: 'error'
        })
        break
    }
  }

  return result
})

// 摘要文本
const summaryText = computed(() => {
  if (isRunning.value) {
    const lastStep = steps.value[steps.value.length - 1]
    return lastStep ? `正在${lastStep.label}...` : '思考中...'
  }
  return `思考过程 (${steps.value.length} 步)`
})

function getNodeLabel(node: string, phase: 'started' | 'completed'): string {
  const labels: Record<string, string> = {
    retrieve: '检索文档',
    grade: '评估相关性',
    generate: '生成回答'
  }
  const base = labels[node] || node
  return phase === 'started' ? `开始${base}` : `${base}完成`
}

function getNodeDetail(evt: AgentEvent): string | undefined {
  if (evt.type !== 'node_completed' || !evt.data) return undefined
  const data = evt.data as Record<string, any>
  if (data.docCount !== undefined) return `${data.docCount} 篇`
  if (data.needMore !== undefined) return data.needMore ? '需要更多' : '文档充足'
  if (data.rationale) return String(data.rationale).slice(0, 40)
  if (data.answerLength !== undefined) return `${data.answerLength} 字`
  return undefined
}

function getStepDotClass(step: ThinkingStep): string {
  switch (step.status) {
    case 'done': return 'bg-emerald-400'
    case 'active': return 'bg-blue-400 animate-pulse'
    case 'error': return 'bg-red-400'
    default: return 'bg-gray-300'
  }
}

function formatStepTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}
</script>
