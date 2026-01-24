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
      class="kb-embedding-model-dialog fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      @click="handleClose"
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
          class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-gray-200"
          @click.stop
        >
          <!-- Header -->
          <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div class="flex flex-col">
              <h2 class="text-xl font-bold text-gray-900">选择嵌入模型</h2>
              <p class="text-sm text-gray-500 mt-1">从已配置的模型提供商中选择嵌入模型</p>
            </div>
            <button
              class="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
              @click="handleClose"
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

          <!-- Search & Filter -->
          <div class="px-6 py-4 border-b border-gray-100 space-y-3">
            <!-- Search Input -->
            <div class="relative">
              <svg
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索模型..."
                class="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <!-- Filter Tags -->
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="tag in filterTags"
                :key="tag.id"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all"
                :class="
                  selectedTags.includes(tag.id)
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                "
                @click="toggleTag(tag.id)"
              >
                {{ tag.label }}
              </button>
            </div>
          </div>

          <!-- Model List -->
          <div class="flex-1 overflow-y-auto p-6">
            <div v-if="filteredProviders.length === 0" class="text-center py-12 text-gray-400">
              <p class="text-sm">未找到匹配的模型</p>
              <p class="text-xs mt-1">请尝试调整搜索条件或前往模型管理添加模型</p>
            </div>

            <div v-else class="space-y-6">
              <div
                v-for="provider in filteredProviders"
                :key="provider.id"
                class="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden"
              >
                <!-- Provider Header -->
                <div class="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 bg-gray-50"
                  >
                    <svg
                      class="w-4 h-4 text-gray-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                      <line x1="6" y1="6" x2="6.01" y2="6"></line>
                      <line x1="6" y1="18" x2="6.01" y2="18"></line>
                    </svg>
                  </div>
                  <div class="flex flex-col">
                    <span class="text-sm font-semibold text-gray-900">{{ provider.name }}</span>
                    <span class="text-xs text-gray-500">{{ provider.models.length }} 个模型</span>
                  </div>
                </div>

                <!-- Models Grid -->
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    v-for="model in provider.models"
                    :key="model.id"
                    class="group relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
                    :class="
                      (multiple ? selectedModelIds.has(model.id) : selectedModelId === model.id)
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                    "
                    @click="handleSelectModel(provider.id, model.id)"
                  >
                    <!-- Selection Indicator -->
                      <div
                        class="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                        :class="
                          (multiple ? selectedModelIds.has(model.id) : selectedModelId === model.id)
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 group-hover:border-blue-300'
                        "
                      >
                        <svg
                          v-if="(multiple ? selectedModelIds.has(model.id) : selectedModelId === model.id)"
                          class="w-3 h-3 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                        >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>

                    <!-- Model Info -->
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm text-gray-900 truncate">{{ model.name }}</div>
                      <div class="text-xs text-gray-500 truncate font-mono">{{ model.id }}</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center rounded-b-2xl">
            <button
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              @click="handleClose"
            >
              取消
            </button>
            <button
              class="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="multiple ? selectedModelIds.size === 0 : !selectedModelId"
              @click="handleConfirm"
            >
              确认选择
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'
import type { FilterTag } from './types'

const props = defineProps<{
  modelValue: boolean
  currentProviderId?: string
  currentModelId?: string
  multiple?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', providerId: string, modelId: string): void
  (e: 'select-multiple', selections: Array<{ providerId: string; modelId: string }>): void
}>()

const modelConfigStore = useUserModelConfigStore()

// 搜索和筛选状态
const searchQuery = ref('')
const selectedTags = ref<string[]>([])
const selectedModelId = ref<string | undefined>(props.currentModelId)
const selectedModelIds = ref<Set<string>>(new Set())

// 确保模型数据已加载
onMounted(async () => {
  if (modelConfigStore.providers.length === 0) {
    await modelConfigStore.fetchProviders()
  }
})

// 监听对话框打开，确保数据已加载
watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      // 对话框打开时，确保数据已加载
      if (modelConfigStore.providers.length === 0) {
        await modelConfigStore.fetchProviders()
      }
      
      // 初始化选中状态
      if (props.multiple) {
        selectedModelIds.value.clear()
        if (props.currentModelId) {
          selectedModelIds.value.add(props.currentModelId)
        }
      }
    }
  }
)

// 筛选标签
const filterTags: FilterTag[] = [
  { id: 'all', label: '按标签筛选' },
  { id: 'vision', label: '视觉' },
  { id: 'reasoning', label: '推理' },
  { id: 'tool', label: '工具' },
  { id: 'web', label: '联网' },
  { id: 'free', label: '免费' }
]

// 监听当前选中的模型变化
watch(
  () => props.currentModelId,
  (newVal) => {
    selectedModelId.value = newVal
  }
)

// 切换标签
function toggleTag(tagId: string): void {
  if (tagId === 'all') {
    selectedTags.value = []
    return
  }
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagId)
  }
}

// 过滤后的提供商列表
const filteredProviders = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()

  return modelConfigStore.providers
    .filter((provider) => provider.enabled && provider.models.length > 0)
    .map((provider) => {
      const filteredModels = provider.models.filter((model) => {
        // 搜索过滤
        if (query) {
          const matchesSearch =
            model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query)
          if (!matchesSearch) return false
        }

        // 标签过滤（暂时不实现，因为需要模型能力信息）
        // 这里可以根据 model.id 或 model.group 进行简单判断

        return true
      })

      return {
        ...provider,
        models: filteredModels
      }
    })
    .filter((provider) => provider.models.length > 0)
})

// 选择模型
function handleSelectModel(_providerId: string, modelId: string): void {
  // providerId is available if needed for validaton, but currently unused
  if (props.multiple) {
    if (selectedModelIds.value.has(modelId)) {
      selectedModelIds.value.delete(modelId)
    } else {
      selectedModelIds.value.add(modelId)
    }
  } else {
    selectedModelId.value = modelId
  }
}

// 确认选择
function handleConfirm(): void {
  if (props.multiple) {
    if (selectedModelIds.value.size === 0) return
    
    const selections: Array<{ providerId: string; modelId: string }> = []
    
    // 遍历所有 provider 找到选中的 model
    modelConfigStore.providers.forEach(p => {
      p.models.forEach(m => {
        if (selectedModelIds.value.has(m.id)) {
          selections.push({ providerId: p.id, modelId: m.id })
        }
      })
    })
    
    emit('select-multiple', selections)
    handleClose()
    
  } else {
    if (!selectedModelId.value) return

    // 找到对应的 provider
    const provider = modelConfigStore.providers.find((p) =>
      p.models.some((m) => m.id === selectedModelId.value)
    )

    if (provider) {
      emit('select', provider.id, selectedModelId.value)
      handleClose()
    }
  }
}

// 关闭对话框
function handleClose(): void {
  emit('update:modelValue', false)
}
</script>
