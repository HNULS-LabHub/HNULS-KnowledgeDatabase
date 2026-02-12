<template>
  <div class="kb-kg-detail-view flex flex-col h-full bg-slate-50 overflow-hidden">
    <!-- Header -->
    <div class="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-bold text-slate-900">{{ configName }}</h2>
            <span
              class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded tracking-wider"
            >
              知识图谱配置
            </span>
            <Transition
              enter-active-class="transition-opacity duration-300"
              enter-from-class="opacity-0"
              leave-active-class="transition-opacity duration-300"
              leave-to-class="opacity-0"
            >
              <span v-if="saving" class="text-xs text-slate-400 ml-2">保存中...</span>
              <span v-else-if="saved" class="text-xs text-emerald-500 ml-2">已保存</span>
            </Transition>
          </div>
          <p class="text-sm text-slate-500">
            配置该方案的 LLM 模型、并行数、实体类型与输出语言。修改后自动保存。
          </p>
        </div>
        <button
          class="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all"
          @click="$emit('back')"
        >
          返回
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto p-8 space-y-8 min-h-0">
      <!-- LLM 选择 -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 class="text-lg font-bold text-slate-900">LLM 模型</h3>
        <p class="text-sm text-slate-500">用于实体提取和关系识别的大语言模型</p>
        <button
          type="button"
          class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:border-blue-300 transition-all"
          @click="showModelSelect = true"
        >
          <span :class="localConfig.llmModelId ? 'text-slate-900 font-medium' : 'text-slate-400'">
            {{ localConfig.llmModelId || '点击选择 LLM 模型' }}
          </span>
          <svg
            class="w-4 h-4 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <!-- 并行数 -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 class="text-lg font-bold text-slate-900">并行数</h3>
        <p class="text-sm text-slate-500">
          分块处理最高并行数，范围 1-20，较高值加快构建速度但消耗更多资源
        </p>
        <input
          v-model.number="localConfig.chunkConcurrency"
          type="number"
          min="1"
          max="20"
          class="w-full max-w-xs px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          @blur="autoSave"
        />
      </div>

      <!-- 实体类型 -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-slate-900">实体类型</h3>
            <p class="text-sm text-slate-500">
              定义需要提取的实体类型，如：人物、组织、地点、概念等
            </p>
          </div>
          <span class="text-xs text-slate-400">{{ localConfig.entityTypes.length }} 个类型</span>
        </div>
        <div
          class="flex flex-wrap gap-2 min-h-[2.5rem] p-3 bg-slate-50 border border-slate-200 rounded-xl"
        >
          <span
            v-for="(tag, idx) in localConfig.entityTypes"
            :key="idx"
            class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200"
          >
            {{ tag }}
            <button
              class="text-blue-400 hover:text-blue-600 transition-colors"
              @click="removeEntityType(idx)"
            >
              <svg
                class="w-3 h-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
          <input
            v-model="entityInput"
            type="text"
            placeholder="输入后按回车添加"
            class="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
            @keydown.enter.prevent="addEntityType"
          />
        </div>
      </div>

      <!-- 输出语言 -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 class="text-lg font-bold text-slate-900">输出语言</h3>
        <p class="text-sm text-slate-500">知识图谱实体和关系描述的输出语言</p>
        <WhiteSelect
          v-model="localConfig.outputLanguage"
          :options="languageOptions"
          placeholder="选择输出语言"
          @update:model-value="autoSave"
        />
      </div>
    </div>

    <!-- 模型选择对话框 -->
    <ModelSelectDialog
      v-model="showModelSelect"
      title="选择 LLM 模型"
      description="选择用于知识图谱实体提取的大语言模型"
      :current-model-id="localConfig.llmModelId"
      @select="handleModelSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import ModelSelectDialog from '@renderer/components/ModelSelectDialog/index.vue'
import type { ModelSelection } from '@renderer/components/ModelSelectDialog/index.vue'

const props = defineProps<{
  knowledgeBaseId: number
  configId: string
  configName: string
  initialConfig: {
    llmProviderId: string
    llmModelId: string
    chunkConcurrency: number
    entityTypes: string[]
    outputLanguage: string
  }
}>()

defineEmits<{
  (e: 'back'): void
}>()

const knowledgeConfigStore = useKnowledgeConfigStore()
const showModelSelect = ref(false)
const entityInput = ref('')
const saving = ref(false)
const saved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null

const localConfig = reactive({
  llmProviderId: '',
  llmModelId: '',
  chunkConcurrency: 3,
  entityTypes: [] as string[],
  outputLanguage: 'zh-CN'
})

const languageOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' }
]

onMounted(() => {
  localConfig.llmProviderId = props.initialConfig.llmProviderId || ''
  localConfig.llmModelId = props.initialConfig.llmModelId || ''
  localConfig.chunkConcurrency = props.initialConfig.chunkConcurrency || 3
  localConfig.entityTypes = [...(props.initialConfig.entityTypes || [])]
  localConfig.outputLanguage = props.initialConfig.outputLanguage || 'zh-CN'
})

async function autoSave(): Promise<void> {
  saving.value = true
  saved.value = false
  if (savedTimer) clearTimeout(savedTimer)

  await knowledgeConfigStore.updateKgConfig(props.knowledgeBaseId, props.configId, {
    llmProviderId: localConfig.llmProviderId,
    llmModelId: localConfig.llmModelId,
    chunkConcurrency: localConfig.chunkConcurrency,
    entityTypes: [...localConfig.entityTypes],
    outputLanguage: localConfig.outputLanguage
  })

  saving.value = false
  saved.value = true
  savedTimer = setTimeout(() => {
    saved.value = false
  }, 2000)
}

function handleModelSelect(selection: ModelSelection): void {
  localConfig.llmProviderId = selection.providerId
  localConfig.llmModelId = selection.modelId
  autoSave()
}

function addEntityType(): void {
  const val = entityInput.value.trim()
  if (val && !localConfig.entityTypes.includes(val)) {
    localConfig.entityTypes.push(val)
    autoSave()
  }
  entityInput.value = ''
}

function removeEntityType(idx: number): void {
  localConfig.entityTypes.splice(idx, 1)
  autoSave()
}
</script>
