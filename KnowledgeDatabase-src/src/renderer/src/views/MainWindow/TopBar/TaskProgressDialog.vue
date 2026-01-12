<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="close"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 class="text-xl font-semibold text-slate-900">任务进度</h2>
            <button
              @click="close"
              class="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
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

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <!-- 手风琴：文件导入 -->
            <div class="mb-4">
              <button
                @click="expandedSection = expandedSection === 'import' ? null : 'import'"
                class="w-full flex items-center justify-between p-4 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 bg-white"
              >
                <div class="flex items-center gap-3">
                  <svg
                    class="w-5 h-5 text-slate-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span class="font-medium text-slate-900">文件导入</span>
                  <span
                    v-if="activeImportTasks.length > 0"
                    class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full"
                  >
                    {{ activeImportTasks.length }} 进行中
                  </span>
                </div>
                <svg
                  class="w-5 h-5 text-slate-400 transition-transform"
                  :class="{ 'rotate-180': expandedSection === 'import' }"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <!-- 展开内容 -->
              <Transition name="accordion">
                <div v-if="expandedSection === 'import'" class="mt-2 space-y-2">
                  <!-- 活动任务 -->
                  <div
                    v-for="task in activeImportTasks"
                    :key="task.taskId"
                    class="p-4 bg-slate-50 rounded-lg"
                  >
                    <div class="flex items-start justify-between mb-3">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <div
                            class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                            v-if="task.status === 'running'"
                          ></div>
                          <span class="text-sm font-medium text-slate-900"
                            >任务 #{{ task.taskId.slice(-8) }}</span
                          >
                        </div>
                        <p class="text-xs text-slate-500">知识库 ID: {{ task.knowledgeBaseId }}</p>
                      </div>
                      <span v-if="task.progress" class="text-sm font-medium text-slate-700">
                        {{ task.progress.percentage }}%
                      </span>
                    </div>

                    <!-- 进度条 -->
                    <div v-if="task.progress" class="mb-3">
                      <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                          :style="{ width: `${task.progress.percentage}%` }"
                        ></div>
                      </div>
                      <div class="flex items-center justify-between mt-2 text-xs text-slate-600">
                        <span
                          >{{ task.progress.processed }} / {{ task.progress.totalFiles }} 文件</span
                        >
                        <span>
                          {{ task.progress.imported }} 成功, {{ task.progress.failed }} 失败
                        </span>
                      </div>
                      <p
                        v-if="task.progress.currentFile"
                        class="mt-1 text-xs text-slate-500 truncate"
                      >
                        当前: {{ task.progress.currentFile }}
                      </p>
                    </div>
                  </div>

                  <!-- 已完成任务 -->
                  <div
                    v-for="task in completedImportTasks"
                    :key="task.taskId"
                    class="p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div class="flex items-start justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <svg
                          v-if="task.status === 'completed'"
                          class="w-4 h-4 text-green-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <svg
                          v-else
                          class="w-4 h-4 text-red-500"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span class="text-sm font-medium text-slate-900"
                          >任务 #{{ task.taskId.slice(-8) }}</span
                        >
                      </div>
                      <button
                        @click="removeTask(task.taskId)"
                        class="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
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
                    <div v-if="task.result" class="text-xs text-slate-600">
                      <p>导入: {{ task.result.imported }} 成功, {{ task.result.failed }} 失败</p>
                    </div>
                    <div v-else-if="task.error" class="text-xs text-red-600">
                      <p>{{ task.error }}</p>
                    </div>
                  </div>

                  <!-- 空状态 -->
                  <div v-if="allImportTasks.length === 0" class="p-8 text-center text-slate-400">
                    <svg
                      class="w-12 h-12 mx-auto mb-3 opacity-50"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p class="text-sm">暂无导入任务</p>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- 其他任务类型可以在这里添加 -->
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              v-if="completedImportTasks.length > 0"
              @click="clearCompleted"
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              清除已完成
            </button>
            <button
              @click="close"
              class="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskManagerStore } from '@renderer/stores/task-manager.store'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const taskManager = useTaskManagerStore()
const expandedSection = ref<string | null>('import')

const activeImportTasks = computed(() => {
  return taskManager.activeImportTasks
})

const completedImportTasks = computed(() => {
  return taskManager.allImportTasks.filter(
    (task) => task.status === 'completed' || task.status === 'failed'
  )
})

const allImportTasks = computed(() => {
  return taskManager.allImportTasks
})

function close(): void {
  emit('update:visible', false)
}

function removeTask(taskId: string): void {
  taskManager.removeTask(taskId)
}

function clearCompleted(): void {
  taskManager.clearCompletedTasks()
}
</script>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active > div,
.dialog-leave-active > div {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.dialog-enter-from > div,
.dialog-leave-to > div {
  transform: scale(0.95);
  opacity: 0;
}

.accordion-enter-active,
.accordion-leave-active {
  transition:
    height 0.3s ease,
    opacity 0.3s ease;
  overflow: hidden;
}

.accordion-enter-from,
.accordion-leave-to {
  height: 0;
  opacity: 0;
}
</style>
