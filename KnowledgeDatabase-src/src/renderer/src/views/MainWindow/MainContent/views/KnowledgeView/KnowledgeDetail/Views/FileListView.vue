<template>
  <div class="px-8 pb-8 flex flex-col gap-4">
    <!-- 表格容器 -->
    <div
      class="bg-white border border-slate-200 rounded-xl overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
    >
      <div class="flex flex-col" :style="{ minWidth: totalWidth + 'px' }">
        <!-- 表头 -->
        <div class="flex bg-slate-50 border-b border-slate-200 sticky top-0 z-10 select-none">
          <!-- 复选框列 -->
          <div
            v-if="isSelectionModeEnabled"
            class="flex items-center justify-center px-4 py-3.5 relative"
            :style="{ width: columns[0].width + 'px' }"
          >
            <input
              type="checkbox"
              class="w-4 h-4 cursor-pointer accent-indigo-600"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="handleSelectAll"
            />
          </div>

          <!-- 动态列 -->
          <div
            v-for="(col, index) in displayColumns"
            :key="col.id"
            class="flex items-center px-4 py-3.5 relative transition-colors hover:bg-slate-100"
            :class="{
              'flex-1': index === displayColumns.length - 1,
              'justify-end': index === displayColumns.length - 1
            }"
            :style="
              index < displayColumns.length - 1
                ? { width: col.width + 'px' }
                : { minWidth: col.width + 'px' }
            "
          >
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {{ col.label }}
            </span>

            <!-- 拖拽手柄 -->
            <div
              v-if="index < displayColumns.length - 1"
              class="absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center z-20 transition-colors hover:bg-blue-500/10"
              :class="{ 'bg-blue-500/20': activeResizer === index }"
              @mousedown="handleMouseDown($event, index)"
            >
              <div
                class="w-px h-4 bg-slate-300 transition-colors"
                :class="{ '!bg-blue-500': activeResizer === index }"
              />
            </div>
          </div>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="flex items-center justify-center py-12 border-b-0">
          <div
            class="flex flex-col items-center gap-3 text-slate-400"
            :style="{ minWidth: totalWidth + 'px' }"
          >
            <svg
              class="w-8 h-8 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"
              />
            </svg>
            <span>加载中...</span>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-else-if="paginatedFiles.length === 0"
          class="flex items-center justify-center py-12 border-b-0"
        >
          <div
            class="flex flex-col items-center gap-3 text-slate-400"
            :style="{ minWidth: totalWidth + 'px' }"
          >
            <svg
              class="w-12 h-12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <span>暂无文件</span>
          </div>
        </div>

        <!-- 文件列表 -->
        <div v-else class="bg-white">
          <div
            v-for="file in paginatedFiles"
            :key="file.id"
            class="flex items-center border-b border-slate-100 transition-colors hover:bg-slate-50 last:border-b-0 min-h-14 group"
            @contextmenu.prevent="handleContextMenu($event, file)"
          >
            <!-- 复选框列 -->
            <div
              v-if="isSelectionModeEnabled"
              class="flex items-center justify-center px-2 py-3.5"
              :style="{ width: columns[0].width + 'px' }"
            >
              <input
                type="checkbox"
                class="w-4 h-4 cursor-pointer accent-indigo-600"
                :checked="isFileSelected(file.id)"
                @change="handleToggleSelection(file.id)"
                @click.stop
              />
            </div>

            <!-- 名称列 -->
            <div
              class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-900 min-w-0"
              :style="{ width: displayColumns[0].width + 'px' }"
            >
              <div class="shrink-0 p-2 bg-slate-100 rounded-lg flex items-center justify-center">
                <svg
                  class="w-5 h-5 text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
              </div>
              <div class="flex items-center min-w-0 w-full" :title="file.name">
                <span class="truncate">{{ getHeadName(file.name) }}</span>
                <span v-if="file.name.length > 10" class="shrink-0">{{
                  getTailName(file.name)
                }}</span>
              </div>
            </div>

            <!-- 状态列 -->
            <div
              class="flex items-center px-4 py-3.5 text-sm"
              :style="{ width: displayColumns[1].width + 'px' }"
            >
              <div class="flex flex-col gap-0.5 w-full">
                <span
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border w-fit"
                  :class="statusClasses[file.status || 'pending']"
                >
                  <span :class="{ 'animate-spin': file.status === 'parsing' }">
                    {{ statusIcons[file.status || 'pending'] }}
                  </span>
                  <span>{{ statusLabels[file.status || 'pending'] }}</span>
                </span>
                <!-- 嵌入模型信息（展示所有嵌入表） -->
                <div
                  v-if="file.status === 'embedded' && file.embeddingInfo?.length"
                  class="flex flex-wrap gap-1 mt-0.5"
                >
                  <span
                    v-for="(emb, idx) in file.embeddingInfo"
                    :key="idx"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 border border-purple-200"
                    :title="`${emb.configName} (${emb.dimensions}d)`"
                  >
                    {{ emb.configName }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 大小列 -->
            <div
              class="flex items-center px-4 py-3.5 text-sm text-slate-500"
              :style="{ width: displayColumns[2].width + 'px' }"
            >
              {{ file.size || '-' }}
            </div>

            <!-- 分块数列 -->
            <div
              class="flex items-center px-4 py-3.5 text-sm text-slate-500"
              :style="{ width: displayColumns[3].width + 'px' }"
            >
              {{ file.chunkCount || '-' }}
            </div>

            <!-- 更新时间列 -->
            <div
              class="flex items-center px-4 py-3.5 text-sm text-slate-500"
              :style="{ width: displayColumns[4].width + 'px' }"
            >
              {{ formatUpdateTime(file.updateTime) }}
            </div>

            <!-- 操作列 -->
            <div
              class="flex items-center justify-end px-4 py-3.5 flex-1"
              :style="{ minWidth: displayColumns[5].width + 'px' }"
            >
              <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-all"
                  title="详情"
                  @click="$emit('show-detail', file)"
                >
                  <svg
                    class="w-[18px] h-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
                <button
                  class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                  title="删除"
                  @click="handleDeleteFile(file)"
                >
                  <svg
                    class="w-[18px] h-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M3 6h18" />
                    <path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="flex justify-between items-center pt-6 mt-4 border-t border-slate-100">
      <div class="text-sm text-slate-500">
        显示第 {{ startIndex + 1 }}-{{ endIndex }} 条，共 {{ totalFiles }} 条
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-sm font-medium transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          上一页
        </button>

        <div class="flex gap-1">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="min-w-9 h-9 px-2 border rounded-lg text-sm font-medium transition-all flex items-center justify-center"
            :class="
              page === currentPage
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
            "
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </div>

        <button
          class="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 rounded-lg text-sm font-medium transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          下一页
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="contextMenuVisible"
          class="fixed bg-white rounded-lg shadow-lg border border-slate-200 p-1 min-w-[180px] z-[2000]"
          :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
          @click="closeContextMenu"
        >
          <button
            class="flex items-center gap-3 w-full px-3.5 py-2.5 text-sm text-slate-700 rounded-md transition-colors hover:bg-slate-50"
            @click="handleShowDetail"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            查看详情
          </button>
          <button
            class="flex items-center gap-3 w-full px-3.5 py-2.5 text-sm text-slate-700 rounded-md transition-colors hover:bg-slate-50"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            重命名
          </button>
          <div class="h-px bg-slate-100 my-1" />
          <button
            class="flex items-center gap-3 w-full px-3.5 py-2.5 text-sm text-red-600 rounded-md transition-colors hover:bg-red-50"
            @click="handleDeleteFromContextMenu"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 6h18" />
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              />
            </svg>
            删除
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileSelectionStore } from '@renderer/stores/knowledge-library/file-selection.store'
import { useFileDataStore } from '@renderer/stores/knowledge-library/file-data.store'
import type { FileNode } from '../../types'

