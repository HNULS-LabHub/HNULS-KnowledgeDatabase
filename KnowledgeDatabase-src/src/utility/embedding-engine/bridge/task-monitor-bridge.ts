/**
 * @file 任务监控桥接
 * @description 嵌入引擎向全局监控发送进度更新
 *
 * 注意：由于嵌入引擎和全局监控是两个独立的 Utility Process，
 * 它们之间不能直接通信，必须通过 Main 进程中转。
 *
 * 消息流：
 * EmbeddingEngine -> Main Process -> GlobalMonitor
 */

import type { EngineToMainMessage } from '../ipc-protocol'

// ============================================================================
// TaskMonitorBridge
// ============================================================================

export class TaskMonitorBridge {
  constructor(private sendMessage: (msg: EngineToMainMessage) => void) {}

  /**
   * 更新任务进度
   *
   * @param taskId 全局监控任务 ID
   * @param progress 进度百分比 (0-100)
   * @param meta 额外元数据
   */
  updateProgress(taskId: string, progress: number, meta?: Record<string, unknown>): void {
    // 通过 IPC 发送进度到 Main 进程
    // Main 进程会转发到 GlobalMonitor
    this.sendMessage({
      type: 'task:progress',
      documentId: (meta?.documentId as string) || '',
      taskId,
      progress,
      completedChunks: (meta?.completedChunks as number) || 0,
      totalChunks: (meta?.totalChunks as number) || 0,
      currentRPM: meta?.currentRPM as number | undefined
    })
  }

  /**
   * 标记任务完成
   *
   * @param taskId 全局监控任务 ID
   */
  complete(taskId: string): void {
    // 完成通知会通过 task:completed 消息单独发送
    // 这里可以添加额外的完成处理逻辑
    console.log(`[TaskMonitorBridge] Task ${taskId} completed`)
  }

  /**
   * 标记任务失败
   *
   * @param taskId 全局监控任务 ID
   * @param error 错误信息
   */
  fail(taskId: string, error: string): void {
    // 失败通知会通过 task:failed 消息单独发送
    console.log(`[TaskMonitorBridge] Task ${taskId} failed: ${error}`)
  }
}
