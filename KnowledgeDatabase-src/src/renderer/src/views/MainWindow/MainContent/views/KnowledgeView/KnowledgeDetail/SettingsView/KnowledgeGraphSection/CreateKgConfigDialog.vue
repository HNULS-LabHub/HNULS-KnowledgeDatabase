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
          class="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200"
          @click.stop
        >
          <!-- Header -->
          <div
            class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50"
          >
            <div>
              <h2 class="text-xl font-bold text-slate-900">创建知识图谱配置</h2>
              <p class="text-sm text-slate-500 mt-0.5">创建后可进入详情页配置具体参数</p>
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="p-6 space-y-5">
            <!-- 配置名称 -->
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">配置名称</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="例如: 默认图谱方案, 精细提取 等"
                class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <!-- 关联嵌入配置 -->
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">关联嵌入配置</label>
              <WhiteSelect
                v-model="form.embeddingConfigId"
                :options="embeddingOptions"
                placeholder="请选择关联的嵌入配置"
              />
              <p class="text-xs text-slate-400">知识图谱构建将基于所选嵌入配置的向量数据</p>
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
              :disabled="!canSubmit"
              @click="handleSubmit"
            >
              确认并进入详细配置
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import type { EmbeddingModelConfig } from '@preload/types'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'

const props = defineProps<{
  modelValue: boolean
  embeddingConfigs: EmbeddingModelConfig[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', data: { name: string; embeddingConfigId: string }): void
}>()

const form = reactive({
  name: '',
  embeddingConfigId: ''
})

const embeddingOptions = computed(() =>
  props.embeddingConfigs.map((c) => ({
    label: `${c.name} (${c.candidates.length} 节点)`,
    value: c.id
  }))
)

const canSubmit = computed(() => form.name && form.embeddingConfigId)

function getEmbeddingName(id: string): string {
  return props.embeddingConfigs.find((c) => c.id === id)?.name ?? ''
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      form.name = ''
      form.embeddingConfigId = ''
    }
  }
)

watch(
  () => form.embeddingConfigId,
  (id) => {
    if (id) {
      form.name = `Graph-${getEmbeddingName(id)}`
    }
  }
)

function handleSubmit(): void {
  if (!canSubmit.value) return
  emit('submit', { name: form.name, embeddingConfigId: form.embeddingConfigId })
  emit('update:modelValue', false)
}
</script>
