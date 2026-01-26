/**
 * @file 任务管理器
 * @description 维护文档和 Chunks 的两级映射关系
 */

import type {
  DocumentTask,
  ChunkTask,
  DocumentTaskStatus,
  ChunkTaskStatus
} from '../types'

// ============================================================================
// 创建任务参数
// ============================================================================

export interface CreateDocumentTaskParams {
  documentId: string
  taskId: string
  totalChunks: number
  embeddingConfig: {
    modelId: string
    dimensions?: number
  }
  meta?: {
    fileName?: string
    knowledgeBaseId?: string
  }
}

export interface ChunkInput {
  index: number
  text: string
}

// ============================================================================
// TaskManager
// ============================================================================

export class TaskManager {
  /** 文档任务表 */
  private documentTasks: Map<string, DocumentTask> = new Map()
  /** Chunk 任务表 */
  private chunkTasks: Map<string, ChunkTask> = new Map()
  /** 索引: documentId -> Set<chunkId> */
  private documentChunksIndex: Map<string, Set<string>> = new Map()

  // ==========================================================================
  // 文档任务操作
  // ==========================================================================

  /**
   * 创建文档任务
   */
  createDocumentTask(params: CreateDocumentTaskParams): DocumentTask {
    const { documentId, taskId, totalChunks, embeddingConfig, meta } = params
    const now = Date.now()

    const task: DocumentTask = {
      documentId,
      taskId,
      totalChunks,
      completedChunks: 0,
      failedChunks: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      embeddingConfig,
      meta
    }

    this.documentTasks.set(documentId, task)
    this.documentChunksIndex.set(documentId, new Set())

    return task
  }

  /**
   * 获取文档任务
   */
  getDocumentTask(documentId: string): DocumentTask | undefined {
    return this.documentTasks.get(documentId)
  }

  /**
   * 更新文档状态
   */
  updateDocumentStatus(documentId: string, status: DocumentTaskStatus): boolean {
    const task = this.documentTasks.get(documentId)
    if (!task) return false

    task.status = status
    task.updatedAt = Date.now()
    return true
  }

  /**
   * 删除文档任务及其所有 chunks
   */
  removeDocumentTask(documentId: string): boolean {
    const chunkIds = this.documentChunksIndex.get(documentId)
    if (chunkIds) {
      for (const chunkId of chunkIds) {
        this.chunkTasks.delete(chunkId)
      }
    }
    this.documentChunksIndex.delete(documentId)
    return this.documentTasks.delete(documentId)
  }

  // ==========================================================================
  // Chunk 任务操作
  // ==========================================================================

  /**
   * 添加 chunks 到文档
   */
  addChunks(documentId: string, chunks: ChunkInput[]): ChunkTask[] {
    const now = Date.now()
    const results: ChunkTask[] = []

    for (const chunk of chunks) {
      const chunkId = `${documentId}:${chunk.index}`

      const chunkTask: ChunkTask = {
        chunkId,
        documentId,
        index: chunk.index,
        text: chunk.text,
        status: 'pending',
        retryCount: 0,
        createdAt: now,
        updatedAt: now
      }

      this.chunkTasks.set(chunkId, chunkTask)

      // 更新索引
      const chunkIds = this.documentChunksIndex.get(documentId)
      if (chunkIds) {
        chunkIds.add(chunkId)
      }

      results.push(chunkTask)
    }

    return results
  }

  /**
   * 获取文档的所有待处理 chunks
   */
  getPendingChunks(documentId: string): ChunkTask[] {
    const chunkIds = this.documentChunksIndex.get(documentId)
    if (!chunkIds) return []

    const chunks: ChunkTask[] = []
    for (const chunkId of chunkIds) {
      const chunk = this.chunkTasks.get(chunkId)
      if (chunk && chunk.status === 'pending') {
        chunks.push(chunk)
      }
    }

    // 按 index 排序
    return chunks.sort((a, b) => a.index - b.index)
  }

  /**
   * 获取 chunk 任务
   */
  getChunkTask(chunkId: string): ChunkTask | undefined {
    return this.chunkTasks.get(chunkId)
  }

  /**
   * 更新 chunk 状态
   */
  updateChunkStatus(chunkId: string, status: ChunkTaskStatus): boolean {
    const chunk = this.chunkTasks.get(chunkId)
    if (!chunk) return false

    chunk.status = status
    chunk.updatedAt = Date.now()
    return true
  }

  /**
   * 标记 chunk 完成
   */
  markChunkCompleted(chunkId: string, embedding: number[]): boolean {
    const chunk = this.chunkTasks.get(chunkId)
    if (!chunk) return false

    chunk.status = 'completed'
    chunk.embedding = embedding
    chunk.updatedAt = Date.now()

    // 更新文档计数
    const docTask = this.documentTasks.get(chunk.documentId)
    if (docTask) {
      docTask.completedChunks++
      docTask.updatedAt = Date.now()

      // 检查是否全部完成
      if (docTask.completedChunks + docTask.failedChunks >= docTask.totalChunks) {
        docTask.status = docTask.failedChunks > 0 ? 'failed' : 'completed'
      } else if (docTask.status === 'pending') {
        docTask.status = 'running'
      }
    }

    return true
  }

  /**
   * 标记 chunk 失败
   */
  markChunkFailed(chunkId: string, error: string): boolean {
    const chunk = this.chunkTasks.get(chunkId)
    if (!chunk) return false

    chunk.status = 'failed'
    chunk.error = error
    chunk.updatedAt = Date.now()

    // 更新文档计数
    const docTask = this.documentTasks.get(chunk.documentId)
    if (docTask) {
      docTask.failedChunks++
      docTask.updatedAt = Date.now()

      // 检查是否全部完成
      if (docTask.completedChunks + docTask.failedChunks >= docTask.totalChunks) {
        docTask.status = 'failed'
      }
    }

    return true
  }

  /**
   * 获取文档所有已完成的 chunk embeddings
   */
  getCompletedEmbeddings(documentId: string): Array<{ index: number; embedding: number[] }> {
    const chunkIds = this.documentChunksIndex.get(documentId)
    if (!chunkIds) return []

    const results: Array<{ index: number; embedding: number[] }> = []
    for (const chunkId of chunkIds) {
      const chunk = this.chunkTasks.get(chunkId)
      if (chunk && chunk.status === 'completed' && chunk.embedding) {
        results.push({
          index: chunk.index,
          embedding: chunk.embedding
        })
      }
    }

    // 按 index 排序
    return results.sort((a, b) => a.index - b.index)
  }

  // ==========================================================================
  // 查询
  // ==========================================================================

  /**
   * 获取所有文档任务
   */
  getAllDocumentTasks(): DocumentTask[] {
    return Array.from(this.documentTasks.values())
  }

  /**
   * 检查文档是否完成
   */
  isDocumentCompleted(documentId: string): boolean {
    const docTask = this.documentTasks.get(documentId)
    if (!docTask) return false
    return docTask.status === 'completed' || docTask.status === 'failed'
  }
}
