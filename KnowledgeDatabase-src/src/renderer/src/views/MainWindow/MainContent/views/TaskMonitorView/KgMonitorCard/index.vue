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

    <!-- 嵌入状态监控区域 -->
    <div
      v-if="embeddingStatus"
      class="tm-kg-embedding-monitor-a7f2 px-6 py-3 border-b border-slate-200 bg-slate-50/50"
    >
      <div class="flex items-center gap-3 flex-wrap">
        <!-- 状态指示灯 + 标签 -->
        <div class="flex items-center gap-2">
          <span class="inline-block w-2 h-2 rounded-full" :class="embeddingStateColor"></span>
          <span class="text-xs font-medium text-slate-700">向量嵌入</span>
          <span class="px-1.5 py-0.5 rounded text-[11px] font-medium" :class="embeddingStateBadge">
            {{ embeddingStateLabel }}
          </span>
        </div>

        <!-- 并列进度条：实体 / 关系 -->
        <div v-if="hasEntityEmbedding" class="flex items-center gap-2">
          <span class="text-[11px] text-slate-500">实体</span>
          <div class="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="embeddingStatus.state === 'error' ? 'bg-rose-500' : 'bg-blue-500'"
              :style="{ width: `${entityEmbeddingPercent}%` }"
            ></div>
          </div>
          <span class="text-[11px] font-mono text-slate-500">
            {{ embeddingStatus.entityCompleted }}/{{ embeddingStatus.entityTotal }}
          </span>
        </div>

        <div v-if="hasRelationEmbedding" class="flex items-center gap-2">
          <span class="text-[11px] text-slate-500">关系</span>
          <div class="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="embeddingStatus.state === 'error' ? 'bg-rose-500' : 'bg-indigo-500'"
              :style="{ width: `${relationEmbeddingPercent}%` }"
            ></div>
          </div>
          <span class="text-[11px] font-mono text-slate-500">
            {{ embeddingStatus.relationCompleted }}/{{ embeddingStatus.relationTotal }}
          </span>
        </div>

        <div v-if="embeddingStatus.total > 0" class="text-[11px] text-slate-400">
          总计: {{ embeddingStatus.completed }}/{{ embeddingStatus.total }}
        </div>

        <!-- HNSW 索引状态 -->
        <span
          class="px-1.5 py-0.5 rounded text-[11px] font-medium"
          :class="
            embeddingStatus.entityHnswIndexReady
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          "
        >
          实体 HNSW {{ embeddingStatus.entityHnswIndexReady ? '✓' : '…' }}
        </span>
        <span
          class="px-1.5 py-0.5 rounded text-[11px] font-medium"
          :class="
            embeddingStatus.relationHnswIndexReady
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          "
        >
          关系 HNSW {{ embeddingStatus.relationHnswIndexReady ? '✓' : '…' }}
        </span>

        <!-- 最近批次摘要 -->
        <span v-if="embeddingStatus.lastBatchInfo" class="text-[11px] text-slate-400">
          批次[{{ embeddingStatus.lastBatchInfo.target === 'entity' ? '实体' : '关系' }}]:
          {{ embeddingStatus.lastBatchInfo.successCount }}成功
          <template v-if="embeddingStatus.lastBatchInfo.failCount > 0">
            / {{ embeddingStatus.lastBatchInfo.failCount }}失败
          </template>
          ({{ embeddingStatus.lastBatchInfo.durationMs }}ms)
        </span>

        <!-- 错误信息（可折叠） -->
        <button
          v-if="embeddingStatus.lastError"
          class="text-[11px] text-rose-600 hover:underline cursor-pointer"
          @click="embeddingErrorExpanded = !embeddingErrorExpanded"
        >
          {{ embeddingErrorExpanded ? '收起错误' : '查看错误' }}
        </button>
      </div>
      <div
        v-if="embeddingStatus.lastError && embeddingErrorExpanded"
        class="mt-2 p-2 bg-rose-50 rounded text-[11px] text-rose-700 font-mono break-all"
      >
        {{ embeddingStatus.lastError }}
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
                        <svg
                          class="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                      <button
                        class="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        :disabled="
                          !(
                            task.status === 'pending' ||
                            task.status === 'progressing' ||
                            task.status === 'failed'
                          )
                        "
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
                        <svg
                          class="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
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
                        <svg
                          class="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
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
                                      <svg
                                        class="w-3.5 h-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                      >
                                        <polyline points="1 4 1 10 7 10" />
                                        <path d="M3.5 15a8 8 0 1 0 2.2-9.4L1 10" />
                                      </svg>
                                    </button>
                                    <button
                                      class="p-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                      :disabled="
                                        !(
                                          chunk.status === 'pending' ||
                                          chunk.status === 'progressing'
                                        )
                                      "
                                      @click="store.cancelChunk(task.taskId, chunk.chunkIndex)"
                                      title="取消"
                                    >
                                      <svg
                                        class="w-3.5 h-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                      >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                    </button>
                                    <button
                                      class="p-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                      :disabled="
                                        !(
                                          chunk.status === 'pending' ||
                                          chunk.status === 'paused' ||
                                          chunk.status === 'completed' ||
                                          chunk.status === 'failed'
                                        )
                                      "
                                      @click="store.removeChunk(task.taskId, chunk.chunkIndex)"
                                      title="删除"
                                    >
                                      <svg
                                        class="w-3.5 h-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                      >
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
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { WhiteSelectOption } from '@renderer/components/select/WhiteSelect.vue'
import { useKgMonitorStore } from '@renderer/stores/global-monitor-panel/kg-monitor.store'
import type {
  KgTaskStatus,
  KgTaskSortBy,
  KgChunkStatus
} from '@renderer/stores/global-monitor-panel/kg-monitor.types'
import type { KGEmbeddingProgressData } from '@preload/types/knowledge-graph.types'

