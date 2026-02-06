<template>
  <div class="agent-citations">
    <div class="citations-header flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-gray-700">引用文档</h3>
      <span class="text-xs text-gray-500">{{ docs.length }} 个文档</span>
    </div>

    <div v-if="docs.length === 0" class="text-sm text-gray-400 italic p-4">
      暂无引用文档
    </div>

    <div v-else class="citations-list space-y-2">
      <div
        v-for="(doc, index) in docs"
        :key="doc.id"
        class="citation-item p-3 rounded-lg border border-gray-200 bg-white hover:shadow-sm transition-all"
      >
        <div class="flex items-start gap-3">
          <!-- 序号 -->
          <div class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
            {{ index + 1 }}
          </div>

          <!-- 内容 -->
          <div class="flex-1 min-w-0">
            <!-- 标题/文件名 -->
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium text-gray-700 truncate">
                {{ doc.file_name || doc.title || doc.id }}
              </span>
            </div>

            <!-- 来源表 -->
            <div class="text-xs text-gray-500 mb-2">
              来源表：<span class="font-mono">{{ doc.table || '未知' }}</span>
            </div>

            <!-- 分数 -->
            <div class="flex items-center gap-3 mb-2">
              <div v-if="doc.rerank_score !== undefined" class="text-xs">
                <span class="text-gray-500">重排分数：</span>
                <span class="font-medium text-emerald-600">{{ doc.rerank_score.toFixed(3) }}</span>
              </div>
              <div v-if="doc.distance !== undefined" class="text-xs">
                <span class="text-gray-500">相似度：</span>
                <span class="font-medium text-blue-600">{{ (1 - doc.distance).toFixed(3) }}</span>
              </div>
            </div>

            <!-- 内容预览 -->
            <div class="text-xs text-gray-600 bg-gray-50 p-2 rounded">
              <button
                class="text-blue-500 hover:text-blue-600 mb-1"
                @click="toggleExpand(index)"
              >
                {{ expandedDocs.has(index) ? '收起' : '展开内容' }}
              </button>
              <div
                v-if="expandedDocs.has(index)"
                class="mt-2 whitespace-pre-wrap max-h-48 overflow-y-auto"
              >
                {{ doc.content }}
              </div>
              <div v-else class="text-gray-400">
                {{ truncateContent(doc.content, 100) }}
              </div>
            </div>

            <!-- 引用理由（如果有） -->
            <div
              v-if="getCitationRationale(doc.id)"
              class="mt-2 text-xs text-purple-600 bg-purple-50 p-2 rounded"
            >
              <span class="font-medium">引用理由：</span>{{ getCitationRationale(doc.id) }}
            </div>
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

// 展开的文档
const expandedDocs = ref(new Set<number>())

// 检索到的文档
const docs = computed(() => {
  return agentStore.currentDocs
})

// 引用信息
const citations = computed(() => {
  return agentStore.currentCitations
})

// 切换展开
function toggleExpand(index: number) {
  if (expandedDocs.value.has(index)) {
    expandedDocs.value.delete(index)
  } else {
    expandedDocs.value.add(index)
  }
}

// 获取引用理由
function getCitationRationale(docId: string): string | undefined {
  const citation = citations.value.find((c) => c.docId === docId)
  return citation?.rationale
}

// 截断内容
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '...'
}
</script>
