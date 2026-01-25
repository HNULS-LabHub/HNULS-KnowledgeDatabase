<template>
  <div class="kb-embedding-detail flex flex-col h-full bg-white">
    <!-- Header with Breadcrumb-like Back -->
    <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
      <button
        class="flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors text-sm"
        @click="$emit('back')"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>返回嵌入配置</span>
      </button>
      <div class="h-4 w-px bg-slate-200 mx-1"></div>
      <span class="text-sm font-semibold text-slate-800">{{ preset.name }} 配置</span>
    </div>

    <div class="p-6 space-y-6 flex-1 overflow-y-auto">
      <!-- Info Box -->
      <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <svg
          class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div class="text-sm text-blue-900">
          <p class="font-medium mb-1">多模型轮询配置</p>
          <p class="text-blue-700/80">
            您可以配置多个提供商的
            <strong>{{ preset.name }}</strong>
            模型作为候选项。系统将按照列表顺序进行轮询或负载均衡。
            <br />
            <span class="font-semibold text-red-500">注意：</span>
            请务必确保选中的模型实际上是同一种模型架构（{{
              preset.id
            }}），否则会导致生成的向量不兼容，严重影响检索效果。
          </p>
        </div>
      </div>

      <!-- Candidate List -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-slate-700">候选模型列表</label>
          <button
            class="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            @click="showModelDialog = true"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            添加模型
          </button>
        </div>

        <div
          v-if="localCandidates.length === 0"
          class="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400"
        >
          暂无配置的模型，请点击右上角添加。
        </div>

        <transition-group name="list" tag="div" class="space-y-2">
          <div
            v-for="(candidate, index) in localCandidates"
            :key="candidate.providerId + candidate.modelId"
            class="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-200 hover:shadow-sm transition-all group"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-400 font-mono text-xs"
              >
                {{ index + 1 }}
              </div>
              <div>
                <div class="text-sm font-medium text-slate-900">{{ getModelName(candidate) }}</div>
                <div class="text-xs text-slate-500 flex items-center gap-2">
                  <span>{{ getProviderName(candidate) }}</span>
                  <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span class="font-mono">{{ candidate.modelId }}</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div
              class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                :disabled="index === 0"
                @click="moveCandidate(index, -1)"
                title="上移"
              >
                <svg
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </button>
              <button
                class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                :disabled="index === localCandidates.length - 1"
                @click="moveCandidate(index, 1)"
                title="下移"
              >
                <svg
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <button
                class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded ml-2"
                @click="removeCandidate(index)"
                title="移除"
              >
                <svg
                  class="w-4 h-4"
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
          </div>
        </transition-group>
      </div>

      <!-- Dimensions (Optional Override) -->
      <div class="pt-6 border-t border-slate-100">
        <label class="block text-sm font-medium text-slate-700 mb-2">
          嵌入维度
          <span class="text-slate-400 font-normal"
            >(可选，默认 {{ preset.defaultDimensions }})</span
          >
        </label>
        <input
          v-model.number="localDimensions"
          type="number"
          min="1"
          :placeholder="`默认为 ${preset.defaultDimensions}`"
          class="w-full max-w-xs px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        <p class="mt-1 text-xs text-slate-500">仅在模型未正确返回维度或需强制指定时填写。</p>
      </div>

      <!-- Save Actions -->
      <div class="pt-6 flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          @click="$emit('back')"
        >
          取消
        </button>
        <button
          class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
          @click="handleSave"
        >
          保存配置
        </button>
      </div>
    </div>

    <!-- Model Select Dialog -->
    <ModelSelectDialog
      v-model="showModelDialog"
      :multiple="true"
      @select-multiple="handleCandidatesSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { EmbeddingPreset } from './presets'
import type { EmbeddingModelCandidate } from '@preload/types'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'
import ModelSelectDialog from './ModelSelectDialog.vue'

const props = defineProps<{
  preset: EmbeddingPreset
  initialCandidates: EmbeddingModelCandidate[]
  initialDimensions?: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'save', candidates: EmbeddingModelCandidate[], dimensions?: number): void
}>()

const modelConfigStore = useUserModelConfigStore()
const showModelDialog = ref(false)
const localCandidates = ref<EmbeddingModelCandidate[]>([])
const localDimensions = ref<number | undefined>(undefined)

onMounted(() => {
  localCandidates.value = [...props.initialCandidates]
  localDimensions.value = props.initialDimensions
})

function getProviderName(candidate: EmbeddingModelCandidate) {
  const p = modelConfigStore.providers.find((p) => p.id === candidate.providerId)
  return p ? p.name : candidate.providerId
}

function getModelName(candidate: EmbeddingModelCandidate) {
  const p = modelConfigStore.providers.find((p) => p.id === candidate.providerId)
  const m = p?.models.find((m) => m.id === candidate.modelId)
  return m ? m.name : candidate.modelId
}

function moveCandidate(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= localCandidates.value.length) return

  const temp = localCandidates.value[index]
  localCandidates.value[index] = localCandidates.value[newIndex]
  localCandidates.value[newIndex] = temp
}

function removeCandidate(index: number) {
  localCandidates.value.splice(index, 1)
}

function handleCandidatesSelected(selections: Array<{ providerId: string; modelId: string }>) {
  // Avoid duplicates
  const existingKeys = new Set(localCandidates.value.map((c) => `${c.providerId}:${c.modelId}`))

  selections.forEach((sel) => {
    if (!existingKeys.has(`${sel.providerId}:${sel.modelId}`)) {
      localCandidates.value.push({
        providerId: sel.providerId,
        modelId: sel.modelId
      })
    }
  })
}

function handleSave() {
  emit('save', localCandidates.value, localDimensions.value)
}
</script>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-active {
  position: absolute;
}
</style>
