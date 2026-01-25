<template>
  <div class="kb-embedding-detail-view flex flex-col h-full bg-slate-50 overflow-hidden">
    <!-- Header/Banner Area -->
    <div class="bg-white border-b border-slate-200 px-8 py-6 flex-shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-bold text-slate-900">{{ configName }}</h2>
            <span
              class="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded tracking-wider"
              >轮询配置模式</span
            >
          </div>
          <p class="text-sm text-slate-500">
            配置该方案下的多个候选模型，系统将自动进行健康检查与负载均衡。
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all"
            @click="handleBack"
          >
            返回
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto p-8 space-y-8 min-h-0">
      <!-- Alert/Notice -->
      <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4">
        <div
          class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0"
        >
          <svg
            class="w-5 h-5 text-amber-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            ></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="flex-1 text-sm text-amber-900 py-1">
          <p class="font-bold mb-1">注意：模型兼容性原则</p>
          <p class="opacity-80">
            在一个配置方案中，所有的候选模型必须产出<strong>相同长度</strong>且针对<strong>相同词义空间</strong>优化的向量。通常建议仅选择同一个预设系列（如都是
            text-embedding-3-small）的不同提供商节点。
          </p>
        </div>
      </div>

      <!-- Candidate Section -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-bold text-slate-900">候选模型节点</h3>
            <span class="text-xs text-slate-400 font-normal"
              >({{ localCandidates.length }} 个节点)</span
            >
          </div>
          <button
            class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-all"
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
            添加候选节点
          </button>
        </div>

        <!-- Empty State -->
        <div
          v-if="localCandidates.length === 0"
          class="bg-white border-2 border-dashed border-slate-200 rounded-2xl py-12 flex flex-col items-center justify-center text-slate-400"
        >
          <svg
            class="w-12 h-12 mb-4 opacity-20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            ></path>
          </svg>
          <p class="text-sm">暂无候选节点，请点击上方按钮添加</p>
        </div>

        <!-- List -->
        <div v-else class="space-y-3">
          <div
            v-for="(candidate, index) in localCandidates"
            :key="candidate.providerId + candidate.modelId"
            class="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between group hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div class="flex items-center gap-4">
              <div
                class="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 font-mono text-xs font-bold transition-colors"
              >
                {{ index + 1 }}
              </div>
              <div>
                <div class="font-bold text-slate-900 flex items-center gap-2">
                  {{ getModelName(candidate) }}
                  <span
                    v-if="index === 0"
                    class="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-md font-bold uppercase tracking-tight"
                    >首选</span
                  >
                </div>
                <div class="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span class="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">{{
                    getProviderName(candidate)
                  }}</span>
                  <span class="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span class="font-mono">{{ candidate.modelId }}</span>
                </div>
              </div>
            </div>

            <div
              class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                class="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                @click="moveCandidate(index, -1)"
                :disabled="index === 0"
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
                class="p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors"
                @click="moveCandidate(index, 1)"
                :disabled="index === localCandidates.length - 1"
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
              <div class="w-px h-4 bg-slate-100 mx-1"></div>
              <button
                class="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                @click="removeCandidate(index)"
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
        </div>
      </div>
    </div>

    <!-- Dialogs -->
    <ModelSelectDialog
      v-model="showModelDialog"
      :multiple="true"
      @select-multiple="handleCandidatesSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import type { EmbeddingModelCandidate } from '@preload/types'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'
import ModelSelectDialog from './ModelSelectDialog.vue'

const props = defineProps<{
  knowledgeBaseId: number
  configId: string
  configName: string
  initialCandidates: EmbeddingModelCandidate[]
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const knowledgeConfigStore = useKnowledgeConfigStore()
const modelConfigStore = useUserModelConfigStore()
const showModelDialog = ref(false)
const localCandidates = ref<EmbeddingModelCandidate[]>([])

onMounted(() => {
  localCandidates.value = JSON.parse(JSON.stringify(props.initialCandidates))
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

// 自动保存到 Store
async function autoSave() {
  await knowledgeConfigStore.updateEmbeddingCandidates(
    props.knowledgeBaseId,
    props.configId,
    localCandidates.value
  )
}

async function moveCandidate(index: number, direction: number) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= localCandidates.value.length) return
  const temp = localCandidates.value[index]
  localCandidates.value[index] = localCandidates.value[newIndex]
  localCandidates.value[newIndex] = temp

  // 自动保存
  await autoSave()
}

async function removeCandidate(index: number) {
  localCandidates.value.splice(index, 1)

  // 自动保存
  await autoSave()
}

async function handleCandidatesSelected(
  selections: Array<{ providerId: string; modelId: string }>
) {
  const existingKeys = new Set(localCandidates.value.map((c) => `${c.providerId}:${c.modelId}`))
  selections.forEach((sel) => {
    if (!existingKeys.has(`${sel.providerId}:${sel.modelId}`)) {
      localCandidates.value.push({ ...sel })
    }
  })

  // 自动保存
  await autoSave()
}

function handleBack() {
  emit('back')
}
</script>
