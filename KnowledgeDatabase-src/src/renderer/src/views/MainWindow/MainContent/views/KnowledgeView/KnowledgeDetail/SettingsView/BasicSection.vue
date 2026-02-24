<template>
  <div class="kb-basic-section flex flex-col gap-6 p-6 bg-white border-b border-slate-100">
    <div class="kb-basic-header">
      <h3 class="kb-basic-title text-lg font-semibold text-slate-900 mb-1">基本</h3>
      <p class="kb-basic-desc text-sm text-slate-500">知识库基础管理操作</p>
    </div>

    <div class="kb-basic-actions flex flex-col gap-4">
      <!-- 重置数据库 -->
      <div
        class="kb-basic-reset flex items-center justify-between p-4 rounded-lg border border-slate-200"
      >
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-slate-700">重置 SurrealDB 数据库</span>
          <span class="text-xs text-slate-400">
            清空该知识库的所有向量、图谱等数据，保留表结构和本地文档
          </span>
        </div>
        <button
          class="kb-basic-reset-btn px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 active:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          :disabled="resetting"
          @click="handleReset"
        >
          {{ resetting ? '重置中...' : '重置数据库' }}
        </button>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <Teleport to="body">
      <div
        v-if="showConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="showConfirm = false"
      >
        <div class="bg-white rounded-xl shadow-xl p-6 w-96 flex flex-col gap-4">
          <h4 class="text-base font-semibold text-slate-900">确认重置数据库</h4>
          <p class="text-sm text-slate-600">
            此操作将清空该知识库的所有嵌入向量、知识图谱数据。本地文档文件不受影响，但需要重新执行嵌入和图谱构建。
          </p>
          <p class="text-sm text-red-500 font-medium">此操作不可撤销。</p>
          <div class="flex justify-end gap-3 mt-2">
            <button
              class="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              @click="showConfirm = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
              @click="confirmReset"
            >
              确认重置
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const resetting = ref(false)
const showConfirm = ref(false)

function handleReset() {
  showConfirm.value = true
}

async function confirmReset() {
  showConfirm.value = false
  resetting.value = true
  try {
    await window.api.knowledgeLibrary.resetDatabase(props.knowledgeBaseId)
  } catch (error) {
    console.error('Failed to reset database:', error)
  } finally {
    resetting.value = false
  }
}
</script>
