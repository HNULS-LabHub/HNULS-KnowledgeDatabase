/**
 * @file EmbeddingScheduler - 实体向量嵌入调度器
 * @description 常驻单例，运行在 Knowledge-graph 子进程中。
 *   状态机：idle（5s 轮询）→ active（批量嵌入）→ indexing（HNSW）→ idle
 *   纯内存驱动，不建中间表，中断即丢弃当前批次。
 */

import { createHash } from 'crypto'
import type { KGSurrealClient } from '../db/surreal-client'
import type { KGToMainMessage, KGEmbeddingProgressData } from '@shared/knowledge-graph-ipc.types'
import { getKgTableNames } from '../service/graph-schema'

// ============================================================================
// 类型定义
// ============================================================================

export interface EmbeddingConfig {
  baseUrl: string
  apiKey: string
  model: string
  dimensions: number
  batchSize: number
  maxTokens: number
}

export interface TargetInfo {
  namespace: string
  database: string
  graphTableBase: string
}

export type SchedulerState = 'idle' | 'active' | 'error'

export interface BatchResult {
  successCount: number
  failCount: number
  durationMs: number
  remaining: number
}

export interface EmbeddingStatus {
  state: SchedulerState
  completed: number
  pending: number
  total: number
  hnswIndexReady: boolean
  lastError: string | null
  lastBatchInfo: BatchResult | null
}

/** 扫描到的实体行 */
interface EntityRow {
  id: string
  entity_name: string
  description: string
}

/** OpenAI 兼容的 Embedding API 响应 */
interface EmbeddingAPIResponse {
  data?: Array<{ embedding: number[]; index?: number }>
  error?: { message?: string; type?: string; code?: string | number }
}

