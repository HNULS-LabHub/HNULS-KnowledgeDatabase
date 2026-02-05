<template>
  <div
    ref="embeddingPanelRef"
    class="kb-embedding-panel flex flex-col gap-4 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-100 shadow-sm"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md"
        >
          <svg
            class="w-5 h-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            ></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900">Vector Embedding / 嵌入</h3>
          <p class="text-xs text-slate-500 mt-0.5">将文本转换为向量表示</p>
        </div>
      </div>

      <!-- 配置状态指示 + 状态徽章 -->
      <div class="flex items-center gap-2">
        <div v-if="hasCustomEmbeddingConfig" class="flex items-center gap-2">
          <span
            class="text-[10px] font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200"
          >
            独立配置
          </span>
          <button
            class="text-xs text-slate-600 hover:text-purple-600 underline transition"
            @click="handleResetConfig"
          >
            回正
          </button>
        </div>
        <!-- Status Badge -->
        <div
          v-if="embeddingState"
          class="px-3 py-1 rounded-full text-xs font-semibold"
          :class="statusBadgeClass"
        >
          {{ statusText }}
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-3">
      <!-- 模型选择 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700">嵌入模型配置</label>
        <WhiteSelect
          v-model="selectedConfigId"
          :options="configOptionsWithDefault"
          :placeholder="defaultConfigPlaceholder"
          :disabled="isEmbedding || !canEmbed"
          @update:model-value="handleConfigChange"
        />
        <p v-if="!canEmbed" class="text-xs text-amber-600">
          {{ embeddingDisabledReason }}
        </p>
        <p
          v-else-if="!hasCustomEmbeddingConfig && defaultEmbeddingConfigId"
          class="text-xs text-slate-500"
        >
          当前跟随全局默认配置
        </p>
      </div>

      <!-- 进度条（嵌入中） -->
      <div v-if="isEmbedding && embeddingState" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-xs text-slate-600">
          <span>嵌入进度</span>
          <span class="font-semibold">{{ embeddingState.progress || 0 }}%</span>
        </div>
        <div class="w-full h-2 bg-white rounded-full overflow-hidden shadow-inner">
          <div
            class="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
            :style="{ width: `${embeddingState.progress || 0}%` }"
          ></div>
        </div>
        <p class="text-xs text-slate-500">
          已处理: {{ embeddingState.processedVectors || 0 }} /
          {{ embeddingState.totalVectors || 0 }} 向量
        </p>
      </div>

      <!-- 已嵌入信息 -->
      <div
        v-if="hasEmbeddings && !isEmbedding"
        class="flex items-center gap-2 text-sm text-slate-600"
      >
        <svg
          class="w-4 h-4 text-green-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>已生成 {{ embeddingState?.vectors.length || 0 }} 个向量</span>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-2">
        <button
          v-if="!hasEmbeddings || isEmbedding"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
          :disabled="!canEmbed || isEmbedding || !selectedConfigId"
          @click="handleStartEmbedding"
        >
          <svg
            v-if="!isEmbedding"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          <svg
            v-else
            class="w-4 h-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          {{ isEmbedding ? '嵌入中...' : '开始嵌入' }}
        </button>

        <button
          v-if="hasEmbeddings && !isEmbedding"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
          @click="handleViewVectors"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          查看向量
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useEmbeddingStore } from '@renderer/stores/embedding/embedding.store'
import { useChunkingStore } from '@renderer/stores/chunking/chunking.store'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { EmbeddingViewConfig } from '@renderer/stores/embedding/embedding.types'
import type { FileNode } from '../../../types'

const props = defineProps<{
  fileKey: string
  knowledgeBaseId?: number
  fileData?: FileNode | null
  canEmbed: boolean
  embeddingDisabledReason: string
}>()

const embeddingStore = useEmbeddingStore()
const chunkingStore = useChunkingStore()
const configStore = useKnowledgeConfigStore()

