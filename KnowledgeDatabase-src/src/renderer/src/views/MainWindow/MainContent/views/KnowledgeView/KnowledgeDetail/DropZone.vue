<template>
  <div
    class="KnowledgeView_KnowledgeDetail_DropZone_wrapper"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <slot />
    <div
      v-if="isDragging || isDropping"
      class="KnowledgeView_KnowledgeDetail_DropZone_overlay"
      :class="{ dropping: isDropping }"
    >
      <div class="overlay-content">
        <div class="overlay-icon">⬆</div>
        <div class="overlay-title">松开鼠标开始导入</div>
        <div class="overlay-desc">支持文件和目录，目录将保留原有结构</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ImportResult } from '@preload/types/file-import.types'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const emit = defineEmits<{
  (e: 'importing'): void
  (e: 'import-finished', result: ImportResult): void
  (e: 'import-error', error: string): void
}>()

const isDragging = ref(false)
const isDropping = ref(false)
let dragCounter = 0

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
    emit('import-error', '无法获取文件路径')
    return
  }

  try {
    isDropping.value = true
    emit('importing')

    console.log('[DropZone] Calling import API', {
      knowledgeBaseId: props.knowledgeBaseId,
      paths,
      options: { keepStructure: true, conflictPolicy: 'rename' }
    })

    const result = await window.api.fileImport.import(props.knowledgeBaseId, paths, {
      keepStructure: true,
      conflictPolicy: 'rename'
    })

    console.log('[DropZone] Import result', result)
    emit('import-finished', result)
  } catch (error) {
    console.error('[DropZone] Import error', error)
    const message = error instanceof Error ? error.message : '导入失败'
    emit('import-error', message)
  } finally {
    isDropping.value = false
  }
}
</script>

<style scoped>
.KnowledgeView_KnowledgeDetail_DropZone_wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.KnowledgeView_KnowledgeDetail_DropZone_overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(2px);
  border: 2px dashed rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e2e8f0;
  z-index: 20;
  animation: fadeIn 120ms ease;
}

.KnowledgeView_KnowledgeDetail_DropZone_overlay.dropping {
  animation: pulse 280ms ease;
}

.overlay-content {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transform: scale(1);
  animation: popIn 180ms ease;
}

.overlay-icon {
  font-size: 2.4rem;
  line-height: 1;
}

.overlay-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.overlay-desc {
  font-size: 0.9rem;
  color: #cbd5e1;
}

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
