/**
 * 批量操作 Composable
 * 负责批量文档解析和分块操作的并发控制与任务管理
 */

import { ref } from 'vue'
import { useParsingStore } from '@renderer/stores/parsing/parsing.store'
import { useChunkingStore } from '@renderer/stores/chunking/chunking.store'
import { useTaskMonitorStore } from '@renderer/stores/global-monitor-panel/task-monitor.store'
import { useKnowledgeLibraryStore } from '@renderer/stores/knowledge-library/knowledge-library.store'
import { canChunkFile, isPlainTextFile } from '@renderer/stores/chunking/chunking.util'
import type { FileNode } from '@renderer/stores/knowledge-library/file.types'
import type { ChunkingConfig } from '@renderer/stores/chunking/chunking.types'

// ========== 批量操作并发控制配置 ==========
export const BATCH_CONFIG = {
  // 文档解析并发数（云端 API，避免限流）
  PARSING_CONCURRENCY: 3,
  // 分块并发数（本地 CPU 密集型，避免卡顿）
  CHUNKING_CONCURRENCY: 5,
  // 默认分块配置
  DEFAULT_CHUNKING_CONFIG: {
    mode: 'recursive' as const,
    maxChars: 1000
  }
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  success: number
  failed: number
}

/**
 * 批量操作 Composable
 */
