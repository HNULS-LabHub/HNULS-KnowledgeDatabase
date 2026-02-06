<template>
  <div class="kb-rag-query input-card">
    <form class="flex items-center" @submit.prevent="handleSubmit">
      <div class="input-wrapper flex-1">
        <input
          type="text"
          :value="modelValue"
          placeholder="输入查询语句，例如：如何配置 Graph RAG 的节点权重？"
          class="query-input !py-2 !rounded-lg !text-sm"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
        <button
          type="submit"
          class="submit-btn !opacity-100 !top-1 !right-1"
          :disabled="isSearching"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  isSearching: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

function handleSubmit() {
  emit('submit')
}
</script>
