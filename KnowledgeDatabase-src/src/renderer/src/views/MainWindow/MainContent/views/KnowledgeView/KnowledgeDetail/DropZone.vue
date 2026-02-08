<template>
  <div
    class="KnowledgeView_KnowledgeDetail_DropZone_wrapper dropzone-wrapper relative w-full flex-1 flex flex-col overflow-hidden min-h-0"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <slot />
    <div
      v-if="isDragging"
      class="KnowledgeView_KnowledgeDetail_DropZone_overlay dropzone-overlay absolute inset-0 bg-slate-900/50 backdrop-blur-sm border-2 border-dashed border-white/60 rounded-xl flex items-center justify-center text-slate-200 z-20 animate-[fadeIn_120ms_ease]"
    >
      <div
        class="overlay-content text-center flex flex-col gap-1.5 scale-100 animate-[popIn_180ms_ease]"
      >
        <div class="overlay-icon text-4xl leading-none">⬆</div>
        <div class="overlay-title text-lg font-semibold">松开鼠标开始导入</div>
        <div class="overlay-desc text-sm text-slate-300">支持文件和目录，目录将保留原有结构</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import { useFileDataStore } from '@renderer/stores/knowledge-library/file-data.store'
import type { TaskHandle } from '@preload/types'

const props = defineProps<{
  knowledgeBaseId: number
  isTreeView?: boolean // 是否为树视图模式
}>()

const emit = defineEmits<{
  (e: 'import-started'): void
}>()

const isDragging = ref(false)
let dragCounter = 0
let externalDropTargetPath: string | null = null

// 存储活跃的导入任务 Handle
const activeImportTasks: Map<string, TaskHandle> = new Map()

const knowledgeLibraryStore = useKnowledgeLibraryStore()
const fileDataStore = useFileDataStore()

// 获取当前知识库名称
const currentKnowledgeBase = computed(() => {
  return knowledgeLibraryStore.knowledgeBases.find((kb) => kb.id === props.knowledgeBaseId)
})

const knowledgeBaseName = computed(() => {
  return currentKnowledgeBase.value?.name || `知识库 #${props.knowledgeBaseId}`
})

// 全局进度监听器（只设置一次）
let globalListenersSetup = false

function setupGlobalListeners(): void {
  if (globalListenersSetup) return
  globalListenersSetup = true

  // 监听所有导入进度
  window.api.fileImport.onProgress((progress) => {
    const taskHandle = activeImportTasks.get(progress.taskId)
    if (taskHandle) {
      taskHandle.updateProgress(progress.percentage, {
        processed: progress.processed,
        totalFiles: progress.totalFiles,
        imported: progress.imported,
        failed: progress.failed,
        currentFile: progress.currentFile
      })
    }
  })

  // 监听所有导入完成
  window.api.fileImport.onComplete((data) => {
    const taskHandle = activeImportTasks.get(data.taskId)
    if (taskHandle) {
      taskHandle.complete({ result: data.result })
      activeImportTasks.delete(data.taskId)
    }

    // 刷新文件列表
    refreshFilesForKnowledgeBase(data.meta?.knowledgeBaseId ?? props.knowledgeBaseId)
  })

  // 监听所有导入错误
  window.api.fileImport.onError((data) => {
    const taskHandle = activeImportTasks.get(data.taskId)
    if (taskHandle) {
      taskHandle.fail(data.error)
      activeImportTasks.delete(data.taskId)
    }
  })

  console.log('[DropZone] Global import listeners setup')
}

const handleDragEnter = (event: DragEvent): void => {
  // 在树视图模式下，如果拖拽到树节点，不显示全局覆盖层
  if (props.isTreeView && event.target !== event.currentTarget) {
    // 事件来自子元素（树节点），不处理
    return
  }
  dragCounter++
  isDragging.value = true
}

const handleDragOver = (event: DragEvent): void => {
  // 在树视图模式下，如果拖拽到树节点，不显示全局覆盖层
  if (props.isTreeView && event.target !== event.currentTarget) {
    // 事件来自子元素（树节点），不处理
    return
  }
  isDragging.value = true
}

const handleDragLeave = (event: DragEvent): void => {
  // 在树视图模式下，如果离开到树节点，不处理
  if (props.isTreeView && event.relatedTarget instanceof HTMLElement) {
    const treeContainer = document.querySelector(
      '.KnowledgeView_KnowledgeDetail_Views_FileTreeView_container'
    )
    if (treeContainer?.contains(event.relatedTarget)) {
      return
    }
  }
  dragCounter--
  if (dragCounter <= 0) {
    isDragging.value = false
    dragCounter = 0
  }
}

// 监听树节点的外部拖拽事件
const handleTreeNodeExternalDrop = (event: CustomEvent): void => {
  externalDropTargetPath = event.detail.targetPath || null
  console.log('[DropZone] Tree node external drop target set', {
    targetPath: externalDropTargetPath
  })
}

