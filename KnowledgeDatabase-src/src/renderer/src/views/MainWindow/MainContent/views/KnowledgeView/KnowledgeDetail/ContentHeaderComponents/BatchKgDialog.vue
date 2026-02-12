<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="modelValue"
        class="kb-batch-kg-dialog-overlay fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
        @click="handleClose"
      >
        <Transition name="dialog-scale">
          <div
            v-if="modelValue"
            class="kb-batch-kg-dialog-container bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            @click.stop
          >
            <!-- Header -->
            <div class="px-6 py-5 border-b border-slate-100">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md"
                  >
                    <svg
                      class="w-5 h-5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="6" cy="12" r="2" />
                      <circle cx="18" cy="6" r="2" />
                      <circle cx="18" cy="18" r="2" />
                      <path d="M7.7 11.2l8-4.4" />
                      <path d="M7.7 12.8l8 4.4" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-lg font-bold text-slate-900">批量构建知识图谱</h3>
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
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="px-6 py-5 space-y-4">
              <div
                class="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl"
              >
                <svg
                  class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div class="flex-1 text-sm text-emerald-900">
                  <p class="font-medium mb-1">批量构建说明</p>
                  <p class="text-emerald-700">
                    仅对在所选配置关联的嵌入方案中已完成嵌入的文档执行构建。未嵌入的文档将被跳过。
                  </p>
                </div>
              </div>

              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700">选择知识图谱配置</label>
                <WhiteSelect
                  v-model="selectedKgConfigId"
                  :options="kgConfigOptions"
                  placeholder="请选择知识图谱配置"
                />
                <p v-if="kgConfigOptions.length === 0" class="text-xs text-amber-600">
                  当前知识库尚未配置知识图谱方案，请先在设置中添加
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
                class="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-medium text-sm shadow-md hover:shadow-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!selectedKgConfigId || kgConfigOptions.length === 0"
                @click="handleConfirm"
              >
                确认构建
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
  (e: 'confirm', kgConfigId: string): void
}>()

const configStore = useKnowledgeConfigStore()
const selectedKgConfigId = ref<string | null>(null)

const defaultKgConfigId = computed(() => configStore.getDefaultKgConfigId(props.knowledgeBaseId))

const kgConfigOptions = computed(() => {
  const configs = configStore.getKgConfigs(props.knowledgeBaseId)
  return configs.map((c) => ({
    label: `${c.name}${c.id === defaultKgConfigId.value ? ' [默认]' : ''}`,
    value: c.id
  }))
})

watch(
  () => props.modelValue,
  async (visible) => {
    if (visible) {
      await configStore.loadConfig(props.knowledgeBaseId)
      if (defaultKgConfigId.value) {
        selectedKgConfigId.value = defaultKgConfigId.value
      } else if (kgConfigOptions.value.length === 1) {
        selectedKgConfigId.value = kgConfigOptions.value[0].value as string
      }
    } else {
      selectedKgConfigId.value = null
    }
  }
)

function handleClose(): void {
  emit('update:modelValue', false)
}

function handleConfirm(): void {
  if (!selectedKgConfigId.value) return
  emit('confirm', selectedKgConfigId.value)
  handleClose()
}
</script>

<style scoped>
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
