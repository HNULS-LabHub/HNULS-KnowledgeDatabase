<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="modelValue"
        class="kb-batch-embedding-dialog-overlay fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
        @click="handleClose"
      >
        <Transition name="dialog-scale">
          <div
            v-if="modelValue"
            class="kb-batch-embedding-dialog-container bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            @click.stop
          >
            <!-- Header -->
            <div class="px-6 py-5 border-b border-slate-100">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md"
                  >
                    <svg
                      class="w-5 h-5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                      ></path>
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-lg font-bold text-slate-900">批量嵌入</h3>
                    <p class="text-xs text-slate-500 mt-0.5">已选中 {{ selectedCount }} 个文件</p>
                  </div>
                </div>
                <button
                  class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
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
            </div>

            <!-- Content -->
            <div class="px-6 py-5 space-y-4">
              <!-- 提示信息 -->
              <div class="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
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
                <div class="flex-1 text-sm text-blue-900">
                  <p class="font-medium mb-1">批量嵌入说明</p>
                  <p class="text-blue-700">
                    将为所有已分块的文件生成向量嵌入。未分块的文件将被自动跳过。
                  </p>
                </div>
              </div>

              <!-- 模型选择 -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700"> 选择嵌入模型配置 </label>
                <WhiteSelect
                  v-model="selectedConfigId"
                  :options="configOptions"
                  placeholder="请选择嵌入模型配置"
                />
                <p v-if="configOptions.length === 0" class="text-xs text-amber-600">
                  当前知识库尚未配置嵌入模型，请先在设置中添加配置
                </p>
                <p v-else-if="!defaultConfigId" class="text-xs text-amber-600">
                  建议在设置中配置默认嵌入模型，方便快速批量嵌入
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
              <button
                class="flex-1 px-4 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-medium text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
                @click="handleClose"
              >
                取消
              </button>
              <button
                class="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
                :disabled="!selectedConfigId || configOptions.length === 0"
                @click="handleConfirm"
              >
                确认嵌入
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useKnowledgeConfigStore } from '@renderer/stores/knowledge-library/knowledge-config.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'

const props = defineProps<{
  modelValue: boolean
  selectedCount: number
  knowledgeBaseId: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'confirm', configId: string): void
}>()

const configStore = useKnowledgeConfigStore()
const selectedConfigId = ref<string | null>(null)

// 获取默认配置ID
const defaultConfigId = computed(() =>
  configStore.getDefaultEmbeddingConfigId(props.knowledgeBaseId)
)

// 获取嵌入模型配置选项
const configOptions = computed(() => {
  const configs = configStore.getEmbeddingConfigs(props.knowledgeBaseId)
  return configs.map((config) => ({
    label: `${config.name} (${config.candidates.length} 节点)${config.id === defaultConfigId.value ? ' [默认]' : ''}`,
    value: config.id
  }))
})

// 监听对话框打开，加载配置
watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      await configStore.loadConfig(props.knowledgeBaseId)
      // 优先使用默认配置
      if (defaultConfigId.value) {
        selectedConfigId.value = defaultConfigId.value
      } else if (configOptions.value.length === 1) {
        // 如果只有一个配置，自动选中
        selectedConfigId.value = configOptions.value[0].value as string
      }
    } else {
      // 关闭时重置选择
      selectedConfigId.value = null
    }
  }
)

const handleClose = (): void => {
  emit('update:modelValue', false)
}

const handleConfirm = (): void => {
  if (!selectedConfigId.value) return
  emit('confirm', selectedConfigId.value)
  handleClose()
}
</script>

<style scoped>
/* Dialog Fade Animation */
.dialog-fade-enter-active {
  transition: opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
.dialog-fade-leave-active {
  transition: opacity 200ms cubic-bezier(0.4, 0, 1, 1);
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

/* Dialog Scale Animation */
.dialog-scale-enter-active {
  transition:
    transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
.dialog-scale-leave-active {
  transition:
    transform 250ms cubic-bezier(0.4, 0, 1, 1),
    opacity 200ms cubic-bezier(0.4, 0, 1, 1);
}
.dialog-scale-enter-from {
  transform: scale(0.95) translateY(-10px);
  opacity: 0;
}
.dialog-scale-leave-to {
  transform: scale(0.98) translateY(5px);
  opacity: 0;
}
</style>
