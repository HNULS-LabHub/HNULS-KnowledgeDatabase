<template>
  <div class="UserSettingView kb-user-setting-78f2 flex flex-col h-full overflow-hidden">
    <!-- TopBar will be automatically added by MainContent -->

    <!-- 主视图 -->
    <div v-if="currentView === 'main'" class="UserSettingView_content flex-1 overflow-auto p-8">
      <div class="max-w-4xl mx-auto">
        <h1 class="UserSettingView_title text-2xl font-bold text-slate-900 mb-8">用户设置</h1>

        <!-- Secret Management Section -->
        <div class="UserSettingView_section mb-10">
          <h2 class="UserSettingView_sectionTitle text-lg font-semibold text-slate-800 mb-4">
            秘钥管理
          </h2>

          <div
            class="UserSettingView_sectionContent bg-white rounded-xl p-6 shadow-sm border border-slate-200"
          >
            <h3 class="UserSettingView_subsectionTitle text-base font-medium text-slate-700 mb-4">
              minerU
            </h3>

            <div class="UserSettingView_formGroup">
              <label class="UserSettingView_label block text-sm font-medium text-slate-700 mb-2">
                API 密钥
              </label>
              <div class="relative">
                <input
                  v-model="draftMinerUApiKey"
                  type="password"
                  class="UserSettingView_input w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                  placeholder="输入您的 minerU API 密钥"
                  @blur="handleMinerUBlur"
                />
                <div
                  class="UserSettingView_status absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                  :class="statusClass"
                >
                  {{ statusText }}
                </div>
              </div>
              <p class="UserSettingView_helpText mt-2 text-sm text-slate-500">
                此密钥将用于 minerU 服务认证，请妥善保管。离开输入框后自动保存。
              </p>
            </div>
          </div>
        </div>

        <!-- Embedding Configuration Section -->
        <div class="UserSettingView_section mb-10">
          <h2 class="UserSettingView_sectionTitle text-lg font-semibold text-slate-800 mb-4">
            嵌入配置（全局）
          </h2>

          <div
            class="UserSettingView_sectionContent bg-white rounded-xl p-6 shadow-sm border border-slate-200"
          >
            <div class="UserSettingView_formGroup mb-6">
              <label class="UserSettingView_label block text-sm font-medium text-slate-700 mb-2">
                并行数
              </label>
              <div class="relative">
                <input
                  v-model.number="draftEmbeddingConcurrency"
                  type="number"
                  min="1"
                  max="50"
                  class="UserSettingView_input w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                  placeholder="输入并行数"
                  @blur="handleEmbeddingBlur"
                />
                <div
                  class="UserSettingView_status absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                  :class="statusClass"
                >
                  {{ statusText }}
                </div>
              </div>
              <p class="UserSettingView_helpText mt-2 text-sm text-slate-500">
                配置嵌入服务的并行处理数，范围：1-50。离开输入框后自动保存。
              </p>
            </div>

            <div class="UserSettingView_formGroup">
              <label class="UserSettingView_label block text-sm font-medium text-slate-700 mb-2">
                向量索引批次大小
              </label>
              <div class="relative">
                <input
                  v-model.number="draftHnswBatchSize"
                  type="number"
                  min="1"
                  max="1000"
                  class="UserSettingView_input w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                  placeholder="输入批次大小"
                  @blur="handleHnswBatchSizeBlur"
                />
                <div
                  class="UserSettingView_status absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                  :class="statusClass"
                >
                  {{ statusText }}
                </div>
              </div>
              <p class="UserSettingView_helpText mt-2 text-sm text-slate-500">
                配置向量索引器每批次从暂存表读取的记录数，范围：1-1000。较大值提高吞吐量但占用更多内存。离开输入框后自动保存。
              </p>
            </div>
          </div>
        </div>

        <!-- Model Management Entry -->
        <div class="UserSettingView_section mb-10">
          <div
            class="UserSettingView_sectionContent relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-50/70"
            :style="modelCardStyle"
          >
            <div class="absolute inset-0 bg-white/60 backdrop-blur-sm"></div>
            <div
              class="relative p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            >
              <div class="flex-1">
                <p class="UserSettingView_sectionTitle text-lg font-semibold text-slate-800">
                  模型管理
                </p>
                <p class="UserSettingView_helpText mt-2 text-sm text-slate-600 max-w-2xl">
                  配置与管理可用的大模型来源、密钥与优先级，集中维护模型能力。
                </p>
              </div>
              <button
                type="button"
                class="UserSettingView_button inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                @click="handleOpenModelConfig"
              >
                前往配置
              </button>
            </div>
          </div>
        </div>

        <!-- More sections can be added here in the future -->
      </div>
    </div>

    <!-- 模型配置子视图 -->
    <ModelConfigView v-else-if="currentView === 'model-config'" @back="handleBackToMain" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserConfigStore } from '@renderer/stores/user-config/user-config.store'
