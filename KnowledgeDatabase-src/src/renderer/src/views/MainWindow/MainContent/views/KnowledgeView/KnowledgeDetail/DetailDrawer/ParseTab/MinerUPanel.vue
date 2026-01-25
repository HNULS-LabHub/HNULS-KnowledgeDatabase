<template>
  <div
    class="kb-mineru-panel flex-shrink-0 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden group shadow-sm"
  >
    <div
      class="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-bl-full pointer-events-none"
    />
    <div
      class="absolute bottom-0 left-0 w-16 h-16 bg-indigo-100/30 rounded-tr-full pointer-events-none"
    />

    <div class="flex items-center justify-between mb-4 relative z-10">
      <div class="flex flex-col min-w-0">
        <span
          class="text-[10px] font-mono font-semibold text-blue-600 mb-0.5 tracking-wider uppercase"
          >Current Target</span
        >
        <span class="text-sm font-bold text-slate-800 flex items-center gap-2 min-w-0">
          <svg
            class="w-3.5 h-3.5 text-slate-500 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <span class="truncate" :title="fileKey">{{ fileKey || '-' }}</span>
        </span>
      </div>

      <!-- 运行态指示灯 -->
      <div
        class="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border"
        :class="
          isParsing
            ? 'bg-blue-50 text-blue-600 border-blue-100'
            : 'bg-slate-100 text-slate-500 border-slate-200'
        "
      >
        <div
          class="w-1.5 h-1.5 rounded-full"
          :class="isParsing ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'"
        />
        {{ isParsing ? 'RUNNING' : 'READY' }}
      </div>
    </div>

    <!-- 总进度 -->
    <div class="space-y-2 mb-4">
      <div class="flex justify-between text-[10px] font-mono text-slate-500">
        <span>PROGRESS</span>
        <span :class="isParsing ? 'text-blue-600 font-bold' : ''">
          {{ isParsing ? `${Math.floor(progress)}%` : 'IDLE' }}
        </span>
      </div>

      <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
        <div
          class="absolute top-0 left-0 h-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.3)] transition-all duration-200"
          :style="{ width: `${progress}%` }"
        />
        <div v-if="isParsing" class="absolute inset-0 bg-white/30 animate-pulse" />
      </div>
    </div>

    <!-- 主按钮 -->
    <button
      class="w-full relative group/btn overflow-hidden rounded-lg border transition-all duration-300 py-2.5 shadow-sm"
      :disabled="!fileKey || isParsing"
      :class="
        isParsing
          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
          : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
      "
      @click="$emit('start-parsing')"
    >
      <div
        class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold tracking-wider"
      >
        <template v-if="isParsing">
          <svg
            class="w-3.5 h-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" opacity="0.25" />
            <path d="M22 12a10 10 0 0 1-10 10" />
          </svg>
          <span>解析中...</span>
        </template>
        <template v-else>
          <svg
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 2v20"></path>
            <path d="M2 12h20"></path>
          </svg>
          <span>开始 MinerU 解析</span>
        </template>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  fileKey: string
  isParsing: boolean
  progress: number
}>()

defineEmits<{
  'start-parsing': []
}>()
</script>
