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
      <!-- 重排开关 -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">重排功能</label>
        <div class="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            :aria-checked="ragStore.rerankEnabled"
            class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="ragStore.rerankEnabled ? 'bg-emerald-500' : 'bg-slate-200'"
            @click="ragStore.toggleRerank()"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200"
              :class="ragStore.rerankEnabled ? 'translate-x-5' : 'translate-x-0'"
            ></span>
          </button>
          <span class="text-xs text-slate-500">
            {{ ragStore.rerankEnabled ? '已启用重排' : '仅向量检索' }}
          </span>
        </div>
      </div>

      <!-- 重排模型 -->
      <div
        class="flex flex-col gap-1 transition-opacity duration-200"
        :class="{ 'opacity-40 pointer-events-none': !ragStore.rerankEnabled }"
      >
        <label class="text-xs font-medium text-slate-500">重排模型</label>
        <button
          type="button"
          class="w-full text-left bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!ragStore.rerankEnabled"
          @click="rerankSheetOpen = true"
        >
          <span class="font-medium">
            {{ rerankModelLabel || '请选择重排模型' }}
          </span>
        </button>
        <p
          v-if="ragStore.rerankEnabled && !ragStore.rerankModelId"
          class="text-xs text-amber-500 mt-1 m-0"
        >
          请选择一个重排模型
        </p>
      </div>
      <ModelSelectSheet
        v-model="rerankSheetOpen"
        mode="rerank"
        title="选择重排模型"
        :current-model-id="ragStore.rerankModelId"
        @select="ragStore.setRerankModel"
      />

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
        <button
          type="button"
          class="w-full text-left bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 hover:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!ragStore.llmDrivenEnabled"
          @click="llmSheetOpen = true"
        >
          <span class="font-medium">
            {{ llmModelLabel || '请选择 LLM 模型' }}
          </span>
        </button>
        <p
          v-if="ragStore.llmDrivenEnabled && !ragStore.llmModelId"
          class="text-xs text-amber-500 mt-1 m-0"
        >
          请选择一个 LLM 以启用生成
        </p>
      </div>
      <ModelSelectSheet
        v-model="llmSheetOpen"
        mode="llm"
        title="选择 LLM 模型"
        :current-model-id="ragStore.llmModelId"
        @select="ragStore.setLlmModel"
      />

      <!-- 知识库 -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-500">知识库</label>
        <WhiteSelect
          :model-value="ragStore.selectedKnowledgeBaseId"
          :options="kbOptions"
          placeholder="请选择知识库"
          @update:model-value="(v) => ragStore.setKnowledgeBase(v as number | null)"
        />
        <p v-if="knowledgeBases.length === 0" class="text-xs text-slate-400 mt-1 m-0">
          暂无知识库，请先创建
        </p>
      </div>

      <!-- 向量表选择 -->
      <div v-if="ragStore.selectedKnowledgeBaseId" class="flex flex-col gap-1 mt-1">
        <label class="text-xs font-medium text-slate-500">嵌入向量表</label>
        <div
          v-if="embeddingTablesLoading"
          class="text-xs text-slate-400 py-2 px-3 bg-slate-50 rounded-lg"
        >
          加载中...
        </div>
        <div
          v-else-if="embeddingTables.length === 0"
          class="text-xs text-slate-400 py-2 px-3 bg-slate-50 rounded-lg"
        >
          该知识库暂无嵌入向量表
        </div>
        <div v-else class="flex flex-col gap-2 bg-slate-50 rounded-lg p-3">
          <!-- 全选 -->
          <label
            class="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-2 py-1 transition"
          >
            <input
              type="checkbox"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              class="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-2"
              @change="handleSelectAll"
            />
            <span class="text-xs font-medium text-slate-600">全选</span>
          </label>
          <div class="h-px bg-slate-200"></div>
          <!-- 向量表列表 -->
          <div class="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            <div
              v-for="table in embeddingTables"
              :key="table.tableName"
              class="flex items-start gap-2 hover:bg-white rounded px-2 py-1.5 transition"
            >
              <input
                type="checkbox"
                :checked="ragStore.embeddingTableConfigs[table.tableName]?.enabled === true"
                class="mt-0.5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-2 cursor-pointer"
                @change="ragStore.toggleEmbeddingTable(table.tableName)"
              />
              <div class="flex-1 min-w-0 flex flex-col gap-1.5">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div
                      class="text-xs font-medium text-slate-700 truncate"
                      :title="table.tableName"
                    >
                      {{ table.tableName }}
                    </div>
                    <div class="text-[10px] text-slate-500 mt-0.5">
                      {{ table.configName || '未知模型' }} · {{ table.dimensions }}维 ·
                      {{ table.chunkCount }} 块
                    </div>
                  </div>
                  <!-- k 值配置 -->
                  <div
                    v-if="ragStore.embeddingTableConfigs[table.tableName]?.enabled"
                    class="flex items-center gap-1.5"
                  >
                    <span class="text-[10px] text-slate-400 whitespace-nowrap">TopK:</span>
                    <input
                      type="number"
                      :value="ragStore.embeddingTableConfigs[table.tableName]?.k ?? 10"
                      min="1"
                      max="100"
                      class="w-14 px-1.5 py-0.5 text-[11px] border border-slate-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      @input="
                        (e) =>
                          ragStore.setEmbeddingTableK(
                            table.tableName,
                            Math.max(1, Math.min(100, Number((e.target as HTMLInputElement).value)))
                          )
                      "
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue'
import { useRagStore } from '@renderer/stores/rag/rag.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { WhiteSelectOption } from '@renderer/components/select/WhiteSelect.vue'
import ModelSelectSheet from './ModelSelectSheet.vue'

