<template>
  <div
    v-if="kgStore.advancedExpanded"
    class="kg-advanced-panel glass-card p-4 flex-shrink-0 overflow-y-auto max-h-[220px]"
  >
    <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
      <!-- 关键词提取 -->
      <div class="col-span-2">
        <label class="text-slate-500 font-medium mb-1 block">关键词提取</label>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              v-model="kgStore.keywordUseLLM"
              class="rounded border-slate-300 text-teal-500 focus:ring-teal-500 w-3.5 h-3.5"
            />
            <span class="text-slate-600">使用 LLM 提取</span>
          </label>
          <span v-if="kgStore.keywordUseLLM && kgStore.selectedKgConfig" class="text-slate-400">
            ({{ kgStore.selectedKgConfig.llmModelId || '未配置' }})
          </span>
        </div>
        <div v-if="!kgStore.keywordUseLLM" class="mt-2 flex gap-2">
          <input
            v-model="kgStore.manualHighKeywords"
            type="text"
            placeholder="高层关键词（逗号分隔）"
            class="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-teal-300"
          />
          <input
            v-model="kgStore.manualLowKeywords"
            type="text"
            placeholder="低层关键词（逗号分隔）"
            class="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-teal-300"
          />
        </div>
      </div>

      <!-- 向量搜索参数 -->
      <div>
        <label class="text-slate-500 font-medium mb-1 block">向量搜索</label>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="text-slate-400 w-20">Entity TopK</span>
            <input
              v-model.number="kgStore.vectorSearch.entityTopK"
              type="number"
              min="1"
              max="200"
              class="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:border-teal-300"
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-400 w-20">Relation TopK</span>
            <input
              v-model.number="kgStore.vectorSearch.relationTopK"
              type="number"
              min="1"
              max="200"
              class="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:border-teal-300"
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-400 w-20">Chunk TopK</span>
            <input
              v-model.number="kgStore.vectorSearch.chunkTopK"
              type="number"
              min="1"
              max="500"
              class="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:border-teal-300"
            />
          </div>
        </div>
      </div>

      <!-- 图遍历参数 -->
      <div>
        <label class="text-slate-500 font-medium mb-1 block">图遍历</label>
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <span class="text-slate-400 w-20">最大深度</span>
            <input
              v-model.number="kgStore.graphTraversal.maxDepth"
              type="number"
              min="1"
              max="5"
              class="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:border-teal-300"
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-slate-400 w-20">最大邻居</span>
            <input
              v-model.number="kgStore.graphTraversal.maxNeighbors"
              type="number"
              min="1"
              max="50"
              class="w-16 px-1.5 py-0.5 border border-slate-200 rounded text-xs text-center focus:outline-none focus:border-teal-300"
            />
          </div>
        </div>
      </div>

      <!-- Rerank -->
      <div class="col-span-2">
        <label class="flex items-center gap-1.5 cursor-pointer mb-1.5">
          <input
            type="checkbox"
            v-model="kgStore.rerankEnabled"
            class="rounded border-slate-300 text-teal-500 focus:ring-teal-500 w-3.5 h-3.5"
          />
          <span class="text-slate-500 font-medium">启用 Rerank</span>
        </label>
        <div v-if="kgStore.rerankEnabled" class="flex gap-2">
          <select
            v-model="kgStore.rerankProviderId"
            class="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-teal-300 bg-white"
          >
            <option :value="null" disabled>选择提供商</option>
            <option v-for="p in enabledProviders" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
          <input
            v-model="kgStore.rerankModelId"
            type="text"
            placeholder="Rerank Model ID"
            class="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-teal-300"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useKGSearchStore } from '@renderer/stores/kg-search/kg-search.store'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'

const kgStore = useKGSearchStore()
const modelStore = useUserModelConfigStore()

const enabledProviders = computed(() => modelStore.providers.filter((p) => p.enabled))
</script>
