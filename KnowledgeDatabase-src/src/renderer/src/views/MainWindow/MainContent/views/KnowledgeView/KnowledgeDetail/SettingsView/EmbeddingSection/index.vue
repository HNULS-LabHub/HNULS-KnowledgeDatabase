<template>
  <div class="kb-embedding-section flex flex-col gap-6 p-6 bg-white border-b border-slate-100">
    <!-- Header -->
    <div class="kb-embedding-header">
      <h3 class="kb-embedding-title text-lg font-semibold text-slate-900 mb-1">嵌入配置</h3>
      <p class="kb-embedding-desc text-sm text-slate-500">配置向量嵌入模型和参数</p>
    </div>

    <!-- Content -->
    <div class="kb-embedding-content space-y-6">
      <!-- 嵌入模型选择 -->
      <div class="kb-embedding-model-select">
        <label class="block text-sm font-medium text-slate-700 mb-2">嵌入模型</label>
        <button
          class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
          @click="showModelDialog = true"
        >
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div
              class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-colors"
              :class="
                selectedModel
                  ? 'bg-blue-100 border-blue-200 text-blue-600'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              "
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
            </div>
            <div class="flex flex-col items-start min-w-0">
              <span
                v-if="selectedModel"
                class="text-sm font-medium text-slate-900 truncate w-full"
              >
                {{ selectedModel.name }}
              </span>
              <span v-else class="text-sm text-slate-500">点击选择嵌入模型</span>
              <span v-if="selectedProvider" class="text-xs text-slate-400 truncate w-full">
                {{ selectedProvider.name }}
              </span>
            </div>
          </div>
          <svg
            class="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <p class="mt-2 text-xs text-slate-500">
          从已配置的模型提供商中选择用于向量嵌入的模型
        </p>
      </div>

      <!-- 嵌入维度 -->
      <div class="kb-embedding-dimension">
        <label class="block text-sm font-medium text-slate-700 mb-2">
          嵌入维度
          <span class="text-slate-400 font-normal">(可选)</span>
        </label>
        <input
          v-model.number="dimensionsInput"
          type="number"
          min="1"
          placeholder="留空则使用模型默认维度"
          class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          @blur="handleDimensionsBlur"
        />
        <p class="mt-2 text-xs text-slate-500">
          嵌入向量的维度大小。数值越大消耗的 Token 也越多。留空则不传递 dimensions 参数。
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="kb-embedding-actions flex justify-between items-center pt-4 border-t border-slate-100">
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <svg
            v-if="isSaving"
            class="w-4 h-4 animate-spin text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
          <span v-if="isSaving">保存中...</span>
          <span v-else-if="lastSavedTime">上次保存: {{ lastSavedTime }}</span>
          <span v-else>配置将自动保存</span>
        </div>
        <button
          class="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!hasConfig || isSaving"
          @click="handleReset"
          title="清空所有嵌入配置"
        >
          清空配置
        </button>
      </div>
    </div>

    <!-- Model Select Dialog -->
    <ModelSelectDialog
      v-model="showModelDialog"
      :current-provider-id="localConfig.providerId"
      :current-model-id="localConfig.modelId"
      @select="handleModelSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'
import type { EmbeddingConfig } from '@preload/types'
import ModelSelectDialog from './ModelSelectDialog.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const knowledgeConfigStore = useKnowledgeConfigStore()
const modelConfigStore = useUserModelConfigStore()

// 本地配置状态
const localConfig = ref<EmbeddingConfig>({
  providerId: undefined,
  modelId: undefined,
  dimensions: undefined
})

// 原始配置（用于检测变化）
const originalConfig = ref<EmbeddingConfig>({
  providerId: undefined,
  modelId: undefined,
  dimensions: undefined
})

// UI 状态
const showModelDialog = ref(false)
const dimensionsInput = ref<number | undefined>(undefined)
const isSaving = ref(false)
const lastSavedTime = ref<string>('')

// 自动保存定时器
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