const handleDrop = async (event: DragEvent): Promise<void> => {
  console.log('[DropZone] handleDrop called', { event, hasDataTransfer: !!event.dataTransfer })

  // 在树视图模式下，如果拖拽到树节点，不处理（由树节点自己处理）
  if (props.isTreeView && event.target !== event.currentTarget) {
    const treeContainer = document.querySelector(
      '.KnowledgeView_KnowledgeDetail_Views_FileTreeView_container'
    )
    if (treeContainer?.contains(event.target as Node)) {
      // 事件来自树节点，不处理
      return
    }
  }

  isDragging.value = false
  dragCounter = 0

  const files = event.dataTransfer?.files
  console.log('[DropZone] files from dataTransfer', {
    filesCount: files?.length || 0,
    files: Array.from(files || []).map((f) => ({ name: f.name, type: f.type }))
  })

  if (!files || files.length === 0) {
    console.warn('[DropZone] No files in dataTransfer')
    return
  }

  // 使用 Electron 推荐的方法获取文件路径
  const paths: string[] = []

  for (const file of Array.from(files)) {
    try {
      // 方法1: 使用 webFrame.getPathForFile (Electron 推荐方法)
      const filePath = window.api.utils.getPathForFile(file)
      console.log('[DropZone] Got path via getPathForFile', { name: file.name, path: filePath })
      if (filePath) {
        paths.push(filePath)
        continue
      }
    } catch (error) {
      console.warn('[DropZone] getPathForFile failed, trying fallback', error)
    }

    // 方法2: 回退到直接访问 path 属性
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const directPath = (file as any).path
    if (directPath) {
      console.log('[DropZone] Got path via direct property', { name: file.name, path: directPath })
      paths.push(directPath)
    } else {
      console.warn('[DropZone] Failed to get path for file', { name: file.name })
    }
  }

  console.log('[DropZone] Extracted paths', { pathsCount: paths.length, paths })

  if (paths.length === 0) {
    console.error('[DropZone] Failed to extract any file paths')
    return
  }

  try {
    // 确保全局监听器已设置
    setupGlobalListeners()

    console.log('[DropZone] Starting async import', {
      knowledgeBaseId: props.knowledgeBaseId,
      paths,
      options: { keepStructure: true, conflictPolicy: 'rename' }
    })

    // 如果有目标目录（从树节点拖拽），添加到选项中
    const importOptions: { keepStructure: boolean; conflictPolicy: 'rename'; targetPath?: string } =
      {
        keepStructure: true,
        conflictPolicy: 'rename'
      }

    // 如果设置了目标目录，添加到选项
    if (externalDropTargetPath) {
      importOptions.targetPath = externalDropTargetPath
      console.log('[DropZone] Importing to target directory', {
        targetPath: externalDropTargetPath
      })
    }

    // 启动异步导入（立即返回，不等待）
    const { taskId } = await window.api.fileImport.importAsync(
      props.knowledgeBaseId,
      paths,
      importOptions
    )

    console.log('[DropZone] Async import started', { taskId, importOptions })

    // 创建任务并存储 Handle
    const taskHandle = await window.api.taskMonitor.createTask({
      type: 'file-import',
      title: `文件导入 - ${knowledgeBaseName.value}`,
      meta: {
        taskId,
        knowledgeBaseId: props.knowledgeBaseId,
        knowledgeBaseName: knowledgeBaseName.value,
        totalFiles: paths.length
      }
    })
    activeImportTasks.set(taskId, taskHandle)

    // 清除目标目录（避免下次拖拽时使用旧的目标）
    externalDropTargetPath = null

    // 立即返回，不等待导入完成
    emit('import-started')
  } catch (error) {
    console.error('[DropZone] Failed to start import', error)
    // 清除目标目录
    externalDropTargetPath = null
  }
}

// 刷新指定知识库的文件列表
function refreshFilesForKnowledgeBase(kbId: number): void {
  fileDataStore.fetchFiles(kbId).then(() => {
    console.log('[DropZone] Files refreshed for knowledge base', { kbId })
  })
}

onMounted(() => {
  setupGlobalListeners()
  // 监听树节点的外部拖拽事件
  window.addEventListener('tree-node-external-drop', handleTreeNodeExternalDrop as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('tree-node-external-drop', handleTreeNodeExternalDrop as EventListener)
})
</script>

<style scoped>
/* 保留原类名用于开发定位，样式已迁移到 Tailwind CSS */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes popIn {
  from {
    transform: scale(0.96);
    opacity: 0.8;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.98);
    opacity: 0.9;
  }
  100% {
    transform: scale(0.92);
    opacity: 0;
  }
}
</style>
