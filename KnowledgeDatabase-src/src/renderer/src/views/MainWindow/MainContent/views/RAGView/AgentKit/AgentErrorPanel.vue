<template>
  <div v-if="error" class="mt-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
    <div class="flex items-start gap-2">
      <svg
        class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-red-600">{{ error }}</p>
        <button
          class="mt-1.5 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
          @click="agentStore.retry()"
        >
          重试
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'

const agentStore = useAgentStore()
const error = computed(() => agentStore.currentError)
</script>
