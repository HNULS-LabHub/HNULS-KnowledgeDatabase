/**
 * @file 任务调度器（chunk 驱动）
 * @description
 *   - chunk: pending → progressing → completed | failed
 *   - task: 派生状态，仅存储配置
 *
 * 启动清理：
 *   1. 删除 completed chunks（日志数量）
 *   2. progressing → failed（日志影响任务数）
 *   3. 对受影响 task 派生更新
 *
 * 核心循环：
 *   - 静息（idle）：2s 轮询，无重复日志
 *   - 激活（active）：持续处理 pending chunks
 *   - 切换必须日志
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
    return {
      success: true,
      result: { entities: [{ name: 'stub_entity', type: 'concept' }], relations: [] }
    }
  }
  return { success: false, error: 'LLM stub: random failure for testing' }
}

// ============================================================================
// TaskScheduler
// ============================================================================

export class TaskScheduler {
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void
  private requestConcurrency: () => Promise<number>

  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isProcessing = false
  private cleanupDone = false
  private isActive = false // 激活/静息状态

  private readonly POLL_INTERVAL = 2000

  constructor(
    client: KGSurrealClient,
    sendMessage: (msg: KGToMainMessage) => void,
    requestConcurrency: () => Promise<number>
  ) {
    this.client = client
    this.sendMessage = sendMessage
    this.requestConcurrency = requestConcurrency
  }

  async start(): Promise<void> {
    if (this.pollTimer) return
    log('Scheduler started')
    this.startPolling()
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    log('Scheduler stopped')
  }

  kick(): void {
    if (this.isProcessing) return
    void this.poll()
  }

  // ==========================================================================
  // 启动清理
  // ==========================================================================

  private async cleanup(): Promise<void> {
    log('Startup cleanup started')

    // 1. 统计 progressing 影响的 task 数
    const affectedTasks = this.client.extractRecords(
      await this.client.query(
        `SELECT task_id FROM kg_chunk WHERE status = 'progressing' GROUP BY task_id;`
      )
    )
    const affectedTaskIds = affectedTasks.map((r: any) => rid(r.task_id))
    log(`Cleanup: ${affectedTaskIds.length} tasks have progressing chunks to mark failed`)

    // 2. progressing → failed
    if (affectedTaskIds.length > 0) {
      await this.client.query(
        `UPDATE kg_chunk SET status = 'failed', error = 'interrupted: process restarted' WHERE status = 'progressing';`
      )
    }

    // 3. 对受影响 task 派生更新
    for (const taskId of affectedTaskIds) {
      await this.reconcileTaskStatus(taskId)
    }

    // 4. 清理已完成任务（completed == 原始总分块）
    const taskRows = this.client.extractRecords(
      await this.client.query(
        `SELECT id, chunks_completed, chunks_failed, chunks_total_origin, chunks_total FROM kg_task;`
      )
    )
    const completedTaskIds = taskRows
      .map((row: any) => {
        const originTotalRaw = row.chunks_total_origin
        const originTotal = Number(
          originTotalRaw === undefined || originTotalRaw === null
            ? (row.chunks_total ?? 0)
            : originTotalRaw
        )
        const completed = Number(row.chunks_completed ?? 0)
        const failed = Number(row.chunks_failed ?? 0)
        if (completed === originTotal && failed === 0) {
          return rid(row.id)
        }
        return null
      })
      .filter((id: string | null) => Boolean(id)) as string[]

    for (const taskId of completedTaskIds) {
      await this.client.query(`DELETE kg_chunk WHERE task_id = $tid;`, { tid: taskId })
      await this.client.query(`DELETE ${taskId};`)
    }
    log(
      `Cleanup: deleted ${completedTaskIds.length} completed tasks by chunks_completed == chunks_total_origin`
    )

    log('Startup cleanup completed')
  }

  // ==========================================================================
  // 轮询
  // ==========================================================================

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(() => this.poll(), this.POLL_INTERVAL)
  }

  private async poll(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      if (!this.client.isConnected()) {
        this.isProcessing = false
        return
      }

      // 启动清理（仅一次）
      if (!this.cleanupDone) {
        try {
          await this.cleanup()
          this.cleanupDone = true
        } catch (e) {
          logError('Cleanup failed, continuing anyway', e)
          this.cleanupDone = true
        }
      }

      // 核心循环：持续处理 pending chunks
      while (true) {
        // 每次循环请求并发数
        const concurrency = await this.requestConcurrency()

        // 查找最早 pending chunk 对应 task
        const taskResult = this.client.extractRecords(
          await this.client.query(
            `SELECT task_id, created_at FROM kg_chunk WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;`
          )
        )

        if (taskResult.length === 0) {
          // 无 pending → 切静息
          if (this.isActive) {
            this.isActive = false
            log('Core scheduler idle')
          }
          break
        }

        // 有 pending → 切激活
        if (!this.isActive) {
          this.isActive = true
          log('Core scheduler activated')
        }

        const taskIdStr = rid(taskResult[0].task_id)

        // 获取 task 配置
        const taskRecords = this.client.extractRecords(
          await this.client.query(`SELECT * FROM ${taskIdStr};`)
        )
        const task = taskRecords[0]

        if (!task) {
          // task 配置缺失，将该 task 的 pending chunks 全部置 failed
          await this.client.query(
            `UPDATE kg_chunk SET status = 'failed', error = 'missing task config' WHERE task_id = $tid AND status = 'pending';`,
            { tid: taskIdStr }
          )
          logError(`Task ${taskIdStr} config missing, marked pending chunks as failed`)
          continue
        }

        // 处理该 task 的 pending chunks
        await this.processTaskChunks(taskIdStr, task.config ?? {}, concurrency)
      }
    } catch (error) {
      logError('Poll error', error)
    } finally {
      this.isProcessing = false
    }
  }

  // ==========================================================================
  // 任务 chunk 处理
  // ==========================================================================

  private async processTaskChunks(
    taskIdStr: string,
    config: Record<string, any>,
    concurrency: number
  ): Promise<void> {
    // 循环处理该 task 直到无 pending
    while (true) {
      const pendingChunks = this.client.extractRecords(
        await this.client.query(
          `SELECT * FROM kg_chunk WHERE task_id = $tid AND status = 'pending' ORDER BY chunk_index ASC LIMIT $lim;`,
          { tid: taskIdStr, lim: concurrency }
        )
      )

      if (pendingChunks.length === 0) {
        // 该 task 无 pending，派生更新后退出
        await this.reconcileTaskStatus(taskIdStr)
        break
      }

      log(`Processing ${taskIdStr}: ${pendingChunks.length} chunks (concurrency=${concurrency})`)

      await Promise.allSettled(pendingChunks.map((c: any) => this.processChunk(c, config)))

      // 每批处理后派生更新
      await this.reconcileTaskStatus(taskIdStr)
    }
  }

  private async processChunk(chunk: any, config: Record<string, any>): Promise<void> {
    const chunkIdStr = rid(chunk.id)

    await this.client.query(`UPDATE ${chunkIdStr} SET status = 'progressing';`)

    try {
      const llmResult = await callLLMStub(chunk.content, config)

      if (llmResult.success) {
        await this.client.query(
          `UPDATE ${chunkIdStr} SET status = 'completed', result = $result, error = NONE;`,
          { result: llmResult.result ?? {} }
        )
      } else {
        await this.client.query(`UPDATE ${chunkIdStr} SET status = 'failed', error = $err;`, {
          err: llmResult.error ?? 'Unknown LLM error'
        })
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError(`Chunk ${chunkIdStr} processing error`, error)
      await this.client.query(`UPDATE ${chunkIdStr} SET status = 'failed', error = $err;`, {
        err: errMsg
      })
    }
  }

  // ==========================================================================
  // 状态派生
  // ==========================================================================

  private deriveStatus(stats: {
    originTotal: number
    completed: number
    failed: number
    pending: number
    progressing: number
    paused: number
  }): 'pending' | 'progressing' | 'paused' | 'completed' | 'failed' {
    // 完成优先
    if (stats.completed === stats.originTotal) return 'completed'
    // 只要存在 paused（无论是否已有 failed），将任务视为可继续的暂停态
    if (stats.paused > 0) return 'paused'
    // 失败在没有暂停时才决定任务失败
    if (stats.failed > 0) return 'failed'
    if (stats.progressing > 0 || stats.completed > 0) return 'progressing'
    return 'pending'
  }

  private async reconcileTaskStatus(taskIdStr: string): Promise<void> {
    const taskInfo = this.client.extractRecords(
      await this.client.query(
        `SELECT chunks_total_origin, chunks_total, chunks_completed, chunks_failed FROM ${taskIdStr};`
      )
    )
    const taskRow = taskInfo[0] ?? {}
    const statsResult = this.client.extractRecords(
      await this.client.query(
        `SELECT
           count(status = 'completed') AS completed,
           count(status = 'failed') AS failed,
           count(status = 'pending') AS pending,
           count(status = 'progressing') AS progressing,
           count(status = 'paused') AS paused,
           count() AS total
         FROM kg_chunk WHERE task_id = $tid GROUP ALL;`,
        { tid: taskIdStr }
      )
    )
    const stats = statsResult[0] ?? {
      completed: 0,
      failed: 0,
      pending: 0,
      progressing: 0,
      total: 0
    }

    const completed = Number(stats.completed ?? 0)
    const failed = Number(stats.failed ?? 0)
    const pending = Number(stats.pending ?? 0)
    const progressing = Number(stats.progressing ?? 0)
    const total = Number(stats.total ?? 0)
    const paused = Number(stats.paused ?? 0)

    const originTotalRaw = taskRow.chunks_total_origin
    const originTotal = Number(
      originTotalRaw === undefined || originTotalRaw === null
        ? (taskRow.chunks_total ?? total)
        : originTotalRaw
    )

    const useSnapshot = total === 0 && originTotal > 0
    const effectiveCompleted = useSnapshot
      ? Number(taskRow.chunks_completed ?? completed)
      : completed
    const effectiveFailed = useSnapshot ? Number(taskRow.chunks_failed ?? failed) : failed

    const status = this.deriveStatus({
      originTotal,
      completed: effectiveCompleted,
      failed: effectiveFailed,
      pending,
      progressing,
      paused
    })

    // 更新 task 状态
    await this.client.query(
      `UPDATE ${taskIdStr} SET status = $status, chunks_completed = $completed, chunks_failed = $failed, chunks_total = $originTotal, chunks_total_origin = $originTotal, updated_at = time::now();`,
      { status, completed: effectiveCompleted, failed: effectiveFailed, originTotal }
    )

    // 发送进度消息
    this.sendMessage({
      type: 'kg:task-progress',
      taskId: taskIdStr,
      completed: effectiveCompleted,
      failed: effectiveFailed,
      total: originTotal
    })

    // 任务完成：发送完成消息（清理由启动清扫/手动触发负责）
    if (status === 'completed') {
      this.sendMessage({ type: 'kg:task-completed', taskId: taskIdStr })
      log(`Task ${taskIdStr} completed: ${effectiveCompleted}/${originTotal} chunks`)
    }

    // 任务失败：发送失败消息
    if (status === 'failed') {
      this.sendMessage({
        type: 'kg:task-failed',
        taskId: taskIdStr,
        error: `${effectiveFailed}/${originTotal} chunks failed`
      })
      log(`Task ${taskIdStr} failed: ${effectiveFailed}/${originTotal} chunks failed`)
    }
  }
}