const embeddingPanelRef = ref<HTMLElement | null>(null)
const selectedConfigId = ref<string | null>(null)

// 获取全局默认嵌入配置ID
const defaultEmbeddingConfigId = computed(() =>
  props.knowledgeBaseId ? configStore.getDefaultEmbeddingConfigId(props.knowledgeBaseId) : null
)

// 检查文档是否有独立的嵌入配置
const hasCustomEmbeddingConfig = computed(() =>
  props.knowledgeBaseId && props.fileKey
    ? configStore.hasCustomEmbeddingConfig(props.knowledgeBaseId, props.fileKey)
    : false
)

// 获取文档的嵌入配置ID（文档独立 > 全局默认）
const documentEmbeddingConfigId = computed(() =>
  props.knowledgeBaseId && props.fileKey
    ? configStore.getDocumentEmbeddingConfigId(props.knowledgeBaseId, props.fileKey)
    : null
)

// 获取嵌入模型配置选项
const configOptions = computed(() => {
  if (!props.knowledgeBaseId) return []
  const configs = configStore.getEmbeddingConfigs(props.knowledgeBaseId)
  return configs.map((config) => ({
    label: `${config.name} (${config.candidates.length} 节点)`,
    value: config.id
  }))
})

// 配置选项（带跟随全局选项）
const configOptionsWithDefault = computed(() => {
  if (!defaultEmbeddingConfigId.value) {
    // 没有全局默认配置，直接返回原始选项
    return configOptions.value
  }
  // 有全局默认配置，添加“跟随全局”选项
  const defaultConfig = configOptions.value.find((c) => c.value === defaultEmbeddingConfigId.value)
  const defaultLabel = defaultConfig ? `跟随全局 (${defaultConfig.label})` : '跟随全局'
  return [{ label: defaultLabel, value: '' }, ...configOptions.value]
})

// 默认配置占位符
const defaultConfigPlaceholder = computed(() => {
  if (defaultEmbeddingConfigId.value) {
    return '选择嵌入模型配置'
  }
  return '请先在设置中配置默认嵌入模型'
})

// 获取选中的配置
const selectedConfig = computed(() => {
  if (!props.knowledgeBaseId || !selectedConfigId.value) return null
  const configs = configStore.getEmbeddingConfigs(props.knowledgeBaseId)
  return configs.find((c) => c.id === selectedConfigId.value) || null
})

// 构建 EmbeddingConfig
const embeddingConfig = computed<EmbeddingViewConfig | null>(() => {
  if (!selectedConfig.value) return null
  const firstCandidate = selectedConfig.value.candidates[0]
  if (!firstCandidate) return null

  return {
    configId: selectedConfig.value.id,
    providerId: firstCandidate.providerId,
    modelId: firstCandidate.modelId,
    dimensions: selectedConfig.value.dimensions
  }
})

// 获取嵌入状态
const embeddingState = computed(() => {
  if (!props.fileKey) return null
  return embeddingStore.getState(props.fileKey)
})

// 是否正在嵌入
const isEmbedding = computed(() => {
  return embeddingState.value?.status === 'running'
})

// 是否已有嵌入结果
const hasEmbeddings = computed(() => {
  if (!props.fileKey || !embeddingConfig.value) return false
  return embeddingStore.hasEmbeddings(props.fileKey, embeddingConfig.value)
})

// 状态文本
const statusText = computed(() => {
  if (!embeddingState.value) return '未嵌入'
  switch (embeddingState.value.status) {
    case 'running':
      return '嵌入中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    default:
      return '未嵌入'
  }
})

// 状态徽章样式
const statusBadgeClass = computed(() => {
  if (!embeddingState.value) return 'bg-slate-100 text-slate-600'
  switch (embeddingState.value.status) {
    case 'running':
      return 'bg-blue-100 text-blue-700'
    case 'completed':
      return 'bg-green-100 text-green-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-slate-100 text-slate-600'
  }
})

