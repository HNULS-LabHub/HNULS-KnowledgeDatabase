<template>
  <div class="h-full bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-7xl mx-auto p-6 lg:p-10 space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">任务监控</h1>
          <p class="text-slate-500 text-sm mt-1">查看和管理系统当前正在处理的所有任务。</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-500">
            共
            <span class="font-semibold text-slate-900">{{ store.filteredTasks.length }}</span>
            个任务
          </span>
          <button
            @click="handleRefresh"
            :disabled="store.loading"
            class="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
          >
            <svg
              :class="['w-[18px] h-[18px]', { 'animate-spin': store.loading }]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
              />
            </svg>
          </button>
          <button
            @click="handleClearCompleted"
            :disabled="store.loading"
            class="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-200 shadow-sm transition-colors disabled:opacity-50"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              />
            </svg>
            清除已完成
          </button>
        </div>
      </div>

      <!-- 常驻系统任务栏 -->
      <div
        class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between"
      >
        <div class="flex items-center gap-6">
          <!-- 向量索引器状态 -->
          <VectorIndexerRing :size="40" :stroke-width="4" :poll-interval="3000" />
        </div>
        <div class="text-xs text-slate-400">系统后台任务</div>
      </div>

      <!-- Filter Bar -->
      <div
        class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between"
      >
        <!-- Left Side: Search & Filters -->
        <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <!-- Search -->
          <div class="relative group w-full md:w-64">
            <svg
              class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors w-[18px] h-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="搜索任务 ID 或标题..."
              :value="store.searchQuery"
              @input="handleSearchInput"
              class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400"
            />
          </div>

          <!-- Status Select -->
          <div class="w-full md:w-40">
            <WhiteSelect
              :model-value="store.statusFilter"
              :options="statusOptions"
              placeholder="所有状态"
              @update:model-value="handleStatusChange"
            />
          </div>

          <!-- Type Select -->
          <div class="w-full md:w-40">
            <WhiteSelect
              :model-value="store.typeFilter"
              :options="typeOptions"
              placeholder="所有类型"
              @update:model-value="handleTypeChange"
            />
          </div>
        </div>

        <!-- Right Side: Bulk Actions (Conditional) -->
        <div
          v-if="store.selectedCount > 0"
          class="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <span class="text-sm text-slate-500">已选 {{ store.selectedCount }} 项</span>
          <button
            @click="handleBatchPause"
            :disabled="store.loading"
            class="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors border border-amber-200 disabled:opacity-50"
          >
            批量暂停
          </button>
          <button
            @click="handleBatchResume"
            :disabled="store.loading"
            class="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200 disabled:opacity-50"
          >
            批量恢复
          </button>
        </div>
      </div>

      <!-- Task Table -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div class="overflow-x-auto overflow-y-auto flex-1" style="max-height: 500px;">
          <table class="w-full text-left border-collapse">
            <thead
              class="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10"
            >
              <tr>
                <th class="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    :checked="store.isAllSelected"
                    @change="store.toggleSelectAll"
                    class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th class="px-6 py-4">任务标题</th>
                <th class="px-6 py-4">类型</th>
                <th class="px-6 py-4">状态</th>
                <th class="px-6 py-4 w-1/5">进度</th>
                <th class="px-6 py-4">创建时间</th>
                <th class="w-10 px-4 py-4"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-sm">
              <tr
                v-if="store.filteredTasks.length > 0"
                v-for="task in store.filteredTasks"
                :key="task.id"
                :class="[
                  'hover:bg-slate-50 transition-colors group',
                  { 'bg-blue-50/30': store.selectedTaskIds.has(task.id) }
                ]"
              >
                <td class="px-4 py-4">
                  <input
                    type="checkbox"
                    :checked="store.selectedTaskIds.has(task.id)"
                    @change="() => store.toggleTaskSelection(task.id)"
                    class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col">
                    <span
                      class="font-medium text-slate-900 group-hover:text-blue-600 transition-colors"
                    >
                      {{ task.title }}
                    </span>
                    <span class="text-xs text-slate-500 font-mono mt-0.5">{{ task.id }}</span>

                    <!-- 通用 meta 摘要展示 -->
                    <div v-if="hasMetaSummary(task)" class="mt-1 text-xs text-slate-600">
                      {{ getMetaSummary(task) }}
                    </div>

                    <!-- 错误信息 -->
                    <div
                      v-if="task.error"
                      class="mt-1 text-xs text-red-600 truncate"
                      style="max-width: 400px"
                    >
                      {{ task.error }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span
                    class="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium"
                  >
                    {{ task.type }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <StatusBadge :status="task.status" />
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <ProgressBar :value="task.progress" :status="task.status" />
                    <span class="text-xs font-mono text-slate-500 w-8 text-right"
                      >{{ task.progress }}%</span
                    >
                  </div>
                </td>
                <td class="px-6 py-4 text-slate-500 font-mono text-xs">
                  {{ formatTime(task.createdAt) }}
                </td>
                <td class="px-4 py-4 text-center">
                  <button
                    @click="() => store.removeTask(task.id)"
                    class="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                    title="移除任务"
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else>
                <td colspan="7" class="px-6 py-12 text-center text-slate-500">
                  <div class="flex flex-col items-center gap-2">
                    <svg
                      class="w-8 h-8 text-slate-300 mb-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <p class="font-medium text-slate-900">未找到相关任务</p>
                    <p class="text-sm">尝试调整筛选条件或搜索关键词</p>
                    <button
                      @click="store.clearFilters"
                      class="mt-2 text-blue-600 hover:underline text-sm"
                    >
                      清除所有筛选
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <span class="text-sm text-slate-500">
            显示 {{ store.filteredTasks.length }} 项，共 {{ store.tasks.length }} 项
          </span>
          <div class="flex items-center gap-2 text-sm text-slate-500">
            <span v-if="store.activeTaskCount > 0" class="flex items-center gap-1">
              <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              {{ store.activeTaskCount }} 个任务进行中
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useTaskMonitorStore } from '@renderer/stores/global-monitor-panel/task-monitor.store'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { WhiteSelectOption } from '@renderer/components/select/WhiteSelect.vue'
import StatusBadge from './StatusBadge.vue'
import ProgressBar from './ProgressBar.vue'
import VectorIndexerRing from './VectorIndexerRing.vue'
import type { TaskRecord } from '@preload/types'

const store = useTaskMonitorStore()

// ========== Computed Options ==========
const statusOptions = computed<WhiteSelectOption[]>(() => {
  return store.taskStatuses.map((status) => ({
    label: status === 'all' ? '所有状态' : formatStatus(status),
    value: status
  }))
})

const typeOptions = computed<WhiteSelectOption[]>(() => {
  return store.taskTypes.map((type) => ({
    label: type === 'all' ? '所有类型' : type,
    value: type
  }))
})

// ========== Lifecycle ==========
onMounted(() => {
  store.init()
})

// ========== Event Handlers ==========
const handleSearchInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  store.setSearchQuery(target.value)
}

const handleStatusChange = (value: string | number | null) => {
  store.setStatusFilter(value as any)
}

const handleTypeChange = (value: string | number | null) => {
  store.setTypeFilter(value as any)
}

const handleRefresh = () => {
  store.refresh()
}

const handleClearCompleted = () => {
  store.clearCompletedTasks()
}

const handleBatchPause = () => {
  store.batchPauseTasks()
}

const handleBatchResume = () => {
  store.batchResumeTasks()
}

// ========== Helpers ==========
const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败'
  }
  return statusMap[status] || status
}

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const hasMetaSummary = (task: TaskRecord): boolean => {
  return Object.keys(task.meta).length > 0
}

const getMetaSummary = (task: TaskRecord): string => {
  const entries = Object.entries(task.meta).slice(0, 3)
  return entries.map(([k, v]) => `${k}: ${v}`).join(' · ')
}
</script>

<style scoped>
/* 动画效果 */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slide-in-from-bottom-2 {
  from {
    transform: translateY(0.5rem);
  }
  to {
    transform: translateY(0);
  }
}

.animate-in {
  animation:
    fade-in 0.3s ease-out,
    slide-in-from-bottom-2 0.3s ease-out;
}
</style>
