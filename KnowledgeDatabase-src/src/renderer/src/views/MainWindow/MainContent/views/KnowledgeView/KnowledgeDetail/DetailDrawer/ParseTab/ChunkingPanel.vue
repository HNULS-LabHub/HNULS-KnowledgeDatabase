<template>
  <div
    class="kb-chunking-panel flex-shrink-0 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden group shadow-sm"
  >
    <div
      class="absolute top-0 right-0 w-24 h-24 bg-blue-100/30 rounded-bl-full pointer-events-none"
    />
    <div
      class="absolute bottom-0 left-0 w-16 h-16 bg-indigo-100/30 rounded-tr-full pointer-events-none"
    />

    <div class="flex items-center justify-between mb-4 relative z-10">
      <div class="flex items-center gap-2">
        <div class="bg-blue-50 p-1 rounded-md">
          <svg
            class="w-4 h-4 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M8 9h8" />
            <path d="M8 13h6" />
          </svg>
        </div>
        <span class="text-sm font-bold tracking-wide text-slate-800">分块配置</span>
      </div>

      <!-- 配置状态指示 -->
      <div v-if="hasCustomChunkingConfig" class="flex items-center gap-2">
        <span
          class="text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
        >
          独立配置
        </span>
        <button
          class="text-xs text-slate-600 hover:text-blue-600 underline transition"
          @click="handleReset"
        >
          回正
        </button>
      </div>
    </div>

    <div class="space-y-4 relative z-10">
      <!-- 分块功能不可用提示 -->
      <div
        v-if="!canChunk"
        class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
      >
        <svg
          class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 9v4"></path>
          <path d="M12 17h.01"></path>
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path>
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-amber-800 mb-1">分块功能暂不可用</p>
          <p class="text-xs text-amber-700 leading-relaxed">
            {{ chunkingDisabledReason }}
          </p>
        </div>
      </div>

      <!-- 分块配置（仅在可用时显示） -->
      <template v-if="canChunk">
        <!-- 分块模式 -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-slate-700">分块模式</label>
          <WhiteSelect
            :model-value="effectiveMode"
            :options="chunkingModeOptions"
            :placeholder="`跟随全局设置 (${globalMode})`"
            @update:modelValue="handleModeChange"
          />
          <p class="text-xs text-slate-500 leading-relaxed">
            {{ selectedModeOption.description }}
          </p>
        </div>

        <!-- 单个分段最大字符数 -->
        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-slate-700">单个分段最大字符数</label>
          <input
            v-model.number="localMaxChars"
            type="number"
            min="100"
            max="10000"
            step="50"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition"
            :class="{
              'text-slate-400': !hasCustomMaxChars,
              'text-slate-900': hasCustomMaxChars
            }"
            :placeholder="`跟随全局设置 (${globalMaxChars})`"
            :disabled="!canChunk"
            @blur="handleSave"
          />
          <p class="text-xs text-slate-400">
            建议范围：500-2000 字符，过小可能导致上下文丢失，过大可能影响检索效果
          </p>
        </div>

        <!-- 重叠分块字符数（仅 semantic 模式） -->
        <div v-if="effectiveMode === 'semantic'" class="flex flex-col gap-2">
          <label class="text-xs font-medium text-slate-700">重叠分块字符数</label>
          <input
            v-model.number="localOverlapChars"
            type="number"
            min="0"
            :max="Math.max(0, (localMaxChars ?? globalMaxChars) - 1)"
            step="10"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition"
            :class="{
              'text-slate-400': !hasCustomOverlapChars,
              'text-slate-900': hasCustomOverlapChars
            }"
            :placeholder="`跟随全局设置 (${globalOverlapChars})`"
            :disabled="!canChunk"
            @blur="handleSave"
          />
          <p class="text-xs text-slate-400">建议范围：maxChars 的 10%~20%</p>
        </div>

        <!-- 分块操作按钮（左半分块，右半预览） -->
        <div class="pt-2">
          <div class="flex gap-2">
            <!-- 左半：分块按钮 -->
            <button
              class="flex-1 relative group/btn overflow-hidden rounded-lg border transition-all duration-300 py-2.5 shadow-sm"
              :class="
                !fileKey || isLoadingChunking || !canChunk
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
              "
              :disabled="!fileKey || isLoadingChunking || !canChunk"
              @click="$emit('start-chunking')"
            >
              <div
                class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold tracking-wider"
              >
                <svg
                  v-if="isLoadingChunking"
                  class="w-3.5 h-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <svg
                  v-else
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M16 13H8" />
                  <path d="M16 17H8" />
                  <path d="M10 9H8" />
                </svg>
                <span>{{ isLoadingChunking ? '分块中...' : '分块' }}</span>
              </div>
            </button>

            <!-- 右半：预览按钮 -->
            <button
              class="flex-1 relative group/btn overflow-hidden rounded-lg border transition-all duration-300 py-2.5 shadow-sm"
              :class="
                !fileKey || !hasChunks || isLoadingChunking
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 hover:shadow-md'
              "
              :disabled="!fileKey || !hasChunks || isLoadingChunking"
              @click="$emit('show-preview')"
            >
              <div
                class="relative z-10 flex items-center justify-center gap-2 text-xs font-bold tracking-wider"
              >
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>预览</span>
              </div>
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'

