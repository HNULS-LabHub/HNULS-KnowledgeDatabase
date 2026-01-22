<template>
  <div class="kb-chunking-section flex flex-col gap-6 p-6 bg-white border-b border-slate-100">
    <div class="kb-chunking-header">
      <h3 class="kb-chunking-title text-lg font-semibold text-slate-900 mb-1">分块配置</h3>
      <p class="kb-chunking-desc text-sm text-slate-500">
        配置文档分块策略，控制文本如何被分割成更小的片段
      </p>
    </div>

    <div class="kb-chunking-form flex flex-col gap-6">
      <!-- 分块模式选择 -->
      <div class="kb-chunking-mode">
        <label class="kb-chunking-label block text-sm font-medium text-slate-700 mb-2">
          分块模式
        </label>
        <WhiteSelect
          :model-value="chunkingModeOptions[0].value"
          :options="chunkingModeOptions"
          placeholder="请选择分块模式"
          disabled
        />
        <!-- 模式描述 -->
        <p class="kb-chunking-mode-desc mt-2 text-xs text-slate-500 leading-relaxed">
          {{ chunkingModeOptions[0].description }}
        </p>
      </div>

      <!-- 单个分段最大字符数 -->
      <div class="kb-chunking-max-chars">
        <label class="kb-chunking-label block text-sm font-medium text-slate-700 mb-2">
          单个分段最大字符数
        </label>
        <input
          v-model.number="maxChars"
          type="number"
          min="100"
          max="10000"
          step="50"
          class="kb-chunking-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例如：1000"
          @blur="handleSaveConfig"
        />
        <p class="kb-chunking-hint mt-1 text-xs text-slate-400">
          建议范围：500-2000 字符，过小可能导致上下文丢失，过大可能影响检索效果
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const configStore = useKnowledgeConfigStore()

// 分块模式选项（仅显示递归分块模式）
const chunkingModeOptions = [
  {
    label: '段落分块模式',
    value: 'recursive',
    description:
      '按照设置的单个分段最大字符数来尽量凑满，结束时优先结束在段尾，其次是句尾。适合层次化文档结构，分块更加精细。'
  }
]

const maxChars = ref(1000)

// 加载全局配置
const loadConfig = async () => {
  try {
    await configStore.loadConfig(props.knowledgeBaseId)
    const globalConfig = configStore.getGlobalConfig(props.knowledgeBaseId)
    if (globalConfig) {
      maxChars.value = globalConfig.chunking.maxChars
    }
  } catch (error) {
    console.error('[ChunkingSection] Failed to load config:', error)
  }
}

// 保存配置
const handleSaveConfig = async () => {
  try {
    await configStore.updateGlobalConfig(props.knowledgeBaseId, {
      chunking: {
        mode: 'recursive',
        maxChars: maxChars.value
      }
    })
  } catch (error) {
    console.error('[ChunkingSection] Failed to save config:', error)
  }
}

// 监听知识库ID变化
watch(
  () => props.knowledgeBaseId,
  () => {
    loadConfig()
  },
  { immediate: true }
)

onMounted(() => {
  loadConfig()
})
</script>
