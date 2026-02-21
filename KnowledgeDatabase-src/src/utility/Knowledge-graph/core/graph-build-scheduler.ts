/**
 * @file 第二阶段调度器：Graph Build
 * @description 从 kg_llm_result_cache 解析 → 最终图谱表 upsert
 *
 * 生命周期：
 *   1. cleanup: progressing build_chunks → failed; 删除 completed build_tasks
 *   2. poll: 优先处理已有 pending build_chunks → 否则衔接检测
 *   3. 衔接：completed kg_task → 创建 build_task + build_chunks
 *   4. 处理 build_chunk: 读缓存 → 解析 → upsert → 标记完成
 */

import type { KGSurrealClient } from '../db/surreal-client'
import type { KGToMainMessage } from '@shared/knowledge-graph-ipc.types'
import { makeRelationId, parseRawResponse } from './response-parser'
import { upsertGraphData } from './graph-upsert'
import { getKgTableNames } from '../service/graph-schema'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) console.log(`[KG-GraphBuild] ${msg}`, data)
  else console.log(`[KG-GraphBuild] ${msg}`)
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-GraphBuild] ${msg}`, error)
}

/** RecordId 对象或字符串 → "table:id" 字符串 */
function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}

// ============================================================================
// GraphBuildScheduler
// ============================================================================

export class GraphBuildScheduler {
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void

  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isProcessing = false
  private cleanupDone = false
  private isActive = false
  private lockTails = new Map<string, Promise<void>>()

  private readonly POLL_INTERVAL = 2000
  private readonly BATCH_SIZE = 5

  constructor(client: KGSurrealClient, sendMessage: (msg: KGToMainMessage) => void) {
    this.client = client
    this.sendMessage = sendMessage
  }

  async start(): Promise<void> {
    if (this.pollTimer) return
    log('GraphBuildScheduler started')
    this.startPolling()
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    log('GraphBuildScheduler stopped')
  }

  kick(): void {
    if (this.isProcessing) return
    void this.poll()
  }

  // ==========================================================================
  // 启动清理
  // ==========================================================================

  private async cleanup(): Promise<void> {
    log('Build cleanup started')

    // 1. progressing build_chunks → failed (interrupted)
    const affectedTasks = this.client.extractRecords(
      await this.client.query(
        `SELECT task_id FROM kg_build_chunk WHERE status = 'progressing' GROUP BY task_id;`
      )
    )
    const affectedTaskIds = affectedTasks.map((r: any) => rid(r.task_id))

    if (affectedTaskIds.length > 0) {
      await this.client.query(
        `UPDATE kg_build_chunk SET status = 'failed', error = 'interrupted: process restarted' WHERE status = 'progressing';`
      )
      log(`Cleanup: marked progressing build_chunks as failed for ${affectedTaskIds.length} tasks`)
    }

    // 2. 对受影响 task 派生更新
    for (const taskId of affectedTaskIds) {
      await this.reconcileBuildTaskStatus(taskId)
    }

    // 3. 删除 completed build_tasks + 对应 build_chunks
    const completedTasks = this.client.extractRecords(
      await this.client.query(`SELECT id FROM kg_build_task WHERE status = 'completed';`)
    )
    for (const t of completedTasks) {
      const taskId = rid(t.id)
      await this.client.query(`DELETE kg_build_chunk WHERE task_id = $tid;`, { tid: taskId })
      await this.client.query(`DELETE ${taskId};`)
    }
    if (completedTasks.length > 0) {
      log(`Cleanup: deleted ${completedTasks.length} completed build tasks`)
    }

    log('Build cleanup completed')
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
      if (!this.client.isConnected()) return

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

      // 1. 优先处理已有 pending build_chunks
      const pendingChunk = this.client.extractRecords(
        await this.client.query(
          `SELECT task_id, created_at FROM kg_build_chunk WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;`
        )
      )

      if (pendingChunk.length > 0) {
        if (!this.isActive) {
          this.isActive = true
          log('Graph build scheduler activated')
        }
        const taskIdStr = rid(pendingChunk[0].task_id)
        await this.processBuildTaskChunks(taskIdStr)
        return
      }

      // 2. 若无 → 检查是否有新 completed kg_task 需要衔接
      const created = await this.checkAndCreateBuildTasks()
      if (created) return

      // 3. 都没有 → idle
      if (this.isActive) {
        this.isActive = false
        log('Graph build scheduler idle')
      }
    } catch (error) {
      logError('Poll error', error)
    } finally {
      this.isProcessing = false
    }
  }

  // ==========================================================================
  // 衔接检测：completed kg_task → 创建 build_task
  // ==========================================================================

  private async checkAndCreateBuildTasks(): Promise<boolean> {
    const completedTasks = this.client.extractRecords(
      await this.client.query(
        `SELECT * FROM kg_task
         WHERE status = 'completed'
           AND target_namespace IS NOT NONE
         ORDER BY created_at ASC;`
      )
    )

    if (completedTasks.length === 0) return false

    let createdAny = false

    for (const task of completedTasks) {
      const taskIdStr = rid(task.id)

      // 检查是否已有对应 build_task
      const existing = this.client.extractRecords(
        await this.client.query(
          `SELECT id FROM kg_build_task WHERE source_task_id = $tid LIMIT 1;`,
          { tid: taskIdStr }
        )
      )
      if (existing.length > 0) continue

      // 未创建 → 创建 build_task + build_chunks
      await this.createBuildTask(task, taskIdStr)
      createdAny = true
    }

    return createdAny
  }

  private async createBuildTask(task: any, taskIdStr: string): Promise<void> {
    const targetNamespace = task.target_namespace
    const targetDatabase = task.target_database
    const targetTableBase = task.target_table_base

    if (!targetNamespace || !targetDatabase || !targetTableBase) {
      log(`Skipping build task for ${taskIdStr}: missing target info`)
      return
    }

    // 获取该 task 对应的 completed chunks（含 cache_key）
    const chunks = this.client.extractRecords(
      await this.client.query(
        `SELECT id, chunk_index, cache_key FROM kg_chunk
         WHERE task_id = $tid AND status = 'completed' AND cache_key IS NOT NONE
         ORDER BY chunk_index ASC;`,
        { tid: taskIdStr }
      )
    )

    if (chunks.length === 0) {
      log(`No completed chunks with cache_key for task ${taskIdStr}, skipping`)
      return
    }

    // 创建 kg_build_task
    const buildTaskSql = `
      CREATE kg_build_task CONTENT {
        source_task_id: $sourceTaskId,
        file_key: $fileKey,
        status: 'pending',
        target_namespace: $targetNamespace,
        target_database: $targetDatabase,
        target_table_base: $targetTableBase,
        config: $config,
        chunks_total: $chunksTotal,
        chunks_completed: 0,
        chunks_failed: 0,
        entities_upserted: 0,
        relations_upserted: 0
      };
    `
    const buildTaskResult = this.client.extractRecords(
      await this.client.query(buildTaskSql, {
        sourceTaskId: taskIdStr,
        fileKey: task.file_key ?? '',
        targetNamespace,
        targetDatabase,
        targetTableBase,
        config: task.config ?? {},
        chunksTotal: chunks.length
      })
    )

    if (buildTaskResult.length === 0) {
      logError(`Failed to create build task for ${taskIdStr}`)
      return
    }

    const buildTaskId = rid(buildTaskResult[0].id)

    // 批量创建 kg_build_chunk
    const BATCH = 50
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH)
      const stmts = batch
        .map(
          (c: any, batchIdx: number) => `
          CREATE kg_build_chunk CONTENT {
            task_id: '${buildTaskId}',
            chunk_index: ${c.chunk_index ?? i + batchIdx},
            cache_key: $ck_${i + batchIdx},
            status: 'pending'
          };`
        )
        .join('\n')

      const batchParams: Record<string, any> = {}
      batch.forEach((c: any, batchIdx: number) => {
        batchParams[`ck_${i + batchIdx}`] = c.cache_key ?? ''
      })

      await this.client.query(stmts, batchParams)
    }

    log(`Build task created for ${taskIdStr} (${chunks.length} chunks) → ${buildTaskId}`)
  }

  // ==========================================================================
  // 处理 build_task 的 chunks
  // ==========================================================================

  private async processBuildTaskChunks(buildTaskIdStr: string): Promise<void> {
    // 获取 build_task 配置
    const taskRecords = this.client.extractRecords(
      await this.client.query(`SELECT * FROM ${buildTaskIdStr};`)
    )
    const buildTask = taskRecords[0]
    if (!buildTask) {
      logError(`Build task ${buildTaskIdStr} not found`)
      return
    }

    // 获取 pending build_chunks
    const pendingChunks = this.client.extractRecords(
      await this.client.query(
        `SELECT * FROM kg_build_chunk WHERE task_id = $tid AND status = 'pending' ORDER BY chunk_index ASC LIMIT $lim;`,
        { tid: buildTaskIdStr, lim: this.BATCH_SIZE }
      )
    )

    if (pendingChunks.length === 0) {
      await this.reconcileBuildTaskStatus(buildTaskIdStr)
      return
    }

    const startTime = Date.now()
    let totalEntities = 0
    let totalRelations = 0

    // 并行处理一批
    const results = await Promise.allSettled(
      pendingChunks.map((c: any) => this.processBuildChunk(c, buildTask))
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        totalEntities += r.value.entitiesUpserted
        totalRelations += r.value.relationsUpserted
      }
    }

    const durationMs = Date.now() - startTime
    log(
      `Batch: ${pendingChunks.length} chunks → +${totalEntities} entities, +${totalRelations} relations [${(durationMs / 1000).toFixed(1)}s]`
    )

    // 派生更新
    await this.reconcileBuildTaskStatus(buildTaskIdStr)
  }

  private async processBuildChunk(
    chunk: any,
    buildTask: any
  ): Promise<{ entitiesUpserted: number; relationsUpserted: number }> {
    const chunkIdStr = rid(chunk.id)

    // 1. 标记 progressing
    await this.client.query(`UPDATE ${chunkIdStr} SET status = 'progressing';`)

    try {
      const cacheKey = chunk.cache_key
      if (!cacheKey) {
        throw new Error('Missing cache_key')
      }

      // 2. 从 kg_llm_result_cache 读取 raw_response
      const cacheRows = this.client.extractRecords(
        await this.client.query(
          'SELECT `return` AS cached_return FROM kg_llm_result_cache WHERE cache_key = $cacheKey LIMIT 1;',
          { cacheKey }
        )
      )
      const rawResponse = cacheRows[0]?.cached_return ?? cacheRows[0]?.return
      if (!rawResponse) {
        throw new Error(`Cache miss for key: ${cacheKey}`)
      }

      // 3. 解析
      const parsed = parseRawResponse(String(rawResponse))
      const conflictKeys = this.getConflictKeys(parsed)

      if (parsed.entities.length === 0 && parsed.relations.length === 0) {
        console.warn(`[KG-GraphBuild] Chunk ${chunkIdStr}: parsed 0 entities and 0 relations`)
      }

      // 4. upsert 到目标库（含事务冲突重试）
      const tableNames = getKgTableNames(buildTask.target_table_base)
      let result: { entitiesUpserted: number; relationsUpserted: number } | undefined
      await this.withLocks(conflictKeys, async () => {
        const MAX_RETRIES = 3
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            result = await upsertGraphData(
              this.client,
              buildTask.target_namespace,
              buildTask.target_database,
              tableNames,
              parsed.entities,
              parsed.relations,
              cacheKey,
              buildTask.file_key ?? ''
            )
            break
          } catch (retryErr: any) {
            const msg = retryErr?.message ?? String(retryErr)
            if (this.isRetryableWriteConflict(msg) && attempt < MAX_RETRIES) {
              const delay = 200 * Math.pow(2, attempt)
              log(
                `Chunk ${chunkIdStr}: write conflict, retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`
              )
              await new Promise((r) => setTimeout(r, delay))
              continue
            }
            throw retryErr
          }
        }
      })
      if (!result) throw new Error('Unexpected: upsert did not return result')

      // 5. 标记完成
      await this.client.query(
        `UPDATE ${chunkIdStr} SET status = 'completed', entities_count = $ec, relations_count = $rc, error = NONE;`,
        { ec: result.entitiesUpserted, rc: result.relationsUpserted }
      )

      return result
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logError(`Build chunk ${chunkIdStr} failed`, error)
      await this.client.query(`UPDATE ${chunkIdStr} SET status = 'failed', error = $err;`, {
        err: errMsg
      })
      return { entitiesUpserted: 0, relationsUpserted: 0 }
    }
  }

  // ==========================================================================
  // 状态派生
  // ==========================================================================

  private getConflictKeys(parsed: {
    entities: Array<{ sanitizedName: string }>
    relations: Array<{ srcSanitized: string; tgtSanitized: string }>
  }): string[] {
    const keys = new Set<string>()

    for (const entity of parsed.entities) {
      keys.add(`entity:${entity.sanitizedName}`)
    }

    for (const relation of parsed.relations) {
      keys.add(`relation:${makeRelationId(relation.srcSanitized, relation.tgtSanitized)}`)
    }

    return [...keys].sort()
  }

  private async withLocks<T>(keys: string[], fn: () => Promise<T>): Promise<T> {
    if (keys.length === 0) return fn()

    const releases: Array<() => void> = []
    for (const key of keys) {
      releases.push(await this.acquireLock(key))
    }

    try {
      return await fn()
    } finally {
      for (let i = releases.length - 1; i >= 0; i--) {
        releases[i]()
      }
    }
  }

  private async acquireLock(key: string): Promise<() => void> {
    const prevTail = this.lockTails.get(key) ?? Promise.resolve()
    let releaseCurrent!: () => void
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve
    })
    const newTail = prevTail.then(() => current)
    this.lockTails.set(key, newTail)
    await prevTail

    return () => {
      releaseCurrent()
      if (this.lockTails.get(key) === newTail) {
        this.lockTails.delete(key)
      }
    }
  }

  private isRetryableWriteConflict(message: string): boolean {
    return message.includes('can be retried') || message.includes('read or write conflict')
  }

  private deriveStatus(stats: {
    total: number
    completed: number
    failed: number
    pending: number
    progressing: number
  }): 'pending' | 'progressing' | 'completed' | 'failed' {
    if (stats.completed === stats.total && stats.total > 0) return 'completed'
    if (stats.failed > 0 && stats.pending === 0 && stats.progressing === 0) return 'failed'
    if (stats.progressing > 0 || stats.completed > 0) return 'progressing'
    return 'pending'
  }

  private async reconcileBuildTaskStatus(buildTaskIdStr: string): Promise<void> {
    const taskInfo = this.client.extractRecords(
      await this.client.query(
        `SELECT chunks_total, file_key, target_namespace, target_database, target_table_base, config FROM ${buildTaskIdStr};`
      )
    )
    const taskRow = taskInfo[0] ?? {}
    const chunksTotal = Number(taskRow.chunks_total ?? 0)

    const statsResult = this.client.extractRecords(
      await this.client.query(
        `SELECT
           count(status = 'completed') AS completed,
           count(status = 'failed') AS failed,
           count(status = 'pending') AS pending,
           count(status = 'progressing') AS progressing,
           count() AS total,
           math::sum(entities_count) AS entities_sum,
           math::sum(relations_count) AS relations_sum
         FROM kg_build_chunk WHERE task_id = $tid GROUP ALL;`,
        { tid: buildTaskIdStr }
      )
    )
    const stats = statsResult[0] ?? {
      completed: 0,
      failed: 0,
      pending: 0,
      progressing: 0,
      total: 0,
      entities_sum: 0,
      relations_sum: 0
    }

    const completed = Number(stats.completed ?? 0)
    const failed = Number(stats.failed ?? 0)
    const pending = Number(stats.pending ?? 0)
    const progressing = Number(stats.progressing ?? 0)
    const total = chunksTotal || Number(stats.total ?? 0)
    const entitiesSum = Number(stats.entities_sum ?? 0)
    const relationsSum = Number(stats.relations_sum ?? 0)

    const status = this.deriveStatus({ total, completed, failed, pending, progressing })

    await this.client.query(
      `UPDATE ${buildTaskIdStr} SET
        status = $status,
        chunks_completed = $completed,
        chunks_failed = $failed,
        entities_upserted = $entitiesSum,
        relations_upserted = $relationsSum,
        updated_at = time::now();`,
      { status, completed, failed, entitiesSum, relationsSum }
    )

    // 发送进度
    this.sendMessage({
      type: 'kg:build-progress',
      taskId: buildTaskIdStr,
      completed,
      failed,
      total,
      entitiesTotal: entitiesSum,
      relationsTotal: relationsSum
    })

    if (status === 'completed') {
      this.sendMessage({
        type: 'kg:build-completed',
        taskId: buildTaskIdStr,
        targetNamespace: taskRow.target_namespace ?? undefined,
        targetDatabase: taskRow.target_database ?? undefined,
        graphTableBase: taskRow.target_table_base ?? undefined,
        embeddingConfigId: taskRow.config?.embeddingConfigId ?? undefined
      })
      log(
        `Build task ${buildTaskIdStr} completed: ${entitiesSum} entities, ${relationsSum} relations`
      )
    }

    if (status === 'failed') {
      this.sendMessage({
        type: 'kg:build-failed',
        taskId: buildTaskIdStr,
        error: `${failed}/${total} build chunks failed`
      })
      log(`Build task ${buildTaskIdStr} failed: ${failed}/${total} chunks failed`)
    }
  }
}