// 嵌入向量表信息类型
interface EmbeddingTableInfo {
  tableName: string
  configId: string
  configName: string | null
  dimensions: number
  chunkCount: number
}

const ragStore = useRagStore()
const knowledgeLibraryStore = useKnowledgeLibraryStore()
const modelConfigStore = useUserModelConfigStore()

const knowledgeBases = computed(() => knowledgeLibraryStore.knowledgeBases)

const rerankSheetOpen = ref(false)
const llmSheetOpen = ref(false)

function findModelLabel(modelId: string | null): string {
  if (!modelId) return ''

  for (const p of modelConfigStore.providers) {
    const m = p.models.find((x) => x.id === modelId)
    if (m) return `${m.name} (${p.name})`
  }
  return modelId
}

const rerankModelLabel = computed(() => findModelLabel(ragStore.rerankModelId))
const llmModelLabel = computed(() => findModelLabel(ragStore.llmModelId))

// 确保知识库列表已加载
onMounted(() => {
  if (knowledgeBases.value.length === 0) {
    knowledgeLibraryStore.fetchAll()
  }
})

// 确保模型 Providers 已加载（用于显示当前选择的模型名称）
onMounted(() => {
  if (modelConfigStore.providers.length === 0) {
    modelConfigStore.fetchProviders()
  }
})

const kbOptions = computed<WhiteSelectOption<number>[]>(() =>
  knowledgeBases.value.map((kb) => ({
    label: kb.name,
    value: kb.id
  }))
)

// 向量表状态
const embeddingTables = ref<EmbeddingTableInfo[]>([])
const embeddingTablesLoading = ref(false)

// 加载向量表
async function loadEmbeddingTables(kbId: number) {
  embeddingTablesLoading.value = true
  try {
    embeddingTables.value = await window.api.knowledgeLibrary.listEmbeddingTables(kbId)
    // 同步元数据到 store
    ragStore.setEmbeddingTablesMetadata(
      embeddingTables.value.map((t) => ({
        tableName: t.tableName,
        configName: t.configName ?? undefined,
        dimensions: t.dimensions
      }))
    )
  } catch (err) {
    console.error('[ConfigForm] 加载向量表失败:', err)
    embeddingTables.value = []
  } finally {
    embeddingTablesLoading.value = false
  }
}

// 全选状态
const isAllSelected = computed(
  () =>
    embeddingTables.value.length > 0 &&
    embeddingTables.value.every(
      (t) => ragStore.embeddingTableConfigs[t.tableName]?.enabled === true
    )
)

const isIndeterminate = computed(() => {
  const enabledCount = embeddingTables.value.filter(
    (t) => ragStore.embeddingTableConfigs[t.tableName]?.enabled === true
  ).length
  return enabledCount > 0 && enabledCount < embeddingTables.value.length
})

// 全选/取消全选
function handleSelectAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  ragStore.setAllEmbeddingTables(
    embeddingTables.value.map((t) => t.tableName),
    checked
  )
}

// 监听知识库变化
watch(
  () => ragStore.selectedKnowledgeBaseId,
  (kbId) => {
    if (kbId) {
      loadEmbeddingTables(kbId)
    } else {
      embeddingTables.value = []
    }
  },
  { immediate: true }
)
</script>
