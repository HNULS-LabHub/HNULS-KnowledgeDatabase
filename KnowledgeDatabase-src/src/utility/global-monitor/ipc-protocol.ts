/**
 * @file 全局监控 IPC 消息协议
 * @description 定义 Main ↔ Utility 进程间的消息类型
 */

import type {
  TaskRecord,
  TaskStatus,
  CreateTaskParams
} from '../../preload/types/task-monitor.types'

// ============================================================================
// Main → Utility 消息
// ============================================================================

export type MainToUtilityMessage =
  | { type: 'create'; requestId: string; params: CreateTaskParams }
  | {
      type: 'updateProgress'
      taskId: string
      progress: number
      metaPatch?: Record<string, unknown>
    }
  | { type: 'complete'; taskId: string; metaPatch?: Record<string, unknown> }
  | { type: 'fail'; taskId: string; error: string }
  | { type: 'pause'; taskId: string }
  | { type: 'resume'; taskId: string }
  | { type: 'remove'; requestId: string; taskId: string }
  | { type: 'clear'; requestId: string; filter?: { status?: TaskStatus[] } }
  | { type: 'getAll'; requestId: string }
  | { type: 'batchPause'; requestId: string; taskIds: string[] }
  | { type: 'batchResume'; requestId: string; taskIds: string[] }

// ============================================================================
// Utility → Main 消息
// ============================================================================

export type UtilityToMainMessage =
  | { type: 'tasksChanged'; tasks: TaskRecord[] }
  | { type: 'createResult'; requestId: string; taskId: string }
  | { type: 'getAllResult'; requestId: string; tasks: TaskRecord[] }
  | { type: 'removeResult'; requestId: string; success: boolean }
  | { type: 'clearResult'; requestId: string; count: number }
  | { type: 'batchPauseResult'; requestId: string; success: boolean }
  | { type: 'batchResumeResult'; requestId: string; success: boolean }
  | { type: 'error'; requestId?: string; message: string }
  | { type: 'ready' }