// ============ Props & Emits ============

const props = defineProps<{
  knowledgeBaseId: number
  pageSize?: number
}>()

const emit = defineEmits<{
  (e: 'show-detail', file: FileNode): void
}>()

// ============ Stores ============

const fileListStore = useFileListStore()
const selectionStore = useFileSelectionStore()
const fileDataStore = useFileDataStore()

// ============ 状态配置 ============

const statusClasses: Record<string, string> = {
  embedded: 'bg-purple-50 text-purple-600 border-purple-200', // 嵌入状态（最高优先级）
  parsed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  parsing: 'bg-amber-50 text-amber-600 border-amber-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
  pending: 'bg-slate-100 text-slate-500 border-slate-200'
}

const statusIcons: Record<string, string> = {
  embedded: '✨', // 星星图标表示已嵌入
  parsed: '✓',
  parsing: '⟳',
  failed: '✕',
  pending: '○'
}

const statusLabels: Record<string, string> = {
  embedded: '已嵌入', // 优先显示嵌入状态
  parsed: '已解析',
  parsing: '解析中',
  failed: '解析失败',
  pending: '待解析'
}

// ============ 文件名处理 ============

const getHeadName = (name: string): string => {
  if (name.length <= 10) return name
  return name.slice(0, name.length - 7)
}

const getTailName = (name: string): string => {
  if (name.length <= 10) return ''
  return name.slice(-7)
}

// ============ 选择模式 ============

const isSelectionModeEnabled = computed(() => {
  return selectionStore.isSelectionModeEnabled(props.knowledgeBaseId)
})

// ============ 列宽调整 ============

interface Column {
  id: string
  label: string
  width: number
  minWidth: number
}

const checkboxColumn: Column = { id: 'checkbox', label: '', width: 50, minWidth: 50 }

const dataColumns = ref<Column[]>([
  { id: 'name', label: '名称', width: 350, minWidth: 200 },
  { id: 'status', label: '状态', width: 140, minWidth: 120 },
  { id: 'size', label: '大小', width: 100, minWidth: 80 },
  { id: 'chunkCount', label: '分块数', width: 100, minWidth: 80 },
  { id: 'updateTime', label: '更新时间', width: 180, minWidth: 150 },
  { id: 'actions', label: '', width: 100, minWidth: 80 }
])

