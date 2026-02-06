<template>
  <div class="kb-rag-config glass-card p-5">
    <h4 class="text-sm font-semibold text-slate-600 m-0 mb-4 flex items-center gap-2">
      <svg
        class="w-4 h-4 text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="3"></circle>
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        ></path>
      </svg>
      参数配置
    </h4>

    <div class="flex flex-col gap-3">
      <!-- 重排模型 -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">重排模型</label>
        <select
          class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:bg-white"
          :value="ragStore.rerankModelId"
          @change="ragStore.setRerankModel(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">请选择重排模型</option>
          <option v-for="m in ragStore.rerankModels" :key="m.id" :value="m.id">
            {{ m.name }} ({{ m.provider }})
          </option>
        </select>
      </div>

      <!-- LLM 驱动 RAG 开关 -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">LLM 驱动</label>
        <div class="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            :aria-checked="ragStore.llmDrivenEnabled"
            class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="ragStore.llmDrivenEnabled ? 'bg-indigo-500' : 'bg-slate-200'"
            @click="ragStore.toggleLlmDriven()"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200"
              :class="ragStore.llmDrivenEnabled ? 'translate-x-5' : 'translate-x-0'"
            ></span>
          </button>
          <span class="text-xs text-slate-500">
            {{ ragStore.llmDrivenEnabled ? '已启用 LLM 生成回答' : '仅检索 + 重排' }}
          </span>
        </div>
      </div>

      <!-- LLM 模型 -->
      <div
        class="flex flex-col gap-1 transition-opacity duration-200"
        :class="{ 'opacity-40 pointer-events-none': !ragStore.llmDrivenEnabled }"
      >
        <label class="text-xs font-medium text-slate-500">LLM 模型</label>
        <select
          class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:bg-white disabled:cursor-not-allowed"
          :value="ragStore.llmModelId"
          :disabled="!ragStore.llmDrivenEnabled"
          @change="ragStore.setLlmModel(($event.target as HTMLSelectElement).value || null)"
        >
          <option value="">请选择 LLM 模型</option>
          <option v-for="m in ragStore.llmModels" :key="m.id" :value="m.id">
            {{ m.name }} ({{ m.provider }})
          </option>
        </select>
        <p v-if="ragStore.llmDrivenEnabled && !ragStore.llmModelId" class="text-xs text-amber-500 mt-1 m-0">
          请选择一个 LLM 以启用生成
        </p>
      </div>

      <!-- 知识库 -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">知识库</label>
        <select
          class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-indigo-400 focus:bg-white"
          :value="ragStore.selectedKnowledgeBaseId ?? ''"
          @change="handleKbChange"
        >
          <option value="">请选择知识库</option>
          <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
            {{ kb.name }}
          </option>
        </select>
        <p v-if="knowledgeBases.length === 0" class="text-xs text-slate-400 mt-1 m-0">
          暂无知识库，请先创建
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRagStore } from '@renderer/stores/rag/rag.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'

const ragStore = useRagStore()
const knowledgeLibraryStore = useKnowledgeLibraryStore()

const knowledgeBases = computed(() => knowledgeLibraryStore.knowledgeBases)

function handleKbChange(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  ragStore.setKnowledgeBase(val ? Number(val) : null)
}
</script>
