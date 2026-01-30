/**
 * @file 嵌入引擎 IPC 消息协议
 * @description 定义 Main ↔ Embedding Engine 进程间的消息类型
 */

import type {
  SubmitEmbeddingTaskParams,
  ChunkEmbeddingResult,
  EmbeddingChannelInfo,
  ChannelConfig
} from './embedding.types'

// ============================================================================
// Main → Embedding Engine 消息
// ============================================================================

export type MainToEngineMessage =
  | {
      type: 'embed:start'
      requestId: string
      data: SubmitEmbeddingTaskParams & { taskId: string }
    }
  | { type: 'embed:pause'; documentId: string }
  | { type: 'embed:resume'; documentId: string }
  | { type: 'embed:cancel'; documentId: string }
  | { type: 'config:update-channels'; channels: ChannelConfig[] }
  | { type: 'config:set-concurrency'; concurrency: number }
  | { type: 'query:task-info'; requestId: string; documentId: string }
  | { type: 'query:channels'; requestId: string }

// ============================================================================
// Embedding Engine → Main 消息
// ============================================================================

export type EngineToMainMessage =
  | { type: 'ready' }
  | {
      type: 'task:started'
      requestId: string
      documentId: string
      taskId: string
    }
  | {
      type: 'task:progress'
      documentId: string
      taskId: string
      progress: number
      completedChunks: number
      totalChunks: number
      currentRPM?: number
    }
  | {
      /** 单个 chunk 完成，流式通知 */
      type: 'chunk:completed'
      documentId: string
      taskId: string
      chunkIndex: number
      embedding: number[]
    }
  | {
      type: 'task:completed'
      documentId: string
      taskId: string
      embeddings: ChunkEmbeddingResult[]
    }
  | {
      type: 'task:failed'
      documentId: string
      taskId: string
      error: string
    }
  | {
      type: 'task:paused'
      documentId: string
      taskId: string
    }
  | {
      type: 'task:resumed'
      documentId: string
      taskId: string
    }
  | {
      type: 'task:cancelled'
      documentId: string
      taskId: string
    }
  | {
      type: 'channel:status-changed'
      channelId: string
      status: 'active' | 'degraded' | 'blacklisted'
      failureCount: number
    }
  | {
      type: 'query:task-info:result'
      requestId: string
      data: {
        taskId: string
        documentId: string
        status: string
        progress: number
        completedChunks: number
        totalChunks: number
        error?: string
        createdAt: number
        updatedAt: number
      } | null
    }
  | {
      type: 'query:channels:result'
      requestId: string
      channels: EmbeddingChannelInfo[]
    }
  | {
      type: 'error'
      requestId?: string
      message: string
    }
