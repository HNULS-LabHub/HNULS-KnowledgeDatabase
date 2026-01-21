<template>
  <div class="tm-container min-h-screen bg-slate-50 text-slate-900 font-sans p-6 lg:p-10">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">活跃任务列表</h1>
          <p class="text-slate-500 text-sm mt-1">查看和管理系统当前正在处理的所有任务。</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-500">
            共 <span class="font-semibold text-slate-900">{{ store.filteredTasks.length }}</span> 个任务
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
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
          <button
            @click="handleExport"
            :disabled="store.loading"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            导出报表
          </button>
        </div>
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
              placeholder="搜索任务 ID 或名称..."
              :value="store.filter.searchQuery"
              @input="handleSearchInput"
              class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400"
            />
          </div>

          <!-- Status Select -->
          <div class="w-full md:w-40">
            <WhiteSelect
              :model-value="store.filter.statusFilter"
              :options="statusOptions"
              placeholder="所有状态"
              @update:model-value="handleStatusChange"
            />
          </div>

          <!-- Type Select -->
          <div class="w-full md:w-40">
            <WhiteSelect
              :model-value="store.filter.typeFilter"
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
            @click="handleBatchStop"
            :disabled="store.loading"
            class="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors border border-rose-200 disabled:opacity-50"
          >
            批量停止
          </button>
          <button
            @click="handleBatchRestart"
            :disabled="store.loading"
            class="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200 disabled:opacity-50"
          >
            重新运行
          </button>
        </div>
      </div>

      <!-- Task Table -->
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div class="tm-table-scroll overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th class="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    :checked="store.isAllSelected"
                    @change="store.toggleSelectAll"
                    class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th class="px-6 py-4">任务 ID / 名称</th>
                <th class="px-6 py-4">类型</th>
                <th class="px-6 py-4">状态</th>
                <th class="px-6 py-4 w-1/5">进度</th>
                <th class="px-6 py-4">所有者</th>
                <th class="px-6 py-4 text-right">开始时间</th>
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
                    <span class="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                      {{ task.name }}
                    </span>
                    <span class="text-xs text-slate-500 font-mono mt-0.5">{{ task.id }}</span>
                    
                    <!-- 文件导入任务额外信息 -->
                    <div v-if="task.type === 'File Import' && task.importDetail" class="mt-1 text-xs text-slate-600">
                      <span>{{ task.importDetail.processed }}/{{ task.importDetail.totalFiles }} 文件</span>
                      <span class="mx-1">·</span>
                      <span class="text-green-600">{{ task.importDetail.imported }} 成功</span>
                      <span v-if="task.importDetail.failed > 0" class="mx-1">·</span>
                      <span v-if="task.importDetail.failed > 0" class="text-red-600">{{ task.importDetail.failed }} 失败</span>
                    </div>
                    <div v-if="task.type === 'File Import' && task.importDetail && task.importDetail.currentFile" class="mt-1 text-xs text-slate-500 truncate" style="max-width: 400px;">
                      当前: {{ task.importDetail.currentFile }}
                    </div>

                    <!-- 文档解析任务额外信息 -->
                    <div v-if="task.type === 'Document Parsing' && task.parsingDetail" class="mt-1 text-xs text-slate-600">
                      <span v-if="task.parsingDetail.currentDetail">{{ task.parsingDetail.currentDetail }}</span>
                      <span v-else>{{ task.parsingDetail.state }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span class="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-medium">
                    {{ task.type }}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <StatusBadge :status="task.status" />
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <ProgressBar :value="task.progress" :status="task.status" />
                    <span class="text-xs font-mono text-slate-500 w-8 text-right">{{ task.progress }}%</span>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-600 font-medium"
                    >
                      {{ task.owner.charAt(0) }}
                    </div>
                    <span class="text-slate-600">{{ task.owner }}</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-slate-500 text-right font-mono text-xs">{{ task.started }}</td>
                <td class="px-4 py-4 text-center">
                  <button
                    class="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200 transition-colors"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>
                  </button>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else>
                <td colspan="8" class="px-6 py-12 text-center text-slate-500">
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

        <!-- Pagination (Visual Only) -->
        <div class="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <span class="text-sm text-slate-500">
            显示 1 至 {{ store.filteredTasks.length }} 项，共 {{ store.filteredTasks.length }} 项
          </span>
          <div class="flex gap-2">
            <button
              class="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 text-slate-400 disabled:opacity-50"
              disabled
            >
              上一页
            </button>
            <button class="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 text-slate-600">
              下一页
            </button>
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

const store = useTaskMonitorStore()

// ========== Computed Options ==========
const statusOptions = computed<WhiteSelectOption[]>(() => {
  return store.taskStatuses.map((status) => ({
    label: status === 'All Status' ? '所有状态' : formatStatus(status),
    value: status
  }))
})

const typeOptions = computed<WhiteSelectOption[]>(() => {
  return store.taskTypes.map((type) => ({
    label: type === 'All Types' ? '所有类型' : type,
    value: type
  }))
})

// ========== Lifecycle ==========
onMounted(() => {
  store.loadTasks()
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
  store.refreshTasks()
}

const handleExport = () => {
  store.exportReport()
}

const handleBatchStop = () => {
  store.batchStopTasks()
}

const handleBatchRestart = () => {
  store.batchRestartTasks()
}

// ========== Helpers ==========
const formatStatus = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
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
  animation: fade-in 0.3s ease-out, slide-in-from-bottom-2 0.3s ease-out;
}
</style>