// ============================================================================
// 日志工具
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) console.log(`[KG-EmbeddingScheduler] ${msg}`, JSON.stringify(data))
  else console.log(`[KG-EmbeddingScheduler] ${msg}`)
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-EmbeddingScheduler] ${msg}`, error)
}

// ============================================================================
// 纯函数：构造嵌入文本
// ============================================================================

/**
 * 构造嵌入文本：按 `\n---\n` 分段，从头累加到 maxTokens*4 字符
 * 格式：`{name}: {truncated_text}`
 *
 * @param name 实体名称
 * @param description 实体描述（可能包含 \n---\n 分隔符）
 * @param maxTokens 最大 token 数（字符上限 = maxTokens * 4）
 */
export function buildEmbeddingText(name: string, description: string, maxTokens: number): string {
  const charLimit = maxTokens * 4
  const segments = description.split('\n---\n')

  let accumulated = ''
  for (const seg of segments) {
    if (accumulated.length + seg.length > charLimit) break
    accumulated += seg
  }

  return `${name}: ${accumulated}`
}

// ============================================================================
// EmbeddingScheduler 类
// ============================================================================

export class EmbeddingScheduler {
  // 依赖
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void

  // 状态
  private state: SchedulerState = 'idle'
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private isProcessing = false
  private running = false

  // 配置（由 trigger 消息设置）
  private embeddingConfig: EmbeddingConfig | null = null
  private targetInfo: TargetInfo | null = null

  // HNSW 索引缓存
  private hnswCreatedSet: Set<string> = new Set()

  // 统计
  private completedCount = 0
  private pendingCount = 0
  private totalCount = 0

  // 调试信息
  private lastError: string | null = null
  private lastBatchInfo: BatchResult | null = null

  // 常量
  private readonly IDLE_POLL_INTERVAL = 5000
  private readonly ACTIVE_POLL_INTERVAL = 100
  private readonly API_TIMEOUT_MS = 30000

  constructor(client: KGSurrealClient, sendMessage: (msg: KGToMainMessage) => void) {
    this.client = client
    this.sendMessage = sendMessage
  }

  // ==========================================================================
  // 公共方法
  // ==========================================================================

  /** 启动 idle 轮询 */
  start(): void {
    if (this.running) return
    this.running = true
    log('EmbeddingScheduler started')
    this.schedulePoll()
  }

  /** 停止轮询 */
  stop(): void {
    this.running = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    log('EmbeddingScheduler stopped')
  }

  /** 外部触发（收到 kg:trigger-embedding） */
  trigger(config: EmbeddingConfig, target: TargetInfo): void {
    this.embeddingConfig = config
    this.targetInfo = target
    // 清空 HNSW 缓存（可能换了目标库）
    this.hnswCreatedSet.clear()

    log('Trigger received', { target: target.graphTableBase, model: config.model })

    // 立即切换到 active，无需等待下次轮询
    if (this.state === 'idle' || this.state === 'error') {
      this.setState('active', 'trigger received')
      // 取消当前定时器，立即开始处理
      if (this.pollTimer) {
        clearTimeout(this.pollTimer)
        this.pollTimer = null
      }
      if (!this.isProcessing) {
        void this.poll()
      }
    }
  }

  /** 查询当前状态 */
  getStatus(): EmbeddingStatus {
    return {
      state: this.state,
      completed: this.completedCount,
      pending: this.pendingCount,
      total: this.totalCount,
      hnswIndexReady: this.targetInfo
        ? this.hnswCreatedSet.has(getKgTableNames(this.targetInfo.graphTableBase).entity)
        : false,
      lastError: this.lastError,
      lastBatchInfo: this.lastBatchInfo
    }
  }

  // ==========================================================================
  // 状态机
  // ==========================================================================

  private setState(newState: SchedulerState, reason: string): void {
    const oldState = this.state
    if (oldState === newState) return
    this.state = newState
    log(`State: ${oldState} → ${newState}`, { reason, pending: this.pendingCount })
  }

  // ==========================================================================
  // 轮询调度（setTimeout 避免重叠）
  // ==========================================================================

  private schedulePoll(): void {
    if (!this.running) return
    const interval = this.state === 'active' ? this.ACTIVE_POLL_INTERVAL : this.IDLE_POLL_INTERVAL
    this.pollTimer = setTimeout(() => void this.poll(), interval)
  }

  // ==========================================================================
  // poll() 主循环
  // ==========================================================================

  private async poll(): Promise<void> {
    if (this.isProcessing || !this.running) {
      this.schedulePoll()
      return
    }
    this.isProcessing = true

    try {
      if (!this.client.isConnected() || !this.targetInfo || !this.embeddingConfig) {
        // 无配置或未连接，保持 idle
        return
      }

      if (this.state === 'idle' || this.state === 'error') {
        // idle/error 态：扫描是否有待嵌入实体
        const pending = await this.scanPendingEntities()
        if (pending.length > 0) {
          this.setState('active', `found ${pending.length} pending entities`)
          // 立即处理这批
          await this.processBatch(pending)
        }
      } else if (this.state === 'active') {
        // active 态：快速循环处理批次
        const pending = await this.scanPendingEntities()
        if (pending.length > 0) {
          await this.processBatch(pending)
        } else {
          // 所有实体处理完毕 → indexing 阶段
          await this.doIndexing()
        }
      }

      // 每次循环发送进度消息
      this.sendProgressMessage()
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      this.lastError = errMsg
      logError('Poll error', error)
      if (this.state === 'active') {
        this.setState('error', errMsg)
      }
    } finally {
      this.isProcessing = false
      this.schedulePoll()
    }
  }

  // ==========================================================================
  // indexing 阶段
  // ==========================================================================

  private async doIndexing(): Promise<void> {
    log('All entities embedded, creating HNSW index...')
    await this.ensureHnswIndex()
    this.setState('idle', 'indexing complete, all entities embedded')
  }

  // ==========================================================================
  // scanPendingEntities
  // ==========================================================================

  private async scanPendingEntities(): Promise<EntityRow[]> {
    if (!this.targetInfo || !this.embeddingConfig) return []

    const { namespace, database, graphTableBase } = this.targetInfo
    const { batchSize } = this.embeddingConfig
    const entityTable = getKgTableNames(graphTableBase).entity

    try {
      // 先查总数和已完成数（用于进度报告）
      const countResult = this.client.extractRecords(
        await this.client.queryInDatabase(
          namespace,
          database,
          `SELECT
             count() AS total,
             math::sum(IF embedding IS NONE THEN 0 ELSE 1 END) AS completed
           FROM ${entityTable} GROUP ALL;`
        )
      )

      if (countResult.length > 0) {
        this.totalCount = Number(countResult[0].total) || 0
        this.completedCount = Number(countResult[0].completed) || 0
        this.pendingCount = this.totalCount - this.completedCount
      }

      // 查询待嵌入实体
      const rows = this.client.extractRecords(
        await this.client.queryInDatabase(
          namespace,
          database,
          `SELECT id, entity_name, description
           FROM ${entityTable}
           WHERE embedding IS NONE
           LIMIT ${batchSize};`
        )
      )

      return rows.map((r: any) => ({
        id: String(r.id),
        entity_name: String(r.entity_name ?? ''),
        description: String(r.description ?? '')
      }))
    } catch (error) {
      logError('scanPendingEntities failed', error)
      return []
    }
  }

  // ==========================================================================
  // processBatch
  // ==========================================================================

  private async processBatch(entities: EntityRow[]): Promise<void> {
    if (!this.embeddingConfig) return

    const startTime = Date.now()
    const { maxTokens } = this.embeddingConfig

    try {
      // 1. 构造嵌入文本
      const texts = entities.map((e) => buildEmbeddingText(e.entity_name, e.description, maxTokens))

      // 2. 调用嵌入 API
      const vectors = await this.callEmbeddingAPI(texts)

      // 3. 原子性检查：向量数组长度必须与实体数量匹配
      if (vectors.length !== entities.length) {
        const errMsg = `Vector count mismatch: expected ${entities.length}, got ${vectors.length}`
        logError(errMsg)
        this.lastError = errMsg
        this.lastBatchInfo = {
          successCount: 0,
          failCount: entities.length,
          durationMs: Date.now() - startTime,
          remaining: this.pendingCount
        }
        return
      }

      // 4. 批量写入数据库
      await this.writeBatchToDb(entities, vectors)

      const durationMs = Date.now() - startTime
      // 更新待处理数
      this.pendingCount = Math.max(0, this.pendingCount - entities.length)
      this.completedCount += entities.length

      this.lastBatchInfo = {
        successCount: entities.length,
        failCount: 0,
        durationMs,
        remaining: this.pendingCount
      }

      log('Batch complete', this.lastBatchInfo)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      this.lastError = errMsg
      logError('processBatch failed', error)

      this.lastBatchInfo = {
        successCount: 0,
        failCount: entities.length,
        durationMs: Date.now() - startTime,
        remaining: this.pendingCount
      }

      // API 连续失败 → error 状态
      this.setState('error', errMsg)
    }
  }

  // ==========================================================================
  // writeBatchToDb
  // ==========================================================================

  private async writeBatchToDb(entities: EntityRow[], vectors: number[][]): Promise<void> {
    if (!this.targetInfo) return

    const { namespace, database } = this.targetInfo

    // 拼接所有 UPDATE 语句，一次性执行
    const statements = entities.map((entity, i) => {
      const hash = createHash('sha256')
        .update(entity.description, 'utf8')
        .digest('hex')
        .slice(0, 16)
      const vecStr = `[${vectors[i].join(',')}]`
      // entity.id 已经是 "table:record_id" 格式
      return `UPDATE ${entity.id} SET embedding = ${vecStr}, embedding_hash = '${hash}', embedding_at = time::now();`
    })

    const sql = statements.join('\n')

    try {
      await this.client.queryInDatabase(namespace, database, sql)
    } catch (error) {
      logError('writeBatchToDb failed', error)
      throw error
    }
  }

  // ==========================================================================
  // callEmbeddingAPI
  // ==========================================================================

  private async callEmbeddingAPI(texts: string[]): Promise<number[][]> {
    if (!this.embeddingConfig) throw new Error('No embedding config')

    const { baseUrl, apiKey, model, dimensions } = this.embeddingConfig
    const url = `${baseUrl.replace(/\/$/, '')}/v1/embeddings`

    const body = {
      model,
      input: texts,
      dimensions
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.API_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      let data: EmbeddingAPIResponse | null = null
      try {
        data = (await response.json()) as EmbeddingAPIResponse
      } catch {
        data = null
      }

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ??
          (data ? JSON.stringify(data) : '') ??
          `HTTP ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      if (!data?.data || data.data.length === 0) {
        throw new Error('Empty embedding response')
      }

      // 按 index 排序（API 可能乱序返回）
      const sorted = [...data.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      return sorted.map((item) => item.embedding)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Embedding API request timeout (30s)')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ==========================================================================
  // ensureHnswIndex
  // ==========================================================================

  private async ensureHnswIndex(): Promise<void> {
    if (!this.targetInfo || !this.embeddingConfig) return

    const { namespace, database, graphTableBase } = this.targetInfo
    const { dimensions } = this.embeddingConfig
    const entityTable = getKgTableNames(graphTableBase).entity

    // 内存缓存：已创建过则跳过
    if (this.hnswCreatedSet.has(entityTable)) return

    const sql = `DEFINE INDEX IF NOT EXISTS idx_${entityTable}_embedding ON ${entityTable} FIELDS embedding HNSW DIMENSION ${dimensions} DIST COSINE CONCURRENTLY;`

    try {
      await this.client.queryInDatabase(namespace, database, sql)
      this.hnswCreatedSet.add(entityTable)
      log('HNSW index created', { entityTable, dimensions })
    } catch (error) {
      // 失败记录日志但不阻塞
      logError('ensureHnswIndex failed', error)
    }
  }

  // ==========================================================================
  // 进度消息
  // ==========================================================================

  private sendProgressMessage(): void {
    const data: KGEmbeddingProgressData = {
      state: this.state,
      completed: this.completedCount,
      pending: this.pendingCount,
      total: this.totalCount,
      hnswIndexReady: this.targetInfo
        ? this.hnswCreatedSet.has(getKgTableNames(this.targetInfo.graphTableBase).entity)
        : false,
      lastError: this.lastError,
      lastBatchInfo: this.lastBatchInfo
    }

    this.sendMessage({ type: 'kg:embedding-progress', data })
  }
}
