/**
 * @file 调度器
 * @description 并发控制 + FIFO 队列调度
 */

import type { ChunkTask } from '@shared/embedding.types'
import type { TaskManager } from './task-manager'
import type { ChannelManager } from '../channel/channel-manager'
import type { ProgressTracker } from './progress-tracker'
import type { EngineToMainMessage } from '@shared/embedding-ipc.types'
import { DEFAULT_SCHEDULER_CONFIG } from '@shared/embedding.types'

// ============================================================================
// Scheduler
// ============================================================================

export class Scheduler {
  /** 待处理队列 */
  private queue: ChunkTask[] = []
  /** 正在运行的任务 */
  private running: Set<string> = new Set()
  /** 最大并发数 */
  private maxConcurrency: number = DEFAULT_SCHEDULER_CONFIG.maxConcurrency
  /** 暂停的文档 ID 集合 */
  private pausedDocuments: Set<string> = new Set()
  /** 取消的文档 ID 集合 */
  private cancelledDocuments: Set<string> = new Set()

  constructor(
    private taskManager: TaskManager,
    private channelManager: ChannelManager,
    private progressTracker: ProgressTracker,
    private sendMessage: (msg: EngineToMainMessage) => void
  ) {}

  // ==========================================================================
  // 并发控制
  // ==========================================================================

  /**
   * 设置最大并发数
   */
  setConcurrency(value: number): void {
    this.maxConcurrency = Math.max(1, Math.min(50, value))
    // 立即尝试处理更多任务
    this.tryProcess()
  }

  /**
   * 获取当前并发数
   */
  getConcurrency(): number {
    return this.maxConcurrency
  }

  // ==========================================================================
  // 队列操作
  // ==========================================================================

  /**
   * 将 chunks 加入队列
   */
  enqueue(chunks: ChunkTask[]): void {
    this.queue.push(...chunks)
    this.tryProcess()
  }

  /**
   * 暂停指定文档的任务
   */
  pause(documentId: string): void {
    this.pausedDocuments.add(documentId)
  }

  /**
   * 恢复指定文档的任务
   */
  resume(documentId: string): void {
    this.pausedDocuments.delete(documentId)
    this.tryProcess()
  }

  /**
   * 取消指定文档的任务
   */
  cancel(documentId: string): void {
    this.cancelledDocuments.add(documentId)
    // 从队列中移除该文档的 chunks
    this.queue = this.queue.filter((chunk) => chunk.documentId !== documentId)
  }

  // ==========================================================================
  // 调度逻辑
  // ==========================================================================

  /**
   * 尝试处理队列中的任务
   */
  private tryProcess(): void {
    while (this.running.size < this.maxConcurrency && this.queue.length > 0) {
      // 查找下一个可处理的 chunk
      const chunkIndex = this.queue.findIndex((chunk) => {
        // 跳过暂停或取消的文档
        if (this.pausedDocuments.has(chunk.documentId)) return false
        if (this.cancelledDocuments.has(chunk.documentId)) return false
        return true
      })

      if (chunkIndex === -1) break

      const chunk = this.queue.splice(chunkIndex, 1)[0]
      this.running.add(chunk.chunkId)

      // 异步处理 chunk
      this.processChunk(chunk).finally(() => {
        this.running.delete(chunk.chunkId)
        this.tryProcess()
      })
    }
  }

  /**
   * 处理单个 chunk
   */
  private async processChunk(chunk: ChunkTask): Promise<void> {
    const { chunkId, documentId, text } = chunk

    // 检查是否已取消
    if (this.cancelledDocuments.has(documentId)) {
      return
    }

    // 更新 chunk 状态为运行中
    this.taskManager.updateChunkStatus(chunkId, 'running')

    // 获取文档的嵌入配置
    const docTask = this.taskManager.getDocumentTask(documentId)
    if (!docTask) {
      this.taskManager.markChunkFailed(chunkId, 'Document task not found')
      return
    }

    try {
      // 调用 ChannelManager 进行嵌入
      const embedding = await this.channelManager.embedWithFallback(
        text,
        docTask.embeddingConfig.modelId,
        docTask.embeddingConfig.dimensions
      )

      // 标记完成
      this.taskManager.markChunkCompleted(chunkId, embedding)

      // 更新进度
      this.progressTracker.onChunkCompleted(documentId)

      // 检查文档是否全部完成
      if (this.taskManager.isDocumentCompleted(documentId)) {
        const embeddings = this.taskManager.getCompletedEmbeddings(documentId)
        this.sendMessage({
          type: 'task:completed',
          documentId,
          taskId: docTask.taskId,
          embeddings
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      this.taskManager.markChunkFailed(chunkId, errorMsg)

      // 检查文档是否全部完成（可能因为失败）
      if (this.taskManager.isDocumentCompleted(documentId)) {
        this.sendMessage({
          type: 'task:failed',
          documentId,
          taskId: docTask.taskId,
          error: `Embedding failed: ${errorMsg}`
        })
      }
    }
  }

  // ==========================================================================
  // 状态查询
  // ==========================================================================

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length
  }

  /**
   * 获取正在运行的任务数
   */
  getRunningCount(): number {
    return this.running.size
  }
}