export function useBatchOperations() {
  const parsingStore = useParsingStore()
  const chunkingStore = useChunkingStore()
  const taskMonitorStore = useTaskMonitorStore()
  const knowledgeLibraryStore = useKnowledgeLibraryStore()

  // 批量操作状态
  const isBatchParsing = ref(false)
  const isBatchChunking = ref(false)

  /**
   * 并发控制队列处理器
   */
  async function processConcurrentQueue<T>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<void>
  ): Promise<BatchOperationResult> {
    let success = 0
    let failed = 0
    const queue = [...items]
    const running: Promise<void>[] = []

    while (queue.length > 0 || running.length > 0) {
      // 填充并发槽位
      while (running.length < concurrency && queue.length > 0) {
        const item = queue.shift()!
        const promise = processor(item)
          .then(() => {
            success++
          })
          .catch((error) => {
            console.error('[BatchOperation] Task failed:', error)
            failed++
          })
          .finally(() => {
            const index = running.indexOf(promise)
            if (index > -1) running.splice(index, 1)
          })
        running.push(promise)
      }

      // 等待至少一个任务完成
      if (running.length > 0) {
        await Promise.race(running)
      }
    }

    return { success, failed }
  }

  /**
   * 批量解析文档
   * @param files 要解析的文件列表
   * @param knowledgeBaseId 知识库 ID
   * @returns 批量操作结果
   */
  async function batchParseDocuments(
    files: FileNode[],
    knowledgeBaseId: number
  ): Promise<BatchOperationResult> {
    if (isBatchParsing.value) {
      console.warn('[BatchParsing] Already parsing')
      return { success: 0, failed: 0 }
    }

    // 过滤出文件类型（排除文件夹）
    const validFiles = files.filter((f) => f.type === 'file')
    if (validFiles.length === 0) {
      console.warn('[BatchParsing] No valid files to parse')
      return { success: 0, failed: 0 }
    }

    isBatchParsing.value = true

    try {
      // 获取知识库名称
      const kb = knowledgeLibraryStore.getById(knowledgeBaseId)
      const knowledgeBaseName = kb?.name || `知识库 ${knowledgeBaseId}`

      console.log(`[BatchParsing] Starting batch parsing for ${validFiles.length} files...`)

      // 并发处理文档解析
      const result = await processConcurrentQueue(
        validFiles,
        BATCH_CONFIG.PARSING_CONCURRENCY,
        async (file) => {
          const fileKey = file.path || file.name
          const fileName = file.name

          try {
            // 启动解析
            await parsingStore.startParsing(fileKey, {
              parserName: 'MinerU Parser',
              knowledgeBaseId
            })

            // 获取解析状态以获取 versionId 和 batchId
            const parsingState = parsingStore.getState(fileKey)
            if (parsingState && parsingState.activeVersionId) {
              const statusRes = await window.api.minerU.getStatus(fileKey)
              if (statusRes.success && statusRes.data) {
                // 添加到任务监控面板
                taskMonitorStore.addDocumentParsingTask(
                  fileKey,
                  fileName,
                  knowledgeBaseId,
                  knowledgeBaseName,
                  parsingState.activeVersionId,
                  statusRes.data.batchId
                )
              }
            }
          } catch (error) {
            console.error(`[BatchParsing] Failed to parse ${fileName}:`, error)
            throw error
          }
        }
      )

      console.log(
        `[BatchParsing] Batch parsing completed: ${result.success} succeeded, ${result.failed} failed`
      )

      return result
    } finally {
      isBatchParsing.value = false
    }
  }

  /**
   * 检查文件是否已解析（通过 parsingStore 判断）
   */
  function isFileParsed(fileKey: string, fileExtension?: string): boolean {
    // 纯文本文件不需要解析
    if (isPlainTextFile(fileExtension)) {
      return true
    }

    // 非纯文本文件需要检查解析状态
    const state = parsingStore.getState(fileKey)
    if (!state || !state.activeVersionId) return false
    
    const version = state.versions.find((v) => v.id === state.activeVersionId)
    return version?.name.includes('完成') || false
  }

  /**
   * 批量分块
   * @param files 要分块的文件列表
   * @param knowledgeBaseId 知识库 ID
   * @returns 批量操作结果
   */
  async function batchChunkDocuments(
    files: FileNode[],
    knowledgeBaseId: number
  ): Promise<BatchOperationResult> {
    if (isBatchChunking.value) {
      console.warn('[BatchChunking] Already chunking')
      return { success: 0, failed: 0 }
    }

    // 过滤出可以分块的文件
    const chunkableFiles = files.filter((file) => {
      if (file.type !== 'file') return false
      const fileKey = file.path || file.name
      const isParsed = isFileParsed(fileKey, file.extension)
      return canChunkFile(file.extension, isParsed)
    })

    if (chunkableFiles.length === 0) {
      console.warn('[BatchChunking] No chunkable files found')
      return { success: 0, failed: 0 }
    }

    // 提示不可分块的文件数量
    const nonChunkableCount = files.length - chunkableFiles.length
    if (nonChunkableCount > 0) {
      console.log(
        `[BatchChunking] Filtered out ${nonChunkableCount} non-chunkable files (need parsing first)`
      )
    }

    isBatchChunking.value = true

    try {
      // 获取知识库名称
      const kb = knowledgeLibraryStore.getById(knowledgeBaseId)
      const knowledgeBaseName = kb?.name || `知识库 ${knowledgeBaseId}`

      console.log(`[BatchChunking] Starting batch chunking for ${chunkableFiles.length} files...`)

      // 并发处理分块
      const result = await processConcurrentQueue(
        chunkableFiles,
        BATCH_CONFIG.CHUNKING_CONCURRENCY,
        async (file) => {
          const fileKey = file.path || file.name
          const fileName = file.name

          try {
            // 添加到任务监控面板
            taskMonitorStore.addChunkingTask(
              fileKey,
              fileName,
              knowledgeBaseId,
              knowledgeBaseName
            )

            // 获取解析版本 ID（对于非纯文本文件）
            let parsingVersionId: string | undefined
            if (!isPlainTextFile(file.extension)) {
              const state = parsingStore.getState(fileKey)
              if (state?.activeVersionId) {
                parsingVersionId = state.activeVersionId
              }
            }

            // 获取该文件的分块配置（如果存在）
            // 优先使用文件已有的分块配置，否则使用默认配置
            let chunkingConfig: ChunkingConfig = BATCH_CONFIG.DEFAULT_CHUNKING_CONFIG
            const existingChunkingState = chunkingStore.getState(fileKey)
            if (existingChunkingState && existingChunkingState.config) {
              chunkingConfig = existingChunkingState.config
              console.log(`[BatchChunking] Using existing config for ${fileName}:`, chunkingConfig)
            } else {
              console.log(`[BatchChunking] Using default config for ${fileName}:`, chunkingConfig)
            }

            // 更新任务状态为 running
            taskMonitorStore.updateChunkingProgress({
              fileKey,
              percentage: 0,
              totalChunks: 0,
              currentDetail: '开始分块...'
            })

            // 执行分块
            const chunkingState = await chunkingStore.startChunking(fileKey, chunkingConfig, {
              knowledgeBaseId,
              fileRelativePath: fileKey,
              parsingVersionId
            })

            // 更新任务进度
            const totalChunks = chunkingState.chunks.length
            taskMonitorStore.updateChunkingProgress({
              fileKey,
              percentage: 100,
              totalChunks,
              currentDetail: `生成了 ${totalChunks} 个分块`
            })

            // 完成任务
            taskMonitorStore.completeChunkingTask(fileKey, totalChunks)
          } catch (error) {
            console.error(`[BatchChunking] Failed to chunk ${fileName}:`, error)
            taskMonitorStore.failChunkingTask(
              fileKey,
              error instanceof Error ? error.message : '分块失败'
            )
            throw error
          }
        }
      )

      console.log(
        `[BatchChunking] Batch chunking completed: ${result.success} succeeded, ${result.failed} failed`
      )

      return result
    } finally {
      isBatchChunking.value = false
    }
  }

  return {
    // 状态
    isBatchParsing,
    isBatchChunking,

    // 方法
    batchParseDocuments,
    batchChunkDocuments
  }
}