// 初始化配置
onMounted(async () => {
  if (props.knowledgeBaseId) {
    await configStore.loadConfig(props.knowledgeBaseId)
  }
})

// 监听文档嵌入配置ID变化，同步到本地选择
watch(
  documentEmbeddingConfigId,
  (configId) => {
    if (hasCustomEmbeddingConfig.value) {
      // 有独立配置，使用独立配置ID
      selectedConfigId.value = configId
    } else {
      // 跟随全局，选中空值
      selectedConfigId.value = defaultEmbeddingConfigId.value ? '' : configId
    }
  },
  { immediate: true }
)

// 监听配置变化，加载嵌入状态
watch(
  [() => props.fileKey, embeddingConfig, () => props.knowledgeBaseId],
  async ([key, config, kbId]) => {
    if (!key || !config) return
    await embeddingStore.ensureState(key, config, { knowledgeBaseId: kbId })
  },
  { immediate: true, deep: true }
)

// 开始嵌入
const handleStartEmbedding = async (): Promise<void> => {
  if (!props.fileKey || !props.knowledgeBaseId || !embeddingConfig.value) return
  if (isEmbedding.value || !props.canEmbed) return

  try {
    // 获取分块数据
    const chunkingState = chunkingStore.getState(props.fileKey)
    if (!chunkingState || chunkingState.chunks.length === 0) {
      console.warn('[EmbeddingPanel] No chunks found, cannot embed')
      return
    }

    const totalChunks = chunkingState.chunks.length
    const fileName = props.fileData?.name || props.fileKey.split('/').pop() || '未知文件'

    // 转换分块为 ChunkInput 格式
    const chunks = chunkingState.chunks.map((chunk, index) => ({
      index,
      text: chunk.content
    }))

    // 执行嵌入（后端会自动创建 TaskMonitor 任务）
    await embeddingStore.startEmbedding(
      props.fileKey,
      embeddingConfig.value,
      {
        knowledgeBaseId: props.knowledgeBaseId,
        fileRelativePath: props.fileKey,
        totalChunks,
        fileName
      },
      chunks
    )

    console.log('[EmbeddingPanel] Embedding completed')
  } catch (error) {
    console.error('[EmbeddingPanel] Failed to start embedding:', error)
  }
}

// 查看向量
const handleViewVectors = (): void => {
  console.log('[EmbeddingPanel] View vectors:', embeddingState.value?.vectors)
  // TODO: 实现向量查看对话框
  alert(`已生成 ${embeddingState.value?.vectors.length || 0} 个向量\n\n功能开发中...`)
}

// 配置变更处理
const handleConfigChange = async (value: string | null): Promise<void> => {
  if (!props.knowledgeBaseId || !props.fileKey) return

  try {
    if (value === '' || value === null) {
      // 选择“跟随全局”，清除文档独立配置
      await configStore.setDocumentEmbeddingConfigId(props.knowledgeBaseId, props.fileKey, null)
    } else {
      // 选择具体配置，设置文档独立配置
      await configStore.setDocumentEmbeddingConfigId(props.knowledgeBaseId, props.fileKey, value)
    }
  } catch (error) {
    console.error('[EmbeddingPanel] Failed to save embedding config:', error)
  }
}

// 回正配置（跟随全局）
const handleResetConfig = async (): Promise<void> => {
  if (!props.knowledgeBaseId || !props.fileKey) return

  try {
    await configStore.setDocumentEmbeddingConfigId(props.knowledgeBaseId, props.fileKey, null)
    // 如果有全局默认配置，选中空值（跟随全局）
    selectedConfigId.value = defaultEmbeddingConfigId.value ? '' : null
  } catch (error) {
    console.error('[EmbeddingPanel] Failed to reset embedding config:', error)
  }
}

// 暴露 ref 给父组件（用于滚动定位）
defineExpose({
  embeddingPanelRef
})
</script>
