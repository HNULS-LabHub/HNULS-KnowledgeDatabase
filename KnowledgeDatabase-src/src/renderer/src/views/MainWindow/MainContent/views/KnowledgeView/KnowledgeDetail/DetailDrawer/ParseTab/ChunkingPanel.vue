<template>
  <div
    class="kb-chunking-panel flex-shrink-0 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden group shadow-sm"
  >
    <div
      class="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-bl-full pointer-events-none"
    />
    <div
      class="absolute bottom-0 left-0 w-16 h-16 bg-indigo-100/30 rounded-tr-full pointer-events-none"
    />

    <div class="flex items-center gap-2 mb-4 relative z-10">
      <div class="bg-blue-50 p-1 rounded-md">
        <svg
          class="w-4 h-4 text-blue-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8" />
          <path d="M8 13h6" />
        </svg>
      </div>
      <span class="text-sm font-bold tracking-wide text-slate-800">分块配置</span>
    </div>

    <div class="space-y-4 relative z-10">
      <!-- 分块功能不可用提示 -->
      <div
        v-if="!canChunk"
        class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
      >
        <svg
          class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 9v4"></path>
          <path d="M12 17h.01"></path>
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path>
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-amber-800 mb-1">分块功能暂不可用</p>
          <p class="text-xs text-amber-700 leading-relaxed">
            {{ chunkingDisabledReason }}
          </p>
        </div>
      </div>

      <!-- 分块配置（仅在可用时显示） -->
      <template v-if="canChunk">
        <!-- 分块模式显示（固定为段落分块） -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-slate-700">分块模式</label>
          <div
            class="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600"
          >
            段落分块模式
          </div>
          <p class="text-xs text-slate-500 leading-relaxed">
            按照设置的单个分段最大字符数来尽量凑满，结束时优先结束在段尾，其次是句尾。适合层次化文档结构，分块更加精细。
          </p>
        </div>

        <!-- 单个分段最大字符数 -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-slate-700">单个分段最大字符数</label>
          <input
            :value="maxChars"
            type="number"
            min="100"
            max="10000"
            step="50"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            placeholder="例如：1000"
            :disabled="!canChunk"
            @input="$emit('update:max-chars', Number(($event.target as HTMLInputElement).value))"
          />
          <p class="text-xs text-slate-400">
            建议范围：500-2000 字符，过小可能导致上下文丢失，过大可能影响检索效果
          </p>
        </div>

        <!-- 分块操作按钮（左半分块，右半预览） -->
        <div class="pt-2">
          <div class="flex gap-2">
            <!-- 左半：分块按钮 -->
            <button
              class="flex-1 relative group/btn overflow-hidden rounded-lg border transition-all duration-300 py-2.5 shadow-sm"
              :class="
                !fileKey || isLoadingChunking || !canChunk
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
              "
              :disabled="!fileKey || isLoadingChunking || !canChunk"
              @click="$emit('start-chunking')"
            >
              <div
                class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold tracking-wider"
              >
                <svg
                  v-if="isLoadingChunking"
                  class="w-3.5 h-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <svg
                  v-else
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                  <path d="M10 9H8" />
                </svg>
                <span>{{ isLoadingChunking ? '分块中...' : '分块' }}</span>
              </div>
            </button>

            <!-- 右半：预览按钮 -->
            <button
              class="flex-1 relative group/btn overflow-hidden rounded-lg border transition-all duration-300 py-2.5 shadow-sm"
              :class="
                !fileKey || !hasChunks || isLoadingChunking
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
              "
              :disabled="!fileKey || !hasChunks || isLoadingChunking"
              @click="$emit('show-preview')"
            >
              <div
                class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold tracking-wider"
              >
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>预览</span>
              </div>
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  fileKey: string
  canChunk: boolean
  chunkingDisabledReason: string
  isLoadingChunking: boolean
  hasChunks: boolean
  maxChars: number
}>()

defineEmits<{
  'update:max-chars': [value: number]
  'start-chunking': []
  'show-preview': []
}>()
</script>
