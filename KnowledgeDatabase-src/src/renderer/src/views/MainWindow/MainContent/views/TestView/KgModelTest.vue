<template>
  <div class="ts-kg-model-test flex h-full">
    <!-- 左侧：配置区 -->
    <div class="ts-config-panel w-[400px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto p-5 space-y-5">
        <!-- 实体类型配置 -->
        <section class="space-y-2">
          <label class="text-sm font-semibold text-slate-700">实体类型</label>
          <div class="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-lg min-h-[60px]">
            <span
              v-for="(t, i) in store.config.entityTypes"
              :key="i"
              class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200"
            >
              {{ t }}
              <button class="text-blue-400 hover:text-blue-600" @click="store.removeEntityType(i)">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
            <input
              v-model="entityInput"
              type="text"
              placeholder="逗号分隔批量添加"
              class="flex-1 min-w-[100px] bg-transparent border-none outline-none text-xs"
              @keydown.enter.prevent="handleAddEntityTypes"
            />
          </div>
        </section>

        <!-- 输出语言 -->
        <section class="space-y-2">
          <label class="text-sm font-semibold text-slate-700">输出语言</label>
          <select
            :value="store.config.outputLanguage"
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            @change="store.setOutputLanguage(($event.target as HTMLSelectElement).value)"
          >
            <option value="Chinese">中文</option>
            <option value="English">English</option>
            <option value="Japanese">日本語</option>
          </select>
        </section>

        <!-- 模型选择 -->
        <section class="space-y-2">
          <label class="text-sm font-semibold text-slate-700">LLM 模型</label>
          <button
            class="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm hover:border-blue-300 transition-colors"
            @click="showModelSelect = true"
          >
            <span :class="store.config.modelId ? 'text-slate-900' : 'text-slate-400'">
              {{ store.config.modelId || '点击选择模型' }}
            </span>
            <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </section>

        <!-- 原文本输入 -->
        <section class="space-y-2 flex-1 flex flex-col">
          <label class="text-sm font-semibold text-slate-700">原文本</label>
          <textarea
            :value="store.config.inputText"
            placeholder="输入需要提取实体和关系的文本..."
            class="flex-1 min-h-[150px] w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"
            @input="store.setInputText(($event.target as HTMLTextAreaElement).value)"
          />
        </section>

        <!-- 发送按钮 -->
        <button
          class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!store.canSend"
          @click="store.sendTest"
        >
          {{ store.status === 'loading' ? '处理中...' : '发送测试' }}
        </button>
      </div>
    </div>

    <!-- 右侧：提示词预览 & 结果 -->
    <div class="ts-result-panel flex-1 flex flex-col overflow-hidden bg-slate-50">
      <!-- 标签切换 -->
      <div class="flex items-center gap-2 px-5 py-3 border-b border-slate-200 bg-white">
        <button
          v-for="t in rightTabs"
          :key="t.id"
          class="px-3 py-1 text-xs font-medium rounded transition-colors"
          :class="rightTab === t.id ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:text-slate-700'"
          @click="rightTab = t.id"
        >
          {{ t.label }}
        </button>
        <!-- 状态指示 -->
        <span v-if="store.status === 'loading'" class="ml-auto text-xs text-amber-600 flex items-center gap-1">
          <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12" />
          </svg>
          流式输出中...
        </span>
        <span v-else-if="store.status === 'success'" class="ml-auto text-xs text-emerald-600">完成</span>
        <span v-else-if="store.status === 'error'" class="ml-auto text-xs text-red-600">错误</span>
      </div>

      <!-- 内容 -->
      <div class="flex-1 overflow-auto p-5 space-y-4">
        <!-- 思考过程（仅在 result 标签且有内容时显示） -->
        <div
          v-if="rightTab === 'result' && (store.streamingReasoning || store.result?.reasoning)"
          class="ts-reasoning-block"
        >
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span class="text-xs font-semibold text-purple-700">思考过程</span>
          </div>
          <pre class="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 whitespace-pre-wrap overflow-auto font-mono max-h-[200px]">{{ store.streamingReasoning || store.result?.reasoning }}</pre>
        </div>

        <!-- 主内容 -->
        <pre
          class="ts-code-block w-full p-4 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap overflow-auto font-mono"
          :class="{ 'min-h-[300px]': rightTab === 'result' }"
        >{{ displayContent }}</pre>
      </div>

      <!-- Token 统计 -->
      <div v-if="store.result?.usage" class="px-5 py-2 border-t border-slate-200 bg-white text-xs text-slate-500 flex gap-4">
        <span>Prompt: {{ store.result.usage.promptTokens }}</span>
        <span>Completion: {{ store.result.usage.completionTokens }}</span>
        <span>Total: {{ store.result.usage.totalTokens }}</span>
      </div>
    </div>

    <!-- 模型选择对话框 -->
    <ModelSelectDialog
      v-model="showModelSelect"
      title="选择 LLM 模型"
      description="选择用于知识图谱实体提取测试的模型"
      :current-model-id="store.config.modelId"
      @select="handleModelSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKgTestStore } from '@renderer/stores/test/kg-test.store'
import ModelSelectDialog from '@renderer/components/ModelSelectDialog/index.vue'
import type { ModelSelection } from '@renderer/components/ModelSelectDialog/index.vue'

const store = useKgTestStore()

const entityInput = ref('')
const showModelSelect = ref(false)
const rightTab = ref<'system' | 'user' | 'result'>('system')

const rightTabs = [
  { id: 'system' as const, label: 'System Prompt' },
  { id: 'user' as const, label: 'User Prompt' },
  { id: 'result' as const, label: '输出结果' }
]

const displayContent = computed(() => {
  if (rightTab.value === 'system') return store.systemPrompt
  if (rightTab.value === 'user') return store.userPrompt

  // result 标签
  if (store.result?.error) return `错误: ${store.result.error}`

  // 流式输出中显示实时内容
  if (store.status === 'loading') {
    return store.streamingContent || '等待响应...'
  }

  return store.result?.content || '点击「发送测试」查看模型输出'
})

function handleAddEntityTypes(): void {
  if (entityInput.value.trim()) {
    store.addEntityTypes(entityInput.value)
    entityInput.value = ''
  }
}

function handleModelSelect(selection: ModelSelection): void {
  store.setModel(selection.providerId, selection.modelId)
}
</script>
