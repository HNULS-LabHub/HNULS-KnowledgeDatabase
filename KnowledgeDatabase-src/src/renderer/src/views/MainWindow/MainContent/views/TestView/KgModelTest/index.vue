<template>
  <div class="ts-kg-model-test flex h-full">
    <!-- 左侧：配置区 -->
    <div class="ts-config-panel w-[360px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <!-- 实体类型配置 -->
        <section class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-600">实体类型</label>
          <div class="flex flex-wrap gap-1 p-2 bg-slate-50 border border-slate-200 rounded-lg min-h-[50px]">
            <span
              v-for="(t, i) in store.config.entityTypes"
              :key="i"
              class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] border border-blue-200"
            >
              {{ t }}
              <button class="text-blue-400 hover:text-blue-600" @click="store.removeEntityType(i)">
                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
            <input
              v-model="entityInput"
              type="text"
              placeholder="逗号分隔添加"
              class="flex-1 min-w-[80px] bg-transparent border-none outline-none text-[10px]"
              @keydown.enter.prevent="handleAddEntityTypes"
            />
          </div>
        </section>

        <!-- 输出语言 -->
        <section class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-600">输出语言</label>
          <select
            :value="store.config.outputLanguage"
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            @change="store.setOutputLanguage(($event.target as HTMLSelectElement).value)"
          >
            <option value="Chinese">中文</option>
            <option value="English">English</option>
            <option value="Japanese">日本語</option>
          </select>
        </section>

        <!-- 模型选择（多选） -->
        <section class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-slate-600">测试模型</label>
            <span class="text-[10px] text-slate-400">{{ store.selectedModels.length }} 个</span>
          </div>
          <div class="space-y-1.5">
            <!-- 已选模型列表 -->
            <div v-if="store.selectedModels.length > 0" class="flex flex-wrap gap-1">
              <span
                v-for="m in store.selectedModels"
                :key="m.modelId"
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] border border-emerald-200"
              >
                {{ m.modelId }}
                <button class="text-emerald-400 hover:text-emerald-600" @click="store.removeModel(m.modelId)">
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            </div>
            <button
              class="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              @click="showModelSelect = true"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              添加模型
            </button>
          </div>
        </section>

        <!-- 原文本输入 -->
        <section class="space-y-1.5 flex-1 flex flex-col min-h-0">
          <label class="text-xs font-semibold text-slate-600">原文本</label>
          <textarea
            :value="store.config.inputText"
            placeholder="输入需要提取实体和关系的文本..."
            class="flex-1 min-h-[120px] w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs resize-none"
            @input="store.setInputText(($event.target as HTMLTextAreaElement).value)"
          />
        </section>

        <!-- 发送按钮 -->
        <button
          class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!store.canSend || store.isAnyLoading"
          @click="handleSendAll"
        >
          {{ store.isAnyLoading ? '测试中...' : `并行测试 ${store.selectedModels.length} 个模型` }}
        </button>

        <!-- 历史记录按钮 -->
        <button
          class="w-full py-1.5 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-colors"
          @click="showHistory = true"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          历史记录
          <span v-if="store.historyCount > 0" class="px-1.5 py-0.5 bg-blue-500 text-white text-[9px] rounded-full">
            {{ store.historyCount }}
          </span>
        </button>

        <!-- Prompt 预览切换 -->
        <div class="border-t border-slate-100 pt-3 space-y-1.5">
          <div class="flex items-center gap-2">
            <button
              class="px-2 py-0.5 text-[10px] rounded transition-colors"
              :class="promptTab === 'system' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'"
              @click="promptTab = 'system'"
            >System</button>
            <button
              class="px-2 py-0.5 text-[10px] rounded transition-colors"
              :class="promptTab === 'user' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'"
              @click="promptTab = 'user'"
            >User</button>
          </div>
          <pre class="p-2 bg-slate-50 border border-slate-200 rounded text-[9px] text-slate-600 whitespace-pre-wrap overflow-auto max-h-[150px] font-mono">{{ promptTab === 'system' ? store.systemPrompt : store.userPrompt }}</pre>
        </div>
      </div>
    </div>

    <!-- 右侧：多模型结果区（2栏网格） -->
    <div class="ts-result-panel flex-1 overflow-auto bg-slate-100 p-4">
      <div v-if="store.resultsList.length === 0" class="h-full flex items-center justify-center text-slate-400 text-sm">
        选择模型并点击「并行测试」开始
      </div>
      <div v-else class="grid grid-cols-2 gap-4 auto-rows-max">
        <ModelResultCard
          v-for="result in store.resultsList"
          :key="result.sessionId"
          :result="result"
          :metrics="store.getMetrics(result)"
        />
      </div>
    </div>

    <!-- 模型选择对话框（多选） -->
    <ModelSelectDialog
      v-model="showModelSelect"
      title="选择测试模型"
      description="可选择多个模型进行并行测试对比"
      multiple
      @select-multiple="handleModelsSelect"
    />

    <!-- 历史记录抽屉 -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showHistory" class="fixed inset-0 bg-black/30 z-50" @click="showHistory = false" />
      </Transition>
      <Transition name="slide-right">
        <div
          v-if="showHistory"
          class="ts-history-drawer fixed top-0 right-0 h-full w-[420px] bg-white shadow-xl z-50 flex flex-col"
        >
          <!-- 头部 -->
          <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span class="text-sm font-semibold text-slate-700">测试历史</span>
              <span class="text-xs text-slate-400">{{ store.historyRecords.length }} 条</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="store.historyRecords.length > 0"
                class="px-2 py-1 text-[10px] text-red-500 hover:bg-red-50 rounded transition-colors"
                @click="handleClearAll"
              >
                清空全部
              </button>
              <button class="p-1 hover:bg-slate-100 rounded transition-colors" @click="showHistory = false">
                <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 列表 -->
          <div class="flex-1 overflow-y-auto">
            <div v-if="store.historyLoading" class="p-8 text-center text-slate-400 text-sm">
              加载中...
            </div>
            <div v-else-if="store.historyRecords.length === 0" class="p-8 text-center text-slate-400 text-sm">
              暂无历史记录
            </div>
            <div v-else class="divide-y divide-slate-100">
              <div
                v-for="record in store.historyRecords"
                :key="record.id"
                class="p-3 hover:bg-slate-50 transition-colors"
              >
                <!-- 时间和操作 -->
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[10px] text-slate-400">{{ formatDate(record.timestamp) }}</span>
                  <div class="flex items-center gap-1">
                    <button
                      class="px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      @click="handleRestore(record)"
                    >
                      恢复配置
                    </button>
                    <button
                      class="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      @click="handleDelete(record.id)"
                    >
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- 模型列表 -->
                <div class="flex flex-wrap gap-1 mb-2">
                  <span
                    v-for="m in record.models"
                    :key="m.modelId"
                    class="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] rounded border border-emerald-200"
                  >
                    {{ m.modelId }}
                  </span>
                </div>

                <!-- 输入文本预览 -->
                <div class="text-[10px] text-slate-500 line-clamp-2">
                  {{ record.config.inputText }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useKgTestStore } from '@renderer/stores/test/kg-test.store'
