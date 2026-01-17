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
          v-model="chunkingConfig.mode"
          :options="chunkingModeOptions"
          placeholder="请选择分块模式"
          @change="handleModeChange"
        />
        <!-- 模式描述 -->
        <p
          v-if="selectedModeDescription"
          class="kb-chunking-mode-desc mt-2 text-xs text-slate-500 leading-relaxed"
        >
          {{ selectedModeDescription }}
        </p>
      </div>

      <!-- 单个分段最大字符数 -->
      <div class="kb-chunking-max-chars">
        <label class="kb-chunking-label block text-sm font-medium text-slate-700 mb-2">
          单个分段最大字符数
        </label>
        <input
          v-model.number="chunkingConfig.maxChars"
          type="number"
          min="100"
          max="10000"
          step="50"
          class="kb-chunking-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例如：1000"
        />
        <p class="kb-chunking-hint mt-1 text-xs text-slate-400">
          建议范围：500-2000 字符，过小可能导致上下文丢失，过大可能影响检索效果
        </p>
      </div>

      <!-- 预览按钮 -->
      <div class="kb-chunking-preview">
        <button
          class="kb-chunking-preview-btn px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors duration-200"
          @click="showPreviewDialog = true"
        >
          预览
        </button>
      </div>
    </div>

    <!-- 预览对话框 -->
    <ChunkingPreviewDialog v-model:visible="showPreviewDialog" :config="chunkingConfig" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import ChunkingPreviewDialog from './ChunkingPreviewDialog.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

// 分块模式选项
const chunkingModeOptions = [
  {
    label: '固定大小分块',
    value: 'fixed-size',
    description:
      '按照固定字符数进行分块，简单直接。适合结构化文档，但可能在句子或段落中间截断，导致语义不完整。'
  },
  {
    label: '语义分块',
    value: 'semantic',
    description:
      '基于语义相似度进行分块，保持语义完整性。适合长文档和需要保持上下文连贯的场景，分块质量更高。'
  },
  {
    label: '滑动窗口分块',
    value: 'sliding-window',
    description:
      '使用滑动窗口机制，在固定大小的基础上增加重叠区域。适合需要保持上下文连续性的场景，但会产生更多分块。'
  },
  {
    label: '递归分块',
    value: 'recursive',
    description:
      '递归地将文档分割成更小的块，优先保持段落、句子等自然边界。适合层次化文档结构，分块更加精细。'
  }
]

const chunkingConfig = ref({
  mode: 'semantic',
  maxChars: 1000
})

const selectedModeDescription = computed(() => {
  const selected = chunkingModeOptions.find((opt) => opt.value === chunkingConfig.value.mode)
  return selected?.description || ''
})

const showPreviewDialog = ref(false)

const handleModeChange = (value: string | number | null) => {
  console.log('[ChunkingSection] Mode changed to:', value)
  // TODO: 保存配置到 store 或 API
}
</script>
