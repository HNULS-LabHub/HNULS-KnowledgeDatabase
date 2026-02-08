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
          :model-value="mode"
          :options="chunkingModeOptions"
          placeholder="请选择分块模式"
          @update:modelValue="handleModeChange"
        />
        <!-- 模式描述 -->
        <p class="kb-chunking-mode-desc mt-2 text-xs text-slate-500 leading-relaxed">
          {{ selectedModeOption.description }}
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

      <!-- 重叠分块字符数（仅 semantic 模式） -->
      <div v-if="mode === 'semantic'" class="kb-chunking-overlap-chars">
        <label class="kb-chunking-label block text-sm font-medium text-slate-700 mb-2">
          重叠分块字符数
        </label>
        <input
          v-model.number="overlapChars"
          type="number"
          min="0"
          :max="Math.max(0, maxChars - 1)"
          step="10"
          class="kb-chunking-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例如：100"
          @blur="handleSaveConfig"
        />
        <p class="kb-chunking-hint mt-1 text-xs text-slate-400">
          建议范围：maxChars 的 10%~20%，用于在相邻分块之间保留上下文连续性
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const configStore = useKnowledgeConfigStore()

// 分块模式选项
const chunkingModeOptions = [
  {
    label: '段落分块模式',
    value: 'recursive',
    description:
      '按照设置的单个分段最大字符数来尽量凑满，结束时优先结束在段尾，其次是句尾。适合层次化文档结构，分块更加精细。'
  },
  {
    label: '语义分块模式（段落优先 + 重叠）',
    value: 'semantic',
    description:
      '优先按段落边界分割；段落过长时降级到句子边界；并支持重叠分块（overlap），增强相邻分块的上下文连续性。'
  }
] as const

type ChunkingMode = (typeof chunkingModeOptions)[number]['value']

const mode = ref<ChunkingMode>('recursive')
const maxChars = ref(1000)
const overlapChars = ref(100)

const selectedModeOption = computed(() => {
  return chunkingModeOptions.find((o) => o.value === mode.value) ?? chunkingModeOptions[0]
})

const normalizedOverlapChars = computed(() => {
  const upper = Math.max(0, maxChars.value - 1)
  return Math.min(Math.max(0, overlapChars.value), upper)
})

// 加载全局配置
const loadConfig = async () => {
  try {
    await configStore.loadConfig(props.knowledgeBaseId)
    const globalConfig = configStore.getGlobalConfig(props.knowledgeBaseId)
    if (globalConfig) {
      mode.value = globalConfig.chunking.mode
      maxChars.value = globalConfig.chunking.maxChars

      if (globalConfig.chunking.mode === 'semantic') {
        overlapChars.value = globalConfig.chunking.overlapChars
      } else {
        // 保持 overlap 合法（便于用户切换到 semantic 时使用）
        overlapChars.value = normalizedOverlapChars.value
      }
    }
  } catch (error) {
    console.error('[ChunkingSection] Failed to load config:', error)
  }
}

// 保存配置
const handleSaveConfig = async () => {
  try {
    const chunking =
      mode.value === 'semantic'
        ? {
            mode: 'semantic' as const,
            maxChars: maxChars.value,
            overlapChars: normalizedOverlapChars.value
          }
        : {
            mode: 'recursive' as const,
            maxChars: maxChars.value
          }

    await configStore.updateGlobalConfig(props.knowledgeBaseId, {
      chunking
    })
  } catch (error) {
    console.error('[ChunkingSection] Failed to save config:', error)
  }
}

const handleModeChange = async (v: string | number | null) => {
  if (v !== 'recursive' && v !== 'semantic') return
  mode.value = v

  // 切换模式后，立即落盘（semantic 需要 overlap）
  overlapChars.value = normalizedOverlapChars.value
  await handleSaveConfig()
}

watch(
  () => maxChars.value,
  () => {
    // maxChars 变化时，保证 overlap 在合法范围内
    overlapChars.value = normalizedOverlapChars.value
  }
)

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