import ModelSelectDialog from '@renderer/components/ModelSelectDialog/index.vue'
import type { ModelSelection } from '@renderer/components/ModelSelectDialog/index.vue'
import ModelResultCard from './ModelResultCard.vue'
import type { TestHistoryRecord } from '@renderer/stores/test/kg-test-history'

const store = useKgTestStore()

const entityInput = ref('')
const showModelSelect = ref(false)
const showHistory = ref(false)
const promptTab = ref<'system' | 'user'>('system')

// 打开历史抽屉时加载数据
watch(showHistory, async (val) => {
  if (val) {
    await store.loadHistory()
  }
})

function handleAddEntityTypes(): void {
  if (entityInput.value.trim()) {
    store.addEntityTypes(entityInput.value)
    entityInput.value = ''
  }
}

function handleModelsSelect(selections: ModelSelection[]): void {
  for (const s of selections) {
    store.addModel(s.providerId, s.modelId)
  }
}

function handleSendAll(): void {
  store.sendAllTests()
}

function handleRestore(record: TestHistoryRecord): void {
  store.restoreFromHistory(record)
  showHistory.value = false
}

function handleDelete(id: string): void {
  store.removeHistory(id)
}

async function handleClearAll(): Promise<void> {
  if (confirm('确定要清空所有历史记录吗？')) {
    await store.clearHistory()
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

onMounted(async () => {
  await store.loadHistoryCount()
})

onUnmounted(() => {
  store.cleanupStreamListeners()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.25s ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
</style>
