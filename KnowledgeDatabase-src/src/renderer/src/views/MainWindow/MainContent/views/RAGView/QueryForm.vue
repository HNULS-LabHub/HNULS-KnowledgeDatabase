<template>
  <div class="kb-rag-query input-card">
    <form class="flex items-center" @submit.prevent="handleSubmit">
      <div class="input-wrapper flex-1 relative">
        <input
          type="text"
          :value="modelValue"
          placeholder="输入查询语句，例如：如何配置 Graph RAG 的节点权重？"
          class="query-input !py-2 !rounded-lg !text-sm"
          :disabled="!canSubmit"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
        <button
          type="submit"
          class="submit-btn !opacity-100 !top-1 !right-1"
          :disabled="isSearching || !canSubmit"
          :title="!canSubmit ? validationMessage : ''"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    </form>
    <!-- 校验提示 -->
    <p v-if="!canSubmit" class="text-xs text-amber-500 mt-2 mb-0">
      {{ validationMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRagStore } from '@renderer/stores/rag/rag.store'

defineProps<{
  modelValue: string
  isSearching: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

const ragStore = useRagStore()

// 校验逻辑
const canSubmit = computed(() => {
  if (!ragStore.selectedKnowledgeBaseId) return false
  if (ragStore.enabledEmbeddingTables.length === 0) return false
  return true
})

const validationMessage = computed(() => {
  if (!ragStore.selectedKnowledgeBaseId) return '请先选择知识库'
  if (ragStore.enabledEmbeddingTables.length === 0) return '请先选择至少一个向量表'
  return ''
})

function handleSubmit() {
  if (!canSubmit.value) return
  emit('submit')
}
</script>