// 计算属性：选中的提供商
const selectedProvider = computed(() => {
  if (!localConfig.value.providerId) return null
  return modelConfigStore.providers.find((p) => p.id === localConfig.value.providerId) || null
})

// 计算属性：选中的模型
const selectedModel = computed(() => {
  if (!selectedProvider.value || !localConfig.value.modelId) return null
  return (
    selectedProvider.value.models.find((m) => m.id === localConfig.value.modelId) || null
  )
})

// 计算属性：是否有配置
const hasConfig = computed(() => {
  return !!(localConfig.value.providerId || localConfig.value.modelId || localConfig.value.dimensions)
})

// 初始化
onMounted(async () => {
  // 加载模型配置
  await modelConfigStore.fetchProviders()

  // 加载知识库配置
  await knowledgeConfigStore.loadConfig(props.knowledgeBaseId)

  // 获取当前嵌入配置
  const config = knowledgeConfigStore.getGlobalConfig(props.knowledgeBaseId)
  if (config?.embedding) {
    localConfig.value = { ...config.embedding }
    originalConfig.value = { ...config.embedding }
    dimensionsInput.value = config.embedding.dimensions
  }
})

// 监听知识库配置变化
watch(
  () => knowledgeConfigStore.getGlobalConfig(props.knowledgeBaseId),
  (config) => {
    if (config?.embedding) {
      localConfig.value = { ...config.embedding }
      originalConfig.value = { ...config.embedding }
      dimensionsInput.value = config.embedding.dimensions
    }
  }
)

// 处理模型选择
function handleModelSelect(providerId: string, modelId: string): void {
  localConfig.value.providerId = providerId
  localConfig.value.modelId = modelId
  triggerAutoSave()
}

// 处理维度输入失焦
function handleDimensionsBlur(): void {
  // 验证输入
  if (dimensionsInput.value !== undefined) {
    if (dimensionsInput.value <= 0 || !Number.isInteger(dimensionsInput.value)) {
      dimensionsInput.value = undefined
    }
  }
  localConfig.value.dimensions = dimensionsInput.value
  triggerAutoSave()
}

// 触发自动保存（防抖）
function triggerAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  autoSaveTimer = setTimeout(() => {
    autoSave()
  }, 1000) // 1秒后自动保存
}

// 自动保存配置
async function autoSave(): Promise<void> {
  if (isSaving.value) return

  isSaving.value = true
  try {
    // 如果所有字段都为空，则清空嵌入配置
    const embeddingConfig = hasConfig.value ? { ...localConfig.value } : undefined
    
    await knowledgeConfigStore.updateGlobalConfig(props.knowledgeBaseId, {
      embedding: embeddingConfig
    })

    // 更新原始配置
    originalConfig.value = { ...localConfig.value }

    // 更新保存时间
    const now = new Date()
    lastSavedTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

    console.log('嵌入配置自动保存成功')
  } catch (error) {
    console.error('自动保存嵌入配置失败:', error)
    // 这里可以添加错误提示
  } finally {
    isSaving.value = false
  }
}

// 重置配置（清空所有配置）
async function handleReset(): Promise<void> {
  // 清除自动保存定时器
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  
  // 清空本地配置
  localConfig.value = {
    providerId: undefined,
    modelId: undefined,
    dimensions: undefined
  }
  dimensionsInput.value = undefined
  
  // 立即保存清空的配置
  isSaving.value = true
  try {
    await knowledgeConfigStore.updateGlobalConfig(props.knowledgeBaseId, {
      embedding: undefined // 清空嵌入配置
    })

    // 更新原始配置
    originalConfig.value = { ...localConfig.value }

    // 更新保存时间
    const now = new Date()
    lastSavedTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

    console.log('嵌入配置已清空')
  } catch (error) {
    console.error('清空嵌入配置失败:', error)
  } finally {
    isSaving.value = false
  }
}

// 组件卸载时清理定时器
import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
})
</script>
