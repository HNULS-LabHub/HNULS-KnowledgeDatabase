<template>
  <div
    class="tm-kg-monitor-9f3e h-[840px] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col"
  >
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-slate-900">知识图谱监控</h3>
        <p class="text-xs text-slate-500 mt-1">任务与分块状态实时查看</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500">
          共 <span class="font-semibold text-slate-900">{{ store.total }}</span> 条
        </span>
        <button
          class="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm disabled:opacity-50"
          :disabled="store.loading"
          @click="store.refresh"
          title="刷新"
        >
          <svg
            :class="['w-[16px] h-[16px]', { 'animate-spin': store.loading }]"
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
        <div class="w-28">
          <WhiteSelect
            :model-value="store.pageSize"
            :options="pageSizeOptions"
            placeholder="每页条数"
            @update:model-value="handlePageSizeChange"
          />
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="px-6 py-3 border-b border-slate-200 flex flex-col md:flex-row gap-3">
      <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
        <div class="w-full md:w-36">
          <WhiteSelect
            :model-value="store.statusFilter"
            :options="statusOptions"
            placeholder="所有状态"
            @update:model-value="handleStatusChange"
          />
        </div>
        <div class="relative w-full md:w-64">
          <input
            class="w-full pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400"
            type="text"
            placeholder="筛选 file_key..."
            :value="store.fileKeyFilter"
            @input="handleFileKeyInput"
          />
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 overflow-y-auto">
      <div class="overflow-x-auto">
        <table class="min-w-[960px] w-full text-left border-collapse">
          <thead
            class="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10"
          >
            <tr>
              <th class="px-6 py-3 w-8"></th>
              <th class="px-6 py-3 cursor-pointer" @click="handleSort('fileKey')">
                file_key
                <span class="ml-1 text-[10px]">{{ getSortIcon('fileKey') }}</span>
              </th>
              <th class="px-6 py-3 cursor-pointer" @click="handleSort('status')">
                状态
                <span class="ml-1 text-[10px]">{{ getSortIcon('status') }}</span>
              </th>
              <th class="px-6 py-3">分块进度</th>
              <th class="px-6 py-3 cursor-pointer" @click="handleSort('updatedAt')">
                更新时间
                <span class="ml-1 text-[10px]">{{ getSortIcon('updatedAt') }}</span>
              </th>
              <th class="px-6 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-sm">
            <template v-if="store.tasks && store.tasks.length > 0">
              <template v-for="task in store.tasks" :key="task.taskId">
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-3">
                    <button
                      class="text-slate-400 hover:text-blue-600"
                      @click="store.toggleExpand(task.taskId)"
                      :title="isExpanded(task.taskId) ? '收起' : '展开'"
                    >
                      <svg
                        class="w-4 h-4 transition-transform"
                        :class="{ 'rotate-90': isExpanded(task.taskId) }"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </td>
                  <td class="px-6 py-3">
                    <div class="font-mono text-xs text-slate-900">{{ task.fileKey }}</div>
                    <div v-if="task.error" class="text-xs text-rose-600 truncate max-w-[360px]">
                      {{ task.error }}
                    </div>
                  </td>
                  <td class="px-6 py-3">
                    <span
                      class="px-2 py-1 rounded-md text-xs font-medium"
                      :class="statusClass(task.status)"
                    >
                      {{ formatStatus(task.status) }}
                    </span>
                  </td>
                  <td class="px-6 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="progressColor(task.status)"
                          :style="{ width: `${getProgress(task)}%` }"
                        ></div>
                      </div>
                      <span class="text-xs font-mono text-slate-500 w-10 text-right">
                        {{ getProgress(task) }}%
                      </span>
                      <span class="text-xs text-slate-400">
                        {{ task.chunksCompleted }}/{{ task.chunksTotal }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-3 text-xs text-slate-500 font-mono">
                    {{ formatTime(task.updatedAt) }}
                  </td>
                  <td class="px-6 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        class="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        :disabled="task.status !== 'pending'"
                        @click="store.cancelTask(task.taskId)"
                        title="取消"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                      <button
                        class="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        :disabled="!(task.status === 'pending' || task.status === 'progressing' || task.status === 'failed')"
                        @click="store.pauseTask(task.taskId)"
                        title="暂停"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="5" width="4" height="14" />
                          <rect x="14" y="5" width="4" height="14" />
                        </svg>
                      </button>
                      <button
                        class="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        :disabled="task.status !== 'paused'"
                        @click="store.resumeTask(task.taskId)"
                        title="继续"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="7,5 19,12 7,19" />
                        </svg>
                      </button>
                      <button
                        class="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        :disabled="task.status !== 'failed'"
                        @click="store.retryTask(task.taskId)"
                        title="重试"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.5 15a8 8 0 1 0 2.2-9.4L1 10" />
                        </svg>
                      </button>
                      <button
                        class="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        :disabled="!(task.status === 'completed' || task.status === 'failed')"
                        @click="store.removeTask(task.taskId)"
                        title="删除"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="isExpanded(task.taskId)">
                  <td colspan="6" class="bg-slate-50/60 px-6 py-4">
                    <div class="tm-kg-chunks-7c1a rounded-lg border border-slate-200 bg-white">
                      <div
                        class="flex items-center justify-between px-4 py-3 border-b border-slate-100"
                      >
                        <div class="text-xs font-semibold text-slate-700">分块列表</div>
                        <div class="flex items-center gap-2">
                          <div class="w-24">
                            <WhiteSelect
                              :model-value="getChunkStatusFilter(task.taskId)"
                              :options="chunkStatusOptions"
                              placeholder="所有状态"
                              @update:model-value="
                                (value) => handleChunkStatusChange(task.taskId, value)
                              "
                            />
                          </div>
                          <div class="w-24">
                            <WhiteSelect
                              :model-value="getChunkPageSize(task.taskId)"
                              :options="pageSizeOptions"
                              placeholder="每页条数"
                              @update:model-value="
                                (value) => handleChunkPageSize(task.taskId, value)
                              "
                            />
                          </div>
                        </div>
                      </div>
                      <div class="max-h-80 overflow-y-auto">
                        <div class="overflow-x-auto">
                        <table class="min-w-[720px] w-full text-left border-collapse text-xs">
                            <thead
                              class="bg-slate-50 text-slate-500 uppercase border-b border-slate-100"
                            >
                              <tr>
                                <th class="px-4 py-2">Index</th>
                                <th class="px-4 py-2">状态</th>
                                <th class="px-4 py-2">错误</th>
                                <th class="px-4 py-2">更新时间</th>
                                <th class="px-4 py-2 text-right">操作</th>
                              </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                              <tr v-if="isChunkLoading(task.taskId)">
                                <td colspan="4" class="px-4 py-4 text-center text-slate-400">
                                  加载中...
                                </td>
                              </tr>
                              <tr v-else-if="getChunkItems(task.taskId).length === 0">
                                <td colspan="4" class="px-4 py-4 text-center text-slate-400">
                                  暂无分块数据
                                </td>
                              </tr>
                              <tr
                                v-for="chunk in getChunkItems(task.taskId)"
                                :key="`${task.taskId}-${chunk.chunkIndex}`"
                              >
                                <td class="px-4 py-2 font-mono text-slate-700">
                                  {{ chunk.chunkIndex }}
                                </td>
                                <td class="px-4 py-2">
                                  <span
                                    class="px-2 py-0.5 rounded-md text-[11px] font-medium"
                                    :class="statusClass(chunk.status)"
                                  >
                                    {{ formatStatus(chunk.status) }}
                                  </span>
                                </td>
                                <td class="px-4 py-2 text-rose-600 truncate max-w-[240px]">
                                  {{ chunk.error || '-' }}
                                </td>
                                <td class="px-4 py-2 text-slate-400 font-mono">
                                  {{ formatTime(chunk.updatedAt) }}
                                </td>
                                <td class="px-4 py-2">
                                  <div class="flex items-center justify-end gap-2">
                                    <button
                                      class="p-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                      :disabled="!(chunk.status === 'failed')"
                                      @click="store.retryChunk(task.taskId, chunk.chunkIndex)"
                                      title="重试"
                                    >
                                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="1 4 1 10 7 10" />
                                        <path d="M3.5 15a8 8 0 1 0 2.2-9.4L1 10" />
                                      </svg>
                                    </button>
                                    <button
                                      class="p-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                      :disabled="!(chunk.status === 'pending' || chunk.status === 'progressing')"
                                      @click="store.cancelChunk(task.taskId, chunk.chunkIndex)"
                                      title="取消"
                                    >
                                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                    </button>
                                    <button
                                      class="p-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                      :disabled="!(chunk.status === 'pending' || chunk.status === 'paused' || chunk.status === 'completed' || chunk.status === 'failed')"
                                      @click="store.removeChunk(task.taskId, chunk.chunkIndex)"
                                      title="删除"
                                    >
                                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M8 6V4h8v2" />
                                        <path d="M19 6l-1 14H6L5 6" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div
                        class="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2"
                      >
                        <button
                          class="px-2 py-1 text-xs rounded border border-slate-200 text-slate-500 disabled:opacity-50"
                          :disabled="getChunkPage(task.taskId) <= 1"
                          @click="handleChunkPage(task.taskId, getChunkPage(task.taskId) - 1)"
                        >
                          上一页
                        </button>
                        <div class="w-24">
                          <WhiteSelect
                            :model-value="getChunkPage(task.taskId)"
                            :options="getChunkPageOptions(task.taskId)"
                            placeholder="页码"
                            @update:model-value="(value) => handleChunkPage(task.taskId, value)"
                          />
                        </div>
                        <button
                          class="px-2 py-1 text-xs rounded border border-slate-200 text-slate-500 disabled:opacity-50"
                          :disabled="getChunkPage(task.taskId) >= getChunkPageCount(task.taskId)"
                          @click="handleChunkPage(task.taskId, getChunkPage(task.taskId) + 1)"
                        >
                          下一页
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </template>

            <tr v-else>
              <td colspan="6" class="px-6 py-10 text-center text-slate-500 text-sm">
                暂无知识图谱任务
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-slate-200 px-6 py-3 flex items-center justify-between">
      <span class="text-xs text-slate-500">
        第 {{ store.page }} / {{ store.pageCount }} 页，共 {{ store.total }} 条
      </span>
      <div class="flex items-center gap-2">
        <button
          class="px-2 py-1 text-xs rounded border border-slate-200 text-slate-500 disabled:opacity-50"
          :disabled="store.page <= 1"
          @click="store.setPage(store.page - 1)"
        >
          上一页
        </button>
        <div class="w-24">
          <WhiteSelect
            :model-value="store.page"
            :options="pageOptions"
            placeholder="页码"
            @update:model-value="handlePageChange"
          />
        </div>
        <button
          class="px-2 py-1 text-xs rounded border border-slate-200 text-slate-500 disabled:opacity-50"
          :disabled="store.page >= store.pageCount"
          @click="store.setPage(store.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { WhiteSelectOption } from '@renderer/components/select/WhiteSelect.vue'
import { useKgMonitorStore } from '@renderer/stores/global-monitor-panel/kg-monitor.store'
import type {
  KgTaskStatus,
  KgTaskSortBy,
  KgChunkStatus
} from '@renderer/stores/global-monitor-panel/kg-monitor.types'

const store = useKgMonitorStore()

onMounted(() => {
  store.fetchTasks()
  autoRefreshTimer = window.setInterval(() => {
    if (!store.loading) {
      store.refresh()
    }
  }, 500)
})

let autoRefreshTimer: number | null = null

onBeforeUnmount(() => {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
})

const statusOptions = computed<WhiteSelectOption[]>(() =>
  store.statusOptions.map((status) => ({
    label: status === 'all' ? '所有状态' : formatStatus(status),
    value: status
  }))
)

const chunkStatusOptions = statusOptions

const pageSizeOptions = computed<WhiteSelectOption[]>(() =>
  [10, 20, 50, 100].map((size) => ({ label: `${size}/页`, value: size }))
)

const pageOptions = computed<WhiteSelectOption[]>(() => {
  const options: WhiteSelectOption[] = []
  for (let i = 1; i <= store.pageCount; i += 1) {
    options.push({ label: `第 ${i} 页`, value: i })
  }
  return options
})

const handleStatusChange = (value: string | number | null) => {
  store.setStatusFilter(value as KgTaskStatus | 'all')
}

const handleFileKeyInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  store.setFileKeyFilter(target.value)
}

