<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="kb-chunking-preview-overlay" @click="handleClose">
        <Transition name="dialog-scale">
          <div v-if="visible" class="kb-chunking-preview-dialog" @click.stop>
            <!-- 头部 -->
            <div
              class="kb-chunking-preview-header flex items-center justify-between p-4 border-b border-slate-200"
            >
              <h3 class="kb-chunking-preview-title text-lg font-semibold text-slate-900 m-0">
                分块预览
              </h3>
              <button
                class="kb-chunking-preview-close w-8 h-8 flex items-center justify-center border-none bg-transparent text-slate-400 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                @click="handleClose"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="w-5 h-5"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <!-- 内容区 -->
            <div class="kb-chunking-preview-body p-4 overflow-y-auto max-h-[60vh]">
              <p class="kb-chunking-preview-desc text-sm text-slate-600 mb-4">
                以下是根据当前配置生成的示例分块预览（使用 Mock 数据）：
              </p>

              <!-- 手风琴组件 -->
              <Accordion :items="mockChunks" class="kb-chunking-preview-accordion">
                <template
                  v-for="(chunk, index) in mockChunks"
                  :key="index"
                  #[`item-${index}`]="{ item }"
                >
                  <div class="kb-chunking-preview-chunk">
                    <div
                      class="kb-chunking-preview-chunk-header flex items-center justify-between mb-2"
                    >
                      <span class="kb-chunking-preview-chunk-id text-xs font-mono text-slate-400">
                        分块 #{{ index + 1 }}
                      </span>
                      <span class="kb-chunking-preview-chunk-size text-xs text-slate-500">
                        {{ item.size }} 字符
                      </span>
                    </div>
                    <div
                      class="kb-chunking-preview-chunk-content text-sm text-slate-700 leading-relaxed whitespace-pre-wrap"
                    >
                      {{ item.content }}
                    </div>
                  </div>
                </template>
              </Accordion>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Accordion from '@renderer/components/accordion/index.vue'

const props = defineProps<{
  visible: boolean
  config: {
    mode: string
    maxChars: number
  }
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

// Mock 分块数据
const mockChunks = computed(() => {
  const chunks = []
  const sampleTexts = [
    '这是第一个分块的示例内容。它展示了如何根据配置的分块模式将文档分割成更小的片段。分块的质量直接影响后续的检索和嵌入效果。',
    '第二个分块包含了更多的上下文信息。在语义分块模式下，系统会尽量保持语义的完整性，避免在句子或段落中间截断。',
    '第三个分块展示了滑动窗口的效果。通过重叠区域，可以确保重要的上下文信息不会丢失，同时保持分块之间的一定连续性。',
    '最后一个分块演示了递归分块的层次化特性。系统会优先按照文档的自然结构（如段落、章节）进行分割，然后再进行细粒度的分块。'
  ]

  for (let i = 0; i < 4; i++) {
    chunks.push({
      title: `分块 ${i + 1}`,
      content: sampleTexts[i] || `这是第 ${i + 1} 个分块的示例内容。`,
      size: Math.floor(Math.random() * 200 + 300)
    })
  }

  return chunks
})

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.kb-chunking-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.kb-chunking-preview-dialog {
  background: white;
  border-radius: 1rem;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.kb-chunking-preview-chunk {
  padding: 0.5rem 0;
}

.kb-chunking-preview-chunk-content {
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #e2e8f0;
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 300ms ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active,
.dialog-scale-leave-active {
  transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-enter-from,
.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-1rem);
}
</style>