import ModelConfigView from './ModelConfigView/index.vue'

const emit = defineEmits<{
  (e: 'openModelConfig'): void
  (e: 'enter-detail', name: string): void
  (e: 'leave-detail'): void
}>()

const currentView = ref<'main' | 'model-config'>('main')

const userConfigStore = useUserConfigStore()

const draftMinerUApiKey = ref('')
const draftEmbeddingConcurrency = ref(5)
const draftHnswBatchSize = ref(10)
const modelCardStyle = computed(() => ({
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23eef2ff' stop-opacity='0.8'/%3E%3Cstop offset='100%25' stop-color='%23e0f2fe' stop-opacity='0.8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cg fill='url(%23g)'%3E%3Cpolygon points='0,0 80,0 0,80'/%3E%3Cpolygon points='80,0 160,0 120,60'/%3E%3Cpolygon points='160,0 240,0 200,70'/%3E%3Cpolygon points='240,0 320,0 320,80'/%3E%3Cpolygon points='0,80 60,120 0,200'/%3E%3Cpolygon points='60,120 140,80 120,200'/%3E%3Cpolygon points='140,80 220,120 200,200'/%3E%3Cpolygon points='220,120 320,80 320,200'/%3E%3C/g%3E%3C/svg%3E\")",
  backgroundSize: 'cover',
  backgroundPosition: 'center'
}))

onMounted(async (): Promise<void> => {
  await userConfigStore.fetch()
  draftMinerUApiKey.value = userConfigStore.config?.minerU.apiKey || ''
  draftEmbeddingConcurrency.value = userConfigStore.config?.embedding.concurrency || 5
  draftHnswBatchSize.value = userConfigStore.config?.embedding.hnswBatchSize || 10
})

const statusText = computed(() => {
  if (userConfigStore.saveStatus === 'saving') return '保存中...'
  if (userConfigStore.saveStatus === 'saved') return '已保存'
  if (userConfigStore.saveStatus === 'error') return '保存失败'
  return ''
})

const statusClass = computed(() => {
  if (userConfigStore.saveStatus === 'error') return 'text-rose-500'
  if (userConfigStore.saveStatus === 'saved') return 'text-emerald-600'
  return 'text-slate-400'
})

const handleMinerUBlur = async (): Promise<void> => {
  const current = userConfigStore.config?.minerU.apiKey || ''
  if (draftMinerUApiKey.value === current) return

  try {
    await userConfigStore.updateMinerUApiKey(draftMinerUApiKey.value)
  } catch {
    // store already holds error state
  }
}

const handleEmbeddingBlur = async (): Promise<void> => {
  const current = userConfigStore.config?.embedding.concurrency ?? 5
  if (draftEmbeddingConcurrency.value === current) return

  try {
    await userConfigStore.updateEmbeddingConcurrency(draftEmbeddingConcurrency.value)
    // 同步到嵌入引擎后端
    await window.api.embedding.setConcurrency(draftEmbeddingConcurrency.value)
  } catch {
    // store already holds error state
  }
}

const handleHnswBatchSizeBlur = async (): Promise<void> => {
  const current = userConfigStore.config?.embedding.hnswBatchSize ?? 10
  if (draftHnswBatchSize.value === current) return

  try {
    await userConfigStore.updateHnswBatchSize(draftHnswBatchSize.value)
    // 同步到向量索引器后端
    await window.api.vectorIndexer.updateConfig({ batchSize: draftHnswBatchSize.value })
  } catch {
    // store already holds error state
  }
}

const handleOpenModelConfig = (): void => {
  currentView.value = 'model-config'
  emit('enter-detail', '模型管理')
}

const handleBackToMain = (): void => {
  currentView.value = 'main'
  emit('leave-detail')
}

// 暴露给父组件调用的方法（用于面包屑返回）
const handleBack = (): void => {
  if (currentView.value === 'model-config') {
    handleBackToMain()
  }
}

// 使用 defineExpose 暴露方法
defineExpose({
  handleBack
})
</script>

<style scoped>
/* Component-specific styles (if needed) will go here */
</style>
