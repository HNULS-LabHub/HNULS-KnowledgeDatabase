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

      <!-- Status Badge -->
      <div
        v-if="embeddingState"
        class="px-3 py-1 rounded-full text-xs font-semibold"
        :class="statusBadgeClass"
      >
        {{ statusText }}
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-col gap-3">
      <!-- 模型选择 -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-slate-700">嵌入模型配置</label>
        <WhiteSelect
          v-model="selectedConfigId"
          :options="configOptions"
          placeholder="选择嵌入模型配置"
          :disabled="isEmbedding || !canEmbed"
        />
        <p v-if="!canEmbed" class="text-xs text-amber-600">
          {{ embeddingDisabledReason }}
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
import { ref, computed, watch } from 'vue'
import { useEmbeddingStore } from '@renderer/stores/embedding/embedding.store'
import { useChunkingStore } from '@renderer/stores/chunking/chunking.store'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { EmbeddingConfig } from '@renderer/stores/embedding/embedding.types'
import type { FileNode } from '../../../types'
import type { TaskHandle } from '@preload/types'

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
const knowledgeLibraryStore = useKnowledgeLibraryStore()

const embeddingPanelRef = ref<HTMLElement | null>(null)
const selectedConfigId = ref<string | null>(null)

// 获取嵌入模型配置选项
const configOptions = computed(() => {
  if (!props.knowledgeBaseId) return []
  const configs = configStore.getEmbeddingConfigs(props.knowledgeBaseId)
  return configs.map((config) => ({
    label: `${config.name} (${config.candidates.length} 节点)`,
    value: config.id
  }))
})

// 获取选中的配置
const selectedConfig = computed(() => {
  if (!props.knowledgeBaseId || !selectedConfigId.value) return null
  const configs = configStore.getEmbeddingConfigs(props.knowledgeBaseId)
  return configs.find((c) => c.id === selectedConfigId.value) || null
})

// 构建 EmbeddingConfig
const embeddingConfig = computed<EmbeddingConfig | null>(() => {
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

  let taskHandle: TaskHandle | null = null

  try {
    // 获取分块数量
    const chunkingState = chunkingStore.getState(props.fileKey)
    if (!chunkingState || chunkingState.chunks.length === 0) {
      console.warn('[EmbeddingPanel] No chunks found, cannot embed')
      return
    }

    const totalChunks = chunkingState.chunks.length

    // 获取知识库名称和文件名
    const kb = knowledgeLibraryStore.getById(props.knowledgeBaseId)
    const knowledgeBaseName = kb?.name || `知识库 ${props.knowledgeBaseId}`
    const fileName = props.fileData?.name || props.fileKey.split('/').pop() || '未知文件'

    // 创建任务
    taskHandle = await window.api.taskMonitor.createTask({
      type: 'embedding',
      title: `向量嵌入 - ${fileName}`,
      meta: {
        fileKey: props.fileKey,
        fileName,
        knowledgeBaseId: props.knowledgeBaseId,
        knowledgeBaseName,
        configId: embeddingConfig.value.configId,
        totalChunks
      }
    })

    // 执行嵌入
    await embeddingStore.startEmbedding(
      props.fileKey,
      embeddingConfig.value,
      {
        knowledgeBaseId: props.knowledgeBaseId,
        fileRelativePath: props.fileKey,
        totalChunks
      },
      (progress, processed) => {
        // 更新任务进度
        taskHandle?.updateProgress(progress, {
          processedVectors: processed,
          currentDetail: `${processed}/${totalChunks} 向量`
        })
      }
    )

    // 完成任务
    taskHandle.complete({ totalVectors: totalChunks })
  } catch (error) {
    console.error('[EmbeddingPanel] Failed to start embedding:', error)
    taskHandle?.fail(error instanceof Error ? error.message : '嵌入失败')
  }
}

// 查看向量
const handleViewVectors = (): void => {
  console.log('[EmbeddingPanel] View vectors:', embeddingState.value?.vectors)
  // TODO: 实现向量查看对话框
  alert(`已生成 ${embeddingState.value?.vectors.length || 0} 个向量\n\n功能开发中...`)
}

// 暴露 ref 给父组件（用于滚动定位）
defineExpose({
  embeddingPanelRef
})
</script>
