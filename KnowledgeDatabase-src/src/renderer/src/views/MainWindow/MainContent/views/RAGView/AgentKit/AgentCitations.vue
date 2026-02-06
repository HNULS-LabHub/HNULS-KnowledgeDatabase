<template>
  <div v-if="docs.length > 0" class="mt-2">
    <!-- 折叠头 -->
    <button
      class="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      @click="expanded = !expanded"
    >
      <svg
        class="w-3 h-3 transition-transform"
        :class="expanded ? 'rotate-90' : ''"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
      </svg>
      <span>引用了 {{ docs.length }} 篇文档</span>
    </button>

    <!-- 展开的文档列表 -->
    <div v-if="expanded" class="mt-1.5 space-y-1.5">
      <div
        v-for="(doc, index) in docs"
        :key="doc.id"
        class="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs"
      >
        <!-- 序号 -->
        <span class="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-[10px]">
          {{ index + 1 }}
        </span>

        <div class="flex-1 min-w-0">
          <!-- 文件名 + 分数 -->
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-700 truncate">
              {{ doc.file_name || doc.id }}
            </span>
            <span v-if="doc.rerank_score != null" class="text-emerald-600 flex-shrink-0">
              {{ doc.rerank_score.toFixed(3) }}
            </span>
            <span v-else-if="doc.distance != null" class="text-blue-500 flex-shrink-0">
              {{ (1 - doc.distance).toFixed(3) }}
            </span>
          </div>

          <!-- 内容预览（可展开） -->
          <button
            class="text-gray-400 hover:text-gray-600 mt-0.5"
            @click="toggleDoc(index)"
          >
            {{ expandedDocs.has(index) ? '收起' : '查看内容' }}
          </button>
          <div
            v-if="expandedDocs.has(index)"
            class="mt-1 p-2 bg-white rounded border border-gray-100 text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto"
          >
            {{ doc.content }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'

const agentStore = useAgentStore()
const expanded = ref(false)
const expandedDocs = ref(new Set<number>())

const docs = computed(() => agentStore.currentDocs)

function toggleDoc(index: number) {
  if (expandedDocs.value.has(index)) {
    expandedDocs.value.delete(index)
  } else {
    expandedDocs.value.add(index)
  }
}
</script>
