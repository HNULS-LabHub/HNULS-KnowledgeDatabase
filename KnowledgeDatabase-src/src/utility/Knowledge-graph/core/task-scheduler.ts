/**
 * @file 任务调度器
 * @description 轮询未完成的任务/分块，按配置并行调 LLM（当前留桩）
 *
 * 状态流转：
 * - chunk: pending → progressing → completed/failed
 * - task:  pending → progressing → completed/failed
 *
 * 启动时清理：
 * - completed 的任务及其 chunks 删除
 * - progressing 的 chunk 转 failed（上次异常中断的）
 */

import type { KGSurrealClient } from '../db/surreal-client'
import type { KGToMainMessage } from '@shared/knowledge-graph-ipc.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) console.log(`[KG-Scheduler] ${msg}`, data)
  else console.log(`[KG-Scheduler] ${msg}`)
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-Scheduler] ${msg}`, error)
}

// ============================================================================
// 辅助
// ============================================================================

/** RecordId 对象或字符串 → "table:id" 字符串 */
function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}

// ============================================================================
// LLM 桩函数
// ============================================================================

async function callLLMStub(
  _content: string,
  _config: Record<string, any>
): Promise<{ success: boolean; result?: any; error?: string }> {
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 600))
  if (Math.random() < 0.8) {
    return { success: true, result: { entities: [{ name: 'stub_entity', type: 'concept' }], relations: [] } }
  }
  return { success: false, error: 'LLM stub: random failure for testing' }
}

// ============================================================================
// TaskScheduler
// ============================================================================

export class TaskScheduler {
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void
  private maxConcurrency = 5
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isProcessing = false

  private readonly POLL_INTERVAL_ACTIVE = 2000
  private readonly POLL_INTERVAL_IDLE = 5000

  constructor(client: KGSurrealClient, sendMessage: (msg: KGToMainMessage) => void) {
    this.client = client
    this.sendMessage = sendMessage
  }

  async start(): Promise<void> {
    log('Starting scheduler...')
    try { await this.cleanup() } catch (e) { logError('Cleanup failed, continuing anyway', e) }
    this.startPolling(this.POLL_INTERVAL_IDLE)
    log('Scheduler started')
  }

  stop(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    log('Scheduler stopped')
  }

  setMaxConcurrency(value: number): void {
    this.maxConcurrency = Math.max(1, value)
    log(`Max concurrency updated to ${this.maxConcurrency}`)
  }

  // ==========================================================================
  // 启动清理
  // ==========================================================================

  private async cleanup(): Promise<void> {
    log('Running startup cleanup...')

    // 1. 删除已完成任务的 chunks，再删任务本身
    const completedTasks = this.client.extractRecords(
      await this.client.query(`SELECT * FROM kg_task WHERE status = 'completed';`)
    )
    for (const task of completedTasks) {
      const taskIdStr = rid(task.id)
      await this.client.query(`DELETE kg_chunk WHERE task_id = $tid;`, { tid: taskIdStr })
      await this.client.query(`DELETE ${taskIdStr};`)
    }
    if (completedTasks.length > 0) log(`Cleaned up ${completedTasks.length} completed tasks`)

    // 2. progressing chunk → failed
    await this.client.query(
      `UPDATE kg_chunk SET status = 'failed', error = 'interrupted: process restarted' WHERE status = 'progressing';`
    )
    // 3. progressing task → failed
    await this.client.query(`UPDATE kg_task SET status = 'failed' WHERE status = 'progressing';`)

    log('Cleanup completed')
  }

  // ==========================================================================
  // 轮询
  // ==========================================================================

  private startPolling(interval: number): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(() => this.poll(), interval)
  }

  private async poll(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const tasks = this.client.extractRecords(
        await this.client.query(
          `SELECT * FROM kg_task WHERE status IN ['pending', 'failed'] ORDER BY created_at ASC LIMIT 10;`
        )
      )

      if (tasks.length === 0) {
        this.startPolling(this.POLL_INTERVAL_IDLE)
        this.isProcessing = false
        return
      }

      this.startPolling(this.POLL_INTERVAL_ACTIVE)
      for (const task of tasks) await this.processTask(task)
    } catch (error) {
      logError('Poll error', error)
    } finally {
      this.isProcessing = false
    }
  }

  // ==========================================================================
  // 任务处理
  // ==========================================================================

  private async processTask(task: any): Promise<void> {
    const taskIdStr = rid(task.id) // "kg_task:xxx"

    if (task.status === 'pending' || task.status === 'failed') {
      await this.client.query(`UPDATE ${taskIdStr} SET status = 'progressing';`)
    }

    const pendingChunks = this.client.extractRecords(
      await this.client.query(
        `SELECT * FROM kg_chunk WHERE task_id = $tid AND status IN ['pending', 'failed'] ORDER BY chunk_index ASC LIMIT $lim;`,
        { tid: taskIdStr, lim: this.maxConcurrency }
      )
    )

    if (pendingChunks.length === 0) {
      await this.finalizeTask(taskIdStr)
      return
    }

    log(`Processing task ${taskIdStr}: ${pendingChunks.length} chunks (concurrency=${this.maxConcurrency})`)

    await Promise.allSettled(pendingChunks.map((c: any) => this.processChunk(c, task.config)))
    await this.updateTaskProgress(taskIdStr)
  }

  private async processChunk(chunk: any, config: Record<string, any>): Promise<void> {
    const chunkIdStr = rid(chunk.id) // "kg_chunk:xxx"

    await this.client.query(`UPDATE ${chunkIdStr} SET status = 'progressing';`)

    try {
      const llmResult = await callLLMStub(chunk.content, config)

      if (llmResult.success) {
        await this.client.query(
          `UPDATE ${chunkIdStr} SET status = 'completed', result = $result, error = NONE;`,
          { result: llmResult.result ?? {} }
        )
      } else {
        await this.client.query(
          `UPDATE ${chunkIdStr} SET status = 'failed', error = $err;`,
          { err: llmResult.error ?? 'Unknown LLM error' }
        )
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError(`Chunk ${chunkIdStr} processing error`, error)
      await this.client.query(
        `UPDATE ${chunkIdStr} SET status = 'failed', error = $err;`,
        { err: errMsg }
      )
    }
  }

  // ==========================================================================
  // 进度汇总
  // ==========================================================================

  private async updateTaskProgress(taskIdStr: string): Promise<void> {
    const statsResult = this.client.extractRecords(
      await this.client.query(
        `SELECT count(status = 'completed') AS completed, count(status = 'failed') AS failed, count() AS total
         FROM kg_chunk WHERE task_id = $tid GROUP ALL;`,
        { tid: taskIdStr }
      )
    )
    const stats = statsResult[0] ?? { completed: 0, failed: 0, total: 0 }

    await this.client.query(
      `UPDATE ${taskIdStr} SET chunks_completed = $completed, chunks_failed = $failed;`,
      { completed: stats.completed, failed: stats.failed }
    )

    this.sendMessage({
      type: 'kg:task-progress',
      taskId: taskIdStr,
      completed: stats.completed,
      failed: stats.failed,
      total: stats.total
    })

    if (stats.total - stats.completed - stats.failed <= 0) {
      await this.finalizeTask(taskIdStr)
    }
  }

  private async finalizeTask(taskIdStr: string): Promise<void> {
    const statsResult = this.client.extractRecords(
      await this.client.query(
        `SELECT count(status = 'completed') AS completed, count(status = 'failed') AS failed, count() AS total
         FROM kg_chunk WHERE task_id = $tid GROUP ALL;`,
        { tid: taskIdStr }
      )
    )
    const stats = statsResult[0] ?? { completed: 0, failed: 0, total: 0 }

    if (stats.failed > 0) {
      await this.client.query(
        `UPDATE ${taskIdStr} SET status = 'failed', chunks_completed = $completed, chunks_failed = $failed;`,
        { completed: stats.completed, failed: stats.failed }
      )
      this.sendMessage({ type: 'kg:task-failed', taskId: taskIdStr, error: `${stats.failed}/${stats.total} chunks failed` })
      log(`Task ${taskIdStr} failed: ${stats.failed}/${stats.total} chunks failed`)
    } else {
      await this.client.query(
        `UPDATE ${taskIdStr} SET status = 'completed', chunks_completed = $completed, chunks_failed = 0;`,
        { completed: stats.completed }
      )
      this.sendMessage({ type: 'kg:task-completed', taskId: taskIdStr })
      log(`Task ${taskIdStr} completed: ${stats.completed}/${stats.total} chunks`)
    }
  }
}