const columns = computed(() => {
  return isSelectionModeEnabled.value ? [checkboxColumn, ...dataColumns.value] : dataColumns.value
})

const displayColumns = computed(() => dataColumns.value)

const totalWidth = computed(() => {
  return columns.value.reduce((acc, col) => acc + col.width, 0)
})

// 拖拽状态
interface ResizerState {
  index: number
  startX: number
  startWidth: number
}

const activeResizer = ref<number | null>(null)
const resizerState = ref<ResizerState | null>(null)

const handleMouseDown = (event: MouseEvent, index: number) => {
  event.preventDefault()
  activeResizer.value = index
  resizerState.value = {
    index,
    startX: event.clientX,
    startWidth: dataColumns.value[index].width
  }
}

const handleMouseMove = (event: MouseEvent) => {
  if (!resizerState.value) return
  const deltaX = event.clientX - resizerState.value.startX
  const newWidth = Math.max(
    dataColumns.value[resizerState.value.index].minWidth,
    resizerState.value.startWidth + deltaX
  )
  dataColumns.value[resizerState.value.index].width = newWidth
}

const handleMouseUp = () => {
  activeResizer.value = null
  resizerState.value = null
  document.body.style.cursor = ''
}

watch(activeResizer, (newValue) => {
  if (newValue !== null) {
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  } else {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
})

// ============ Store 数据 ============

watch(
  () => props.pageSize,
  (newSize) => {
    if (newSize) fileListStore.setPageSize(newSize)
  },
  { immediate: true }
)

const paginatedFiles = computed(() => fileListStore.paginatedFiles)
const totalFiles = computed(() => fileListStore.totalFiles)
const totalPages = computed(() => fileListStore.totalPages)
const startIndex = computed(() => fileListStore.startIndex)
const endIndex = computed(() => fileListStore.endIndex)
const currentPage = computed(() => fileListStore.currentPage)
const loading = computed(() => fileListStore.loading)

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 7
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

const goToPage = (page: number) => {
  fileListStore.goToPage(page)
  const container = document.querySelector('.KnowledgeView_KnowledgeDetail_content_scrollable')
  if (container) container.scrollTop = 0
}

// 数据由父组件通过 FileDataStore 统一加载，此处不再触发 fetch

// ============ 工具函数 ============

const formatUpdateTime = (time?: string) => {
  if (!time) return '-'
  try {
    const date = new Date(time)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return time
  }
}

// ============ 右键菜单 ============

const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuFile = ref<FileNode | null>(null)

const handleContextMenu = (event: MouseEvent, file: FileNode) => {
  contextMenuFile.value = file
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuVisible.value = true
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
  contextMenuFile.value = null
}

const handleShowDetail = () => {
  if (contextMenuFile.value) emit('show-detail', contextMenuFile.value)
  closeContextMenu()
}

// ============ 删除文件 ============

const deletingFileId = ref<string | number | null>(null)

const handleDeleteFile = async (file: FileNode): Promise<void> => {
  if (!props.knowledgeBaseId || deletingFileId.value !== null) return

  const confirmed = window.confirm(`确定要删除 "${file.name}" 吗？\n\n此操作不可撤销。`)
  if (!confirmed) return

  deletingFileId.value = file.id
  try {
    const filePath = file.path || file.name
    const result = await window.api.file.deleteFile(props.knowledgeBaseId, filePath)
    if (result.success) {
      await fileDataStore.refresh()
    } else {
      alert(`删除失败: ${result.error || '未知错误'}`)
    }
  } catch (error) {
    console.error('[FileListView] Failed to delete file:', error)
    alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
  } finally {
    deletingFileId.value = null
  }
}

const handleDeleteFromContextMenu = (): void => {
  if (contextMenuFile.value) handleDeleteFile(contextMenuFile.value)
  closeContextMenu()
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu)
})

// ============ 选择功能 ============

const isFileSelected = (fileId: string | number): boolean => {
  return selectionStore.isSelected(props.knowledgeBaseId, fileId)
}

const handleToggleSelection = (fileId: string | number): void => {
  selectionStore.toggleSelection(props.knowledgeBaseId, fileId)
}

const isAllSelected = computed(() => {
  const allFileIds = fileListStore.files.map((f) => f.id)
  return selectionStore.isAllSelected(props.knowledgeBaseId, allFileIds)
})

const isIndeterminate = computed(() => {
  const allFileIds = fileListStore.files.map((f) => f.id)
  const selectedCount = selectionStore.getSelectedCount(props.knowledgeBaseId)
  return selectedCount > 0 && selectedCount < allFileIds.length
})

const handleSelectAll = (event: Event): void => {
  const target = event.target as HTMLInputElement
  const allFileIds = fileListStore.files.map((f) => f.id)
  if (target.checked) {
    selectionStore.selectAll(props.knowledgeBaseId, allFileIds)
  } else {
    selectionStore.deselectAll(props.knowledgeBaseId)
  }
}
</script>
