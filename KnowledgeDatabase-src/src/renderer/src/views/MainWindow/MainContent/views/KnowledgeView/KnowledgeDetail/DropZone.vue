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
import { ref, onMounted } from 'vue'
import { useTaskManagerStore } from '@renderer/stores/task-manager.store'
import { useFileListStore } from '@renderer/stores/knowledge-library/file-list.store'
import { useFileCardStore } from '@renderer/stores/knowledge-library/file-card.store'
import { useFileTreeStore } from '@renderer/stores/knowledge-library/file-tree.store'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const emit = defineEmits<{
  (e: 'import-started'): void
}>()

const isDragging = ref(false)
let dragCounter = 0

const taskManager = useTaskManagerStore()
const fileListStore = useFileListStore()
const fileCardStore = useFileCardStore()
const fileTreeStore = useFileTreeStore()

// 全局进度监听器（只设置一次）
let globalListenersSetup = false

function setupGlobalListeners(): void {
  if (globalListenersSetup) return
  globalListenersSetup = true

  // 监听所有导入进度
  window.api.fileImport.onProgress((progress) => {
    taskManager.updateImportProgress(progress)
  })

  // 监听所有导入完成
  window.api.fileImport.onComplete((data) => {
    // data 格式: { taskId: string, result: ImportResult }
    const taskId = data.taskId
    const result = data.result
    taskManager.completeImportTask(taskId, result)

    // 查找任务对应的知识库ID并刷新文件列表
    const task = taskManager.importTasks.get(taskId)
    if (task) {
      refreshFilesForKnowledgeBase(task.knowledgeBaseId)
    }
  })

  // 监听所有导入错误
  window.api.fileImport.onError((data) => {
    // data 格式: { taskId: string, error: string }
    taskManager.failImportTask(data.taskId, data.error)
  })

  console.log('[DropZone] Global import listeners setup')
}

const handleDragEnter = (): void => {
  dragCounter++
  isDragging.value = true
}

const handleDragOver = (): void => {
  isDragging.value = true
}

const handleDragLeave = (): void => {
  dragCounter--
  if (dragCounter <= 0) {
    isDragging.value = false
    dragCounter = 0
  }
}

const handleDrop = async (event: DragEvent): Promise<void> => {
  console.log('[DropZone] handleDrop called', { event, hasDataTransfer: !!event.dataTransfer })
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

    // 启动异步导入（立即返回，不等待）
    const { taskId } = await window.api.fileImport.importAsync(props.knowledgeBaseId, paths, {
      keepStructure: true,
      conflictPolicy: 'rename'
    })

    console.log('[DropZone] Async import started', { taskId })

    // 将任务添加到任务管理器
    taskManager.addImportTask(taskId, props.knowledgeBaseId)

    // 立即返回，不等待导入完成
    emit('import-started')
  } catch (error) {
    console.error('[DropZone] Failed to start import', error)
  }
}

// 刷新指定知识库的文件列表
function refreshFilesForKnowledgeBase(kbId: number): void {
  Promise.allSettled([
    fileListStore.fetchFiles(kbId),
    fileCardStore.fetchFiles(kbId),
    fileTreeStore.fetchFiles(kbId)
  ]).then(() => {
    console.log('[DropZone] Files refreshed for knowledge base', { kbId })
  })
}

onMounted(() => {
  setupGlobalListeners()
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
