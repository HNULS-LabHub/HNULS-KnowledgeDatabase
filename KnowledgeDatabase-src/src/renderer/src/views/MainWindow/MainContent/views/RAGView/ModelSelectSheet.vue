<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="kb-rag-model-sheet fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
        @click="close"
      >
        <Transition
          enter-active-class="transition-transform duration-200 ease-out"
          enter-from-class="translate-y-full"
          enter-to-class="translate-y-0"
          leave-active-class="transition-transform duration-150 ease-in"
          leave-from-class="translate-y-0"
          leave-to-class="translate-y-full"
        >
          <div
            v-if="modelValue"
            class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl flex flex-col"
            style="max-height: 85vh"
            @click.stop
          >
            <!-- Header -->
            <div
              class="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0"
            >
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-900 truncate">{{ title }}</div>
                <div class="text-xs text-slate-500 mt-1">
                  {{ subtitle }}
                </div>
              </div>
              <button
                class="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-2 transition-colors"
                type="button"
                @click="close"
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

            <!-- Search -->
            <div class="px-5 py-3 border-b border-slate-100 flex-shrink-0">
              <div class="relative">
                <svg
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input
                  v-model="search"
                  type="text"
                  class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="搜索模型..."
                />
              </div>
              <p v-if="hint" class="text-[11px] text-slate-400 mt-2 mb-0">
                {{ hint }}
              </p>
            </div>

            <!-- List -->
            <div class="px-5 py-4 overflow-y-auto flex-1 min-h-0">
              <div v-if="providersReady.length === 0" class="text-center py-10 text-slate-400">
                <p class="text-sm m-0">没有可用的模型</p>
                <p class="text-xs mt-2 m-0">请先到「模型管理」添加并启用提供商与模型。</p>
              </div>

              <div v-else class="space-y-4">
                <div
                  v-for="p in filteredProviders"
                  :key="p.id"
                  class="border border-slate-200 rounded-2xl overflow-hidden"
                >
                  <div
                    class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2"
                  >
                    <div class="text-xs font-semibold text-slate-700 truncate">{{ p.name }}</div>
                    <div class="text-[10px] text-slate-400">{{ p.models.length }} 个</div>
                  </div>

                  <div class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      v-for="m in p.models"
                      :key="m.id"
                      type="button"
                      class="text-left px-3 py-2 rounded-xl border transition-all"
                      :class="
                        m.id === currentModelId
                          ? 'bg-indigo-50 border-indigo-300'
                          : 'bg-white border-slate-200 hover:border-indigo-200'
                      "
                      @click="select(m.id)"
                    >
                      <div class="text-sm font-medium text-slate-900 truncate">{{ m.name }}</div>
                      <div class="text-[10px] text-slate-500 font-mono truncate">{{ m.id }}</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'

type Mode = 'llm' | 'rerank'

const props = defineProps<{
  modelValue: boolean
  mode: Mode
  title: string
  currentModelId?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', modelId: string): void
}>()

const modelConfigStore = useUserModelConfigStore()
const search = ref('')

const subtitle = computed(() => {
  return props.mode === 'rerank' ? '选择用于重排的模型' : '选择用于回答生成的 LLM 模型'
})

const hint = computed(() => {
  if (props.mode === 'rerank') return '选择用于重排的模型'
  return '选择用于 LLM 生成回答的模型'
})

function close(): void {
  emit('update:modelValue', false)
}

function select(modelId: string): void {
  emit('select', modelId)
  close()
}

// providers（可用）= enabled + 有 baseUrl/apiKey + 有 models
const providersReady = computed(() => {
  return modelConfigStore.providers.filter(
    (p) => p.enabled && !!p.apiKey && !!p.baseUrl && p.models.length > 0
  )
})

const filteredProviders = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return providersReady.value

  return providersReady.value
    .map((p) => ({
      ...p,
      models: p.models.filter((m) => {
        const s = `${m.id} ${m.name}`.toLowerCase()
        return s.includes(q)
      })
    }))
    .filter((p) => p.models.length > 0)
})

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    // 打开时加载 providers
    if (modelConfigStore.providers.length === 0) {
      await modelConfigStore.fetchProviders()
    }

    // reset search
    search.value = ''
  }
)
</script>
