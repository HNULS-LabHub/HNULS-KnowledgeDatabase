<template>
  <div class="ts-model-result-card bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
    <!-- 头部：模型名 + 状态 -->
    <div class="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs font-semibold text-slate-800 truncate">{{ result.modelId }}</span>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <!-- 状态指示 -->
        <span v-if="result.status === 'loading'" class="flex items-center gap-1 text-[10px] text-amber-600">
          <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12" />
          </svg>
          生成中
        </span>
        <span v-else-if="result.status === 'success'" class="text-[10px] text-emerald-600 font-medium">完成</span>
        <span v-else-if="result.status === 'error'" class="text-[10px] text-red-600 font-medium">错误</span>
      </div>
    </div>

    <!-- 性能指标 -->
    <div class="px-3 py-1.5 border-b border-slate-100 flex items-center gap-3 text-[10px] text-slate-500 bg-slate-50/50">
      <span v-if="metrics.firstTokenTime !== null" class="flex items-center gap-1">
        <svg class="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        首字 {{ metrics.firstTokenTime }}ms
      </span>
      <span v-if="metrics.totalTime !== null" class="flex items-center gap-1">
        <svg class="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v20M2 12h20" />
        </svg>
        总计 {{ formatTime(metrics.totalTime) }}
      </span>
      <span v-if="metrics.tokensPerSecond !== null" class="flex items-center gap-1">
        <svg class="w-3 h-3 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        {{ metrics.tokensPerSecond }} tok/s
      </span>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-auto p-3 space-y-2 max-h-[400px]">
      <!-- 思考过程 -->
      <div v-if="result.reasoning" class="space-y-1">
        <div class="flex items-center gap-1">
          <svg class="w-3 h-3 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          <span class="text-[10px] font-semibold text-purple-700">思考过程</span>
        </div>
        <pre class="p-2 bg-purple-50 border border-purple-200 rounded text-[10px] text-purple-800 whitespace-pre-wrap overflow-auto max-h-[120px] font-mono">{{ result.reasoning }}</pre>
      </div>

      <!-- 输出内容 -->
      <div class="space-y-1">
        <div class="flex items-center gap-1">
          <svg class="w-3 h-3 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span class="text-[10px] font-semibold text-slate-600">输出</span>
        </div>
        <pre
          v-if="result.content || result.status === 'loading'"
          class="p-2 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 whitespace-pre-wrap overflow-auto min-h-[80px] font-mono"
        >{{ result.content || '等待响应...' }}</pre>
        <div v-else-if="result.error" class="p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700">
          {{ result.error }}
        </div>
      </div>
    </div>

    <!-- 底部：Token 统计 -->
    <div v-if="result.usage" class="px-3 py-1.5 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex gap-3">
      <span>Prompt: {{ result.usage.promptTokens }}</span>
      <span>Completion: {{ result.usage.completionTokens }}</span>
      <span>Total: {{ result.usage.totalTokens }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModelTestResult, ModelMetrics } from '@renderer/stores/test/kg-test.types'

defineProps<{
  result: ModelTestResult
  metrics: ModelMetrics
}>()

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>
