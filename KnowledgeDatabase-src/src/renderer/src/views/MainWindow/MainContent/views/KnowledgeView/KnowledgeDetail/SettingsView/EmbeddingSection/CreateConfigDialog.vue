<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      @click="$emit('update:modelValue', false)"
    >
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="scale-95 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-if="modelValue"
          class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200"
          @click.stop
        >
          <!-- Header -->
          <div
            class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50"
          >
            <div>
              <h2 class="text-xl font-bold text-slate-900">创建嵌入模型配置</h2>
              <p class="text-sm text-slate-500 mt-0.5">为您当前的知识库定义一套新的嵌入方案</p>
            </div>
            <button
              class="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
              @click="$emit('update:modelValue', false)"
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
            <!-- Basic Info -->
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-sm font-semibold text-slate-700">配置名称</label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="例如: 生产环境主模型, 测试配置 等"
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <!-- Quick Selection from Presets -->
              <div class="space-y-3">
                <label class="text-sm font-semibold text-slate-700 block"
                  >选择常用模型预设 (快速填写)</label
                >
                <div class="grid grid-cols-2 gap-3">
                  <button
                    v-for="preset in presets"
                    :key="preset.id"
                    type="button"
                    class="flex flex-col items-start p-3 rounded-xl border text-left transition-all group"
                    :class="
                      form.presetId === preset.id
                        ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                        : 'bg-white border-slate-200 hover:border-blue-200'
                    "
                    @click="applyPreset(preset)"
                  >
                    <span
                      class="text-xs font-bold text-slate-400 group-hover:text-blue-500 mb-1 uppercase tracking-wider"
                      >{{ preset.id.includes('openai') ? 'OpenAI' : 'OpenSource' }}</span
                    >
                    <span class="text-sm font-semibold text-slate-900 mb-1">{{ preset.name }}</span>
                    <span class="text-[10px] text-slate-400"
                      >推荐维度: {{ preset.defaultDimensions }}</span
                    >
                  </button>
                </div>
              </div>

              <!-- Dimension -->
              <div class="space-y-2">
                <label class="text-sm font-semibold text-slate-700">
                  嵌入维度
                  <span class="font-normal text-slate-400">(可选)</span>
                </label>
                <input
                  v-model.number="form.dimensions"
                  type="number"
                  placeholder="留空即使用模型默认值"
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              @click="$emit('update:modelValue', false)"
            >
              取消
            </button>
            <button
              class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!form.name"
              @click="handleSubmit"
            >
              确认并开始详细配置
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { EMBEDDING_PRESETS, type EmbeddingPreset } from './presets'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', data: { name: string; presetId?: string; dimensions?: number }): void
}>()

const presets = EMBEDDING_PRESETS

const form = reactive({
  name: '',
  presetId: undefined as string | undefined,
  dimensions: undefined as number | undefined
})

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      form.name = ''
      form.presetId = undefined
      form.dimensions = undefined
    }
  }
)

function applyPreset(preset: EmbeddingPreset) {
  form.presetId = preset.id
  form.name = preset.name
  form.dimensions = preset.defaultDimensions
}

function handleSubmit() {
  if (!form.name) return
  emit('submit', { ...form })
  emit('update:modelValue', false)
}
</script>