const handlePageSizeChange = (value: string | number | null) => {
  store.setPageSize(Number(value))
}

const handlePageChange = (value: string | number | null) => {
  store.setPage(Number(value))
}

const handleSort = (field: KgTaskSortBy) => {
  store.setSort(field)
}

const isExpanded = (taskId: string) => store.expandedTaskId === taskId

const getProgress = (task: { chunksTotal: number; chunksCompleted: number }) => {
  if (!task.chunksTotal) return 0
  return Math.min(100, Math.round((task.chunksCompleted / task.chunksTotal) * 100))
}

const progressColor = (status: KgTaskStatus) => {
  const map: Record<KgTaskStatus, string> = {
    pending: 'bg-amber-500',
    progressing: 'bg-blue-600',
    paused: 'bg-slate-400',
    completed: 'bg-emerald-500',
    failed: 'bg-rose-500'
  }
  return map[status]
}

const statusClass = (status: KgTaskStatus) => {
  const map: Record<KgTaskStatus, string> = {
    pending: 'bg-amber-50 text-amber-700',
    progressing: 'bg-blue-50 text-blue-700',
    paused: 'bg-slate-50 text-slate-600',
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-rose-50 text-rose-700'
  }
  return map[status]
}

const formatStatus = (status: KgTaskStatus) => {
  const map: Record<KgTaskStatus, string> = {
    pending: '等待中',
    progressing: '处理中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败'
  }
  return map[status]
}