const store = useKgMonitorStore()

// ============================================================================
// 嵌入状态监控
// ============================================================================
const embeddingStatus = ref<KGEmbeddingProgressData | null>(null)
const embeddingErrorExpanded = ref(false)
let embeddingPollTimer: number | null = null
let unsubEmbeddingProgress: (() => void) | null = null

const hasEntityEmbedding = computed(() => {
  if (!embeddingStatus.value) return false
  return (
    embeddingStatus.value.entityTotal > 0 ||
    embeddingStatus.value.entityCompleted > 0 ||
    embeddingStatus.value.entityPending > 0
  )
})

const hasRelationEmbedding = computed(() => {
  if (!embeddingStatus.value) return false
  return (
    embeddingStatus.value.relationTotal > 0 ||
    embeddingStatus.value.relationCompleted > 0 ||
    embeddingStatus.value.relationPending > 0
  )
})

const entityEmbeddingPercent = computed(() => {
  if (!embeddingStatus.value || !embeddingStatus.value.entityTotal) return 0
  return Math.min(
    100,
    Math.round((embeddingStatus.value.entityCompleted / embeddingStatus.value.entityTotal) * 100)
  )
})

const relationEmbeddingPercent = computed(() => {
  if (!embeddingStatus.value || !embeddingStatus.value.relationTotal) return 0
  return Math.min(
    100,
    Math.round(
      (embeddingStatus.value.relationCompleted / embeddingStatus.value.relationTotal) * 100
    )
  )
})

const embeddingStateLabel = computed(() => {
  if (!embeddingStatus.value) return ''
  const map: Record<string, string> = { idle: '空闲', active: '处理中', error: '错误' }
  return map[embeddingStatus.value.state] ?? embeddingStatus.value.state
})

const embeddingStateColor = computed(() => {
  if (!embeddingStatus.value) return 'bg-slate-300'
  const map: Record<string, string> = {
    idle: 'bg-emerald-500',
    active: 'bg-blue-500 animate-pulse',
    error: 'bg-rose-500'
  }
  return map[embeddingStatus.value.state] ?? 'bg-slate-300'
})

const embeddingStateBadge = computed(() => {
  if (!embeddingStatus.value) return ''
  const map: Record<string, string> = {
    idle: 'bg-emerald-50 text-emerald-700',
    active: 'bg-blue-50 text-blue-700',
    error: 'bg-rose-50 text-rose-700'
  }
  return map[embeddingStatus.value.state] ?? ''
})

function isEmbeddingIdleCompleted(data: KGEmbeddingProgressData): boolean {
  return data.state === 'idle' && data.total > 0 && data.pending === 0
}

function stopEmbeddingPolling(): void {
  if (embeddingPollTimer) {
    window.clearInterval(embeddingPollTimer)
    embeddingPollTimer = null
  }
}

async function pollEmbeddingStatus(): Promise<void> {
  try {
    const result = await window.api.knowledgeGraph.queryEmbeddingStatus()
    if (result) {
      embeddingStatus.value = result
      if (isEmbeddingIdleCompleted(result)) stopEmbeddingPolling()
    }
  } catch {
    // 静默忽略
  }
}

onMounted(() => {
  store.fetchTasks()
  autoRefreshTimer = window.setInterval(() => {
    if (!store.loading) {
      store.refresh()
    }
  }, 500)

  // 嵌入状态轮询（0.5s）
  pollEmbeddingStatus()
  embeddingPollTimer = window.setInterval(pollEmbeddingStatus, 500)

  // 监听嵌入进度推送
  unsubEmbeddingProgress = window.api.knowledgeGraph.onEmbeddingProgress((data) => {
    embeddingStatus.value = data
    if (isEmbeddingIdleCompleted(data)) stopEmbeddingPolling()
  })
})

let autoRefreshTimer: number | null = null

onBeforeUnmount(() => {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  if (embeddingPollTimer) {
    window.clearInterval(embeddingPollTimer)
    embeddingPollTimer = null
  }
  unsubEmbeddingProgress?.()
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
