<template>
  <div
    class="kb-knowledge-graph-section flex flex-col gap-6 p-6 bg-white border-b border-slate-100"
  >
    <!-- Header -->
    <div class="kb-kg-header flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold text-slate-900 mb-1">知识图谱配置</h3>
        <p class="text-sm text-slate-500">创建并管理适用于本知识库的知识图谱构建方案</p>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        @click="showCreateDialog = true"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        新建配置项
      </button>
    </div>

    <!-- 默认配置选择 -->
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-2">默认知识图谱配置</label>
      <WhiteSelect
        :model-value="defaultConfigId"
        :options="defaultConfigOptions"
        placeholder="请选择默认知识图谱配置"
        @update:model-value="handleDefaultConfigChange"
      />
      <p class="mt-1.5 text-xs text-slate-500 leading-relaxed">
        默认配置用于批量构建知识图谱时使用。
      </p>
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
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
          />
        </svg>
        <p class="text-sm">尚未创建任何知识图谱配置，点击右上角开始</p>
      </div>

      <div
        v-for="config in configs"
        :key="config.id"
        class="group relative flex items-center justify-between p-5 rounded-2xl border bg-white border-slate-200 hover:border-blue-200 hover:shadow-md transition-all"
      >
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <div class="flex flex-col min-w-0">
            <h4 class="text-base font-bold text-slate-900 truncate">{{ config.name }}</h4>
            <div class="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
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
                  />
                </svg>
                嵌入: {{ getEmbeddingName(config.embeddingConfigId) }}
              </span>
              <template v-if="config.llmModelId">
                <span class="w-1 h-1 rounded-full bg-slate-200" />
                <span>LLM: {{ config.llmModelId }}</span>
              </template>
              <template v-if="config.chunkConcurrency">
                <span class="w-1 h-1 rounded-full bg-slate-200" />
                <span>并行: {{ config.chunkConcurrency }}</span>
              </template>
              <template v-if="config.entityTypes?.length">
                <span class="w-1 h-1 rounded-full bg-slate-200" />
                <span>实体: {{ config.entityTypes.length }} 类</span>
              </template>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button
            class="p-2 text-slate-400 hover:bg-white hover:text-blue-600 rounded-xl transition-all border border-transparent hover:border-blue-100 hover:shadow-sm flex items-center gap-1.5 px-3"
            @click="$emit('open-kg-detail', config)"
          >
            <span class="text-xs font-semibold">详细配置</span>
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="9 18 15 12 9 6" />
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Create Dialog -->
    <CreateKgConfigDialog
      v-model="showCreateDialog"
      :embedding-configs="embeddingConfigs"
      @submit="handleCreate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import type { KnowledgeGraphModelConfig } from '@preload/types'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import CreateKgConfigDialog from './CreateKgConfigDialog.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const emit = defineEmits<{
  (e: 'open-kg-detail', config: KnowledgeGraphModelConfig): void
}>()

const knowledgeConfigStore = useKnowledgeConfigStore()
const knowledgeLibraryStore = useKnowledgeLibraryStore()
const showCreateDialog = ref(false)

const knowledgeBase = computed(() => knowledgeLibraryStore.getById(props.knowledgeBaseId))

const configs = computed(() => knowledgeConfigStore.getKgConfigs(props.knowledgeBaseId))
const embeddingConfigs = computed(() =>
  knowledgeConfigStore.getEmbeddingConfigs(props.knowledgeBaseId)
)

const defaultConfigId = computed(() =>
  knowledgeConfigStore.getDefaultKgConfigId(props.knowledgeBaseId)
)

const defaultConfigOptions = computed(() => {
  const options = configs.value.map((c) => ({
    label: `${c.name} (${c.llmModelId || '未配置LLM'})`,
    value: c.id
  }))
  return [{ label: '未设置', value: '' }, ...options]
})

function getEmbeddingName(embeddingConfigId: string): string {
  const found = embeddingConfigs.value.find((c) => c.id === embeddingConfigId)
  return found?.name ?? '未知'
}

onMounted(async () => {
  await knowledgeConfigStore.loadConfig(props.knowledgeBaseId)
  // 加载配置后，检查未建表的 KG 配置并尝试建表
  const dbName = knowledgeBase.value?.databaseName
  if (dbName) {
    await knowledgeConfigStore.ensureGraphTables(props.knowledgeBaseId, dbName)
  }
})

async function handleCreate(data: { name: string; embeddingConfigId: string }) {
  const dbName = knowledgeBase.value?.databaseName
  if (!dbName) {
    console.error('Cannot create KG config: databaseName not found')
    return
  }
  const newConfig = await knowledgeConfigStore.createKgConfig(props.knowledgeBaseId, {
    name: data.name,
    embeddingConfigId: data.embeddingConfigId,
    llmProviderId: '',
    llmModelId: '',
    chunkConcurrency: 3,
    entityTypes: ['人物', '组织', '地点', '概念', '事件'],
    outputLanguage: 'zh-CN'
  }, dbName)
  // 创建后直接进入详情页
  emit('open-kg-detail', newConfig)
}

async function handleRemove(id: string) {
  await knowledgeConfigStore.deleteKgConfig(props.knowledgeBaseId, id)
}

async function handleDefaultConfigChange(value: string | number | null) {
  await knowledgeConfigStore.setDefaultKgConfigId(
    props.knowledgeBaseId,
    value ? String(value) : null
  )
}
</script>