const formatTime = (timestamp: number) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getSortIcon = (field: KgTaskSortBy) => {
  if (store.sortBy !== field) return '↕'
  return store.sortDir === 'asc' ? '↑' : '↓'
}

const getChunkState = (taskId: string) => store.getChunkState(taskId)

const getChunkItems = (taskId: string) => {
  const state = getChunkState(taskId)
  if (!state) return []
  if (state.statusFilter === 'all') return state.items
  return state.items.filter((item) => item.status === state.statusFilter)
}

const isChunkLoading = (taskId: string) => getChunkState(taskId)?.loading ?? false

const getChunkPage = (taskId: string) => getChunkState(taskId)?.page ?? 1

const getChunkPageSize = (taskId: string) => getChunkState(taskId)?.pageSize ?? 20
const getChunkStatusFilter = (taskId: string) => store.getChunkStatusFilter(taskId)

const getChunkPageCount = (taskId: string) => {
  const state = getChunkState(taskId)
  if (!state) return 1
  return Math.max(1, Math.ceil(state.total / Math.max(1, state.pageSize)))
}

const getChunkPageOptions = (taskId: string): WhiteSelectOption[] => {
  const count = getChunkPageCount(taskId)
  const options: WhiteSelectOption[] = []
  for (let i = 1; i <= count; i += 1) {
    options.push({ label: `第 ${i} 页`, value: i })
  }
  return options
}

const handleChunkPage = (taskId: string, value: string | number | null) => {
  store.setChunkPage(taskId, Number(value))
}

const handleChunkPageSize = (taskId: string, value: string | number | null) => {
  store.setChunkPageSize(taskId, Number(value))
}

const handleChunkStatusChange = (taskId: string, value: string | number | null) => {
  store.setChunkStatusFilter(taskId, value as KgChunkStatus | 'all')
}
</script>
