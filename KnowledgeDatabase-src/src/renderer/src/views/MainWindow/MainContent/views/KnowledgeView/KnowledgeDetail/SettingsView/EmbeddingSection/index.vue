<template>
  <div class="kb-embedding-section flex flex-col gap-6 p-6 bg-white border-b border-slate-100">
    <!-- Header -->
    <div class="kb-embedding-header flex items-center justify-between">
      <div>
        <h3 class="kb-embedding-title text-lg font-semibold text-slate-900 mb-1">
          针对此库的嵌入方案
        </h3>
        <p class="kb-embedding-desc text-sm text-slate-500">
          创建并管理适用于本知识库的向量化配置方案
        </p>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        @click="showCreateDialog = true"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        新建配置项
      </button>
    </div>

    <!-- Config List -->
    <div class="space-y-4">
      <div
        v-if="!configs || configs.length === 0"
        class="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400"
      >
        <svg
          class="w-12 h-12 mb-3 opacity-20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
          ></path>
        </svg>
        <p class="text-sm">尚未创建任何配置，点击右上角开始</p>
      </div>

      <div
        v-for="config in configs"
        :key="config.id"
        class="group relative flex items-center justify-between p-5 rounded-2xl border bg-white border-slate-200 hover:border-blue-200 hover:shadow-md transition-all"
      >
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="text-base font-bold text-slate-900 truncate">{{ config.name }}</h4>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span class="flex items-center gap-1">
                <svg
                  class="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                  ></path>
                </svg>
                预设: {{ config.presetName || '自定义' }}
              </span>
              <span class="w-1 h-1 rounded-full bg-slate-200"></span>
              <span class="flex items-center gap-1">
                <svg
                  class="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                节点: {{ config.candidates.length }}
              </span>
              <span class="w-1 h-1 rounded-full bg-slate-200"></span>
              <span>维度: {{ config.dimensions || '默认' }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            class="p-2 text-slate-400 hover:bg-white hover:text-blue-600 rounded-xl transition-all border border-transparent hover:border-blue-100 hover:shadow-sm flex items-center gap-1.5 px-3"
            @click="$emit('open-embedding-detail', config)"
          >
            <span class="text-xs font-semibold">详细配置</span>
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>

          <button
            class="p-2 text-slate-300 hover:text-red-500 rounded-xl transition-colors"
            @click="handleRemove(config.id)"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Create Dialog -->
    <CreateConfigDialog v-model="showCreateDialog" @submit="handleCreate" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import type { EmbeddingModelConfig } from '@preload/types'
import CreateConfigDialog from './CreateConfigDialog.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const emit = defineEmits<{
  (e: 'open-embedding-detail', config: EmbeddingModelConfig): void
}>()

const knowledgeConfigStore = useKnowledgeConfigStore()
const showCreateDialog = ref(false)

// 直接从 Store 获取（响应式）
const configs = computed(() => knowledgeConfigStore.getEmbeddingConfigs(props.knowledgeBaseId))

onMounted(async () => {
  await knowledgeConfigStore.loadConfig(props.knowledgeBaseId)
})

// 通过 Store Actions 操作
async function handleCreate(data: { name: string; presetId?: string; dimensions?: number }) {
  await knowledgeConfigStore.createEmbeddingConfig(props.knowledgeBaseId, data)
}

async function handleRemove(id: string) {
  await knowledgeConfigStore.deleteEmbeddingConfig(props.knowledgeBaseId, id)
}
</script>
