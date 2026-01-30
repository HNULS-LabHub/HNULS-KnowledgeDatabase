/**
 * @file 进度追踪器
 * @description 计算进度并回调到全局监控
 */

import type { TaskManager } from './task-manager'
import type { TaskMonitorBridge } from '../bridge/task-monitor-bridge'

// ============================================================================
// RPM 计算器
// ============================================================================

class RPMCalculator {
  private requestTimestamps: number[] = []
  private readonly windowMs = 60 * 1000 // 1 分钟窗口

  /**
   * 记录一次请求
   */
  record(): void {
    const now = Date.now()
    this.requestTimestamps.push(now)
    // 清理过期记录
    this.cleanup()
  }

  /**
   * 获取当前 RPM
   */
  getRPM(): number {
    this.cleanup()
    return this.requestTimestamps.length
  }

  /**
   * 清理过期的时间戳
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs
    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > cutoff)
  }
}

// ============================================================================
// ProgressTracker
// ============================================================================

export class ProgressTracker {
  private rpmCalculator = new RPMCalculator()

  constructor(
    private taskManager: TaskManager,
    private taskMonitorBridge: TaskMonitorBridge
  ) {}

  /**
   * 当一个 chunk 完成时调用
   */
  onChunkCompleted(documentId: string): void {
    // 记录请求用于 RPM 计算
    this.rpmCalculator.record()

    const docTask = this.taskManager.getDocumentTask(documentId)
    if (!docTask) return

    const progress = Number(((docTask.completedChunks / docTask.totalChunks) * 100).toFixed(2))
    const currentRPM = this.rpmCalculator.getRPM()

    // 回调到全局监控
    this.taskMonitorBridge.updateProgress(docTask.taskId, progress, {
      documentId,
      completedChunks: docTask.completedChunks,
      totalChunks: docTask.totalChunks,
      currentRPM
    })
  }

  /**
   * 获取文档进度
   */
  getDocumentProgress(documentId: string): number {
    const docTask = this.taskManager.getDocumentTask(documentId)
    if (!docTask || docTask.totalChunks === 0) return 0
    return Number(((docTask.completedChunks / docTask.totalChunks) * 100).toFixed(2))
  }

  /**
   * 获取当前 RPM
   */
  getCurrentRPM(): number {
    return this.rpmCalculator.getRPM()
  }
}
