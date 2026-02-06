<template>
  <div class="kb-rag-query glass-card input-card">
    <form @submit.prevent="handleSubmit">
      <label class="input-label">
        <svg
          class="label-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="9 10 4 15 9 20"></polyline>
          <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
        </svg>
        测试查询
      </label>
      <div class="input-wrapper">
        <input
          type="text"
          :value="modelValue"
          placeholder="例如：如何配置 Graph RAG 的节点权重？"
          class="query-input"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
        <button type="submit" class="submit-btn" :disabled="isSearching">
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