const props = defineProps<{
  fileKey: string
  knowledgeBaseId?: number
  canChunk: boolean
  chunkingDisabledReason: string
  isLoadingChunking: boolean
  hasChunks: boolean
}>()

defineEmits<{
  'start-chunking': []
  'show-preview': []
}>()

const configStore = useKnowledgeConfigStore()

// 分块模式选项（单向：由全局控制）
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

// 全局配置
const globalConfig = computed(() =>
  props.knowledgeBaseId ? configStore.getGlobalConfig(props.knowledgeBaseId) : null
)

const globalMode = computed<ChunkingMode>(() => globalConfig.value?.chunking.mode ?? 'recursive')
const globalMaxChars = computed(() => globalConfig.value?.chunking.maxChars ?? 1000)
const globalOverlapChars = computed(() =>
  globalConfig.value?.chunking.mode === 'semantic' ? globalConfig.value.chunking.overlapChars : 0
)

const selectedModeOption = computed(() => {
  return chunkingModeOptions.find((o) => o.value === effectiveMode.value) ?? chunkingModeOptions[0]
})

// 文档配置（单向：只覆盖数值，不覆盖 mode）
const rawDocChunking = computed(() => {
  if (!props.knowledgeBaseId || !props.fileKey) return undefined
  return configStore.getConfig(props.knowledgeBaseId)?.documents?.[props.fileKey]?.chunking
})

// 本地编辑值（文档级覆盖）
const localMode = ref<ChunkingMode | undefined>()
const localMaxChars = ref<number | undefined>()
const localOverlapChars = ref<number | undefined>()

const effectiveMode = computed<ChunkingMode>(() => localMode.value ?? globalMode.value)

const hasCustomMode = computed(() => localMode.value !== undefined && localMode.value !== globalMode.value)

const hasCustomMaxChars = computed(
  () => localMaxChars.value !== undefined && localMaxChars.value !== globalMaxChars.value
)

const hasCustomOverlapChars = computed(
  () =>
    effectiveMode.value === 'semantic' &&
    localOverlapChars.value !== undefined &&
    localOverlapChars.value !== globalOverlapChars.value
)

const hasCustomChunkingConfig = computed(
  () => hasCustomMode.value || hasCustomMaxChars.value || hasCustomOverlapChars.value
)

// 初始化配置
onMounted(async () => {
  if (props.knowledgeBaseId) {
    try {
      await configStore.loadConfig(props.knowledgeBaseId)
    } catch (error) {
      console.error('[ChunkingPanel] Failed to load config:', error)
    }
  }
})

// 监听配置变化
watch(
  rawDocChunking,
  (chunking) => {
    const chunkingAny = chunking as any
    localMode.value = chunkingAny?.mode
    localMaxChars.value = chunking?.maxChars
    localOverlapChars.value = chunkingAny?.overlapChars
  },
  { immediate: true }
)

const normalizeOverlap = (value: number, effectiveMaxChars: number) => {
  const upper = Math.max(0, effectiveMaxChars - 1)
  return Math.min(Math.max(0, Math.floor(value)), upper)
}

// 保存配置
const handleSave = async () => {
  if (!props.knowledgeBaseId || !props.fileKey) return

  try {
    if (!hasCustomChunkingConfig.value) {
      await configStore.clearDocumentConfig(props.knowledgeBaseId, props.fileKey)
      return
    }

    const chunking: any = {}

    if (hasCustomMode.value && localMode.value) {
      chunking.mode = localMode.value
    }

    if (hasCustomMaxChars.value && localMaxChars.value !== undefined) {
      chunking.maxChars = localMaxChars.value
    }

    if (hasCustomOverlapChars.value && localOverlapChars.value !== undefined) {
      const effectiveMax = chunking.maxChars ?? globalMaxChars.value
      chunking.overlapChars = normalizeOverlap(localOverlapChars.value, effectiveMax)
    }

    await configStore.updateDocumentConfig(props.knowledgeBaseId, props.fileKey, {
      chunking
    })
  } catch (error) {
    console.error('[ChunkingPanel] Failed to save config:', error)
  }
}

const handleModeChange = async (v: string | number | null) => {
  if (v !== 'recursive' && v !== 'semantic') return
  localMode.value = v
  await handleSave()
}

// 回正
const handleReset = async () => {
  if (!props.knowledgeBaseId || !props.fileKey) return

  try {
    localMode.value = undefined
    localMaxChars.value = undefined
    localOverlapChars.value = undefined
    await configStore.clearDocumentConfig(props.knowledgeBaseId, props.fileKey)
  } catch (error) {
    console.error('[ChunkingPanel] Failed to reset config:', error)
  }
}
</script>
