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
import type { KGToMainMessage, KGModelProviderConfig } from '@shared/knowledge-graph-ipc.types'
import { createHash } from 'crypto'
import {
  entityExtractionSystem,
  entityExtractionUser,
  entityExtractionContinue,
  entityExtractionExamples
} from '../../../Public/SharedPrompt/knowledge-graph'

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
// Prompt / Cache Utils
// ============================================================================

const DEFAULT_TUPLE_DELIMITER = '<|#|>'
const DEFAULT_COMPLETION_DELIMITER = '<|COMPLETE|>'

type PromptBundle = {
  system: string
  user: string
  continue: string
  examples: string
}

let promptCache: PromptBundle | null = null

async function loadPrompts(): Promise<PromptBundle> {
  if (promptCache) return promptCache
  promptCache = {
    system: entityExtractionSystem,
    user: entityExtractionUser,
    continue: entityExtractionContinue,
    examples: entityExtractionExamples
  }
  return promptCache
}

function sanitizeText(input: string): string {
  return Buffer.from(String(input ?? ''), 'utf8').toString()
}
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d : null
  }
  return null
}

function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex')
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}
const DEFAULT_ENTITY_TYPES = [
  'Person',
  'Creature',
  'Organization',
  'Location',
  'Event',
  'Concept',
  'Method',
  'Content',
  'Data',
  'Artifact',
  'NaturalObject'
]
const DEFAULT_LANGUAGE = 'English'
const DEFAULT_TEMPERATURE = 0
const DEFAULT_TIMEOUT_MS = 60000

type TaskConfig = {
  model?: string
  providerId?: string
  modelId?: string
  entityTypes?: string[]
  outputLanguage?: string
  llmConcurrency?: number
  embeddingConfigId?: string
  embeddingUpdatedAt?: string
  [key: string]: unknown
}

type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIChatResponse {
  id?: string
  object?: string
  created?: number
  model?: string
  choices?: Array<{
    index?: number
    message?: { role?: string; content?: string }
    text?: string
    finish_reason?: string
  }>
  error?: {
    message?: string
    type?: string
    code?: string | number
  }
}

async function callOpenAIChat(params: {
  baseUrl: string
  apiKey: string
  model: string
  messages: OpenAIChatMessage[]
  temperature?: number
  timeoutMs?: number
}): Promise<string> {
  const { baseUrl, apiKey, model, messages } = params
  const temperature = params.temperature ?? DEFAULT_TEMPERATURE
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
  const body = {
    model,
    messages,
    temperature
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

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

    let data: OpenAIChatResponse | null = null
    try {
      data = (await response.json()) as OpenAIChatResponse
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

    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      ''

    if (!content) {
      throw new Error('Empty LLM response')
    }

    return content
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

async function buildPromptInputs(params: {
  content: string
  entityTypes?: string[]
  language?: string
  providerId?: string
  modelId?: string
  embeddingUpdatedAt?: string
}): Promise<{
  systemPrompt: string
  userPrompt: string
  continuePrompt: string
  cacheKey: string
}> {
  const entityTypes =
    Array.isArray(params.entityTypes) && params.entityTypes.length > 0
      ? params.entityTypes
      : DEFAULT_ENTITY_TYPES
  const entityTypesText = entityTypes.map((t) => JSON.stringify(String(t))).join(',')
  const language = params.language || DEFAULT_LANGUAGE

  const prompts = await loadPrompts()
  const examplesText = applyTemplate(prompts.examples, {
    tuple_delimiter: DEFAULT_TUPLE_DELIMITER,
    completion_delimiter: DEFAULT_COMPLETION_DELIMITER
  })

  const systemPrompt = applyTemplate(prompts.system, {
    entity_types: entityTypesText,
    tuple_delimiter: DEFAULT_TUPLE_DELIMITER,
    completion_delimiter: DEFAULT_COMPLETION_DELIMITER,
    language,
    examples: examplesText
  })
  const userPrompt = applyTemplate(prompts.user, {
    entity_types: entityTypesText,
    tuple_delimiter: DEFAULT_TUPLE_DELIMITER,
    completion_delimiter: DEFAULT_COMPLETION_DELIMITER,
    language,
    input_text: sanitizeText(params.content)
  })
  const continuePrompt = applyTemplate(prompts.continue, {
    tuple_delimiter: DEFAULT_TUPLE_DELIMITER,
    completion_delimiter: DEFAULT_COMPLETION_DELIMITER,
    language
  })

  const cacheSeed = [
    systemPrompt,
    userPrompt,
    `model=${params.modelId ?? ''}`,
    `provider=${params.providerId ?? ''}`,
    `embedding=${params.embeddingUpdatedAt ?? ''}`
  ].join('\n')
  const cacheKey = `default:extract:${md5(cacheSeed)}`

  return { systemPrompt, userPrompt, continuePrompt, cacheKey }
}

async function runExtraction(params: {
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  continuePrompt: string
  maxRounds?: number
}): Promise<string> {
  const messages: OpenAIChatMessage[] = [
    { role: 'system', content: params.systemPrompt },
    { role: 'user', content: params.userPrompt }
  ]

  const maxRounds = Math.max(1, params.maxRounds ?? 2)
  let fullOutput = ''

  for (let i = 0; i < maxRounds; i += 1) {
    const content = await callOpenAIChat({
      baseUrl: params.baseUrl,
      apiKey: params.apiKey,
      model: params.model,
      messages
    })

    fullOutput = fullOutput ? `${fullOutput}\n${content}` : content

    if (fullOutput.includes(DEFAULT_COMPLETION_DELIMITER)) {
      break
    }

    messages.push({ role: 'assistant', content })
    messages.push({ role: 'user', content: params.continuePrompt })
  }

  return fullOutput
}

// ============================================================================
// TaskScheduler
// ============================================================================

export class TaskScheduler {
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void
  private requestConcurrency: () => Promise<number>
  private providers: Map<string, KGModelProviderConfig> = new Map()

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

  updateProviders(providers: KGModelProviderConfig[]): void {
    const map = new Map<string, KGModelProviderConfig>()
    for (const provider of providers ?? []) {
      if (provider?.id) {
        map.set(provider.id, provider)
      }
    }
    this.providers = map
    log(`Model providers updated: ${map.size}`)
  }

  private resolveProviderAndModel(
    config: TaskConfig
  ):
    | { provider: KGModelProviderConfig; providerId: string; modelId: string }
    | { error: string } {
    let providerId = config.providerId
    let modelId = config.modelId
    const rawModel = typeof config.model === 'string' ? config.model : ''

    if ((!providerId || !modelId) && rawModel) {
      const parts = rawModel.split('/')
      if (parts.length >= 2) {
        if (!providerId) providerId = parts[0]
        if (!modelId) modelId = parts.slice(1).join('/')
      } else if (!modelId) {
        modelId = rawModel
      }
    }

    if (!providerId) {
      return { error: 'Missing providerId for LLM request' }
    }
    if (!modelId) {
      return { error: 'Missing modelId for LLM request' }
    }

    const provider = this.providers.get(providerId)
    if (!provider) {
      return { error: `Provider ${providerId} not found` }
    }
    if (!provider.enabled) {
      return { error: `Provider ${providerId} disabled` }
    }
    if (!provider.baseUrl || !provider.apiKey) {
      return { error: `Provider ${providerId} missing baseUrl/apiKey` }
    }

    return { provider, providerId, modelId }
  }

  private async readCache(
    cacheKey: string
  ): Promise<{ value: string; createTime?: string } | null> {
    const cacheRows = this.client.extractRecords(
      await this.client.query(
        'SELECT `return` AS cached_return, create_time FROM kg_llm_result_cache WHERE cache_key = $cacheKey LIMIT 1;',
        { cacheKey }
      )
    )
    const row = cacheRows[0]
    const value = row?.cached_return ?? row?.return
    if (!value) return null
    return { value: String(value), createTime: row?.create_time }
  }

  private async writeCache(cacheKey: string, value: string): Promise<void> {
    try {
      await this.client.query(
        'CREATE kg_llm_result_cache CONTENT { cache_key: $cacheKey, cache_type: $cacheType, return: $value };',
        { cacheKey, cacheType: 'default:extract', value }
      )
    } catch (error) {
      logError('Cache insert failed', error)
    }
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

      // 核心处理：每次轮询只处理一个 task 的一批 chunks
      const concurrency = Math.max(1, await this.requestConcurrency())

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
        return
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
        return
      }

      // 处理该 task 的 pending chunks
      await this.processTaskChunks(taskIdStr, task.config ?? {}, concurrency)
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
    const pendingChunks = this.client.extractRecords(
      await this.client.query(
        `SELECT * FROM kg_chunk WHERE task_id = $tid AND status = 'pending' ORDER BY chunk_index ASC LIMIT $lim;`,
        { tid: taskIdStr, lim: Math.max(1, concurrency) }
      )
    )

    if (pendingChunks.length === 0) {
      // 该 task 无 pending，派生更新后退出
      await this.reconcileTaskStatus(taskIdStr)
      return
    }

    const innerConcurrency = Math.max(1, Number((config as TaskConfig).llmConcurrency ?? 1))
    const actualConcurrency = Math.min(innerConcurrency, pendingChunks.length)

    log(
      `Processing ${taskIdStr}: ${pendingChunks.length} chunks (outer=${concurrency}, inner=${actualConcurrency})`
    )

    for (let i = 0; i < pendingChunks.length; i += actualConcurrency) {
      const batch = pendingChunks.slice(i, i + actualConcurrency)
      await Promise.allSettled(batch.map((c: any) => this.processChunk(c, config)))
    }

    // 每批处理后派生更新
    await this.reconcileTaskStatus(taskIdStr)
  }

  private async processChunk(chunk: any, config: Record<string, any>): Promise<void> {
    const chunkIdStr = rid(chunk.id)

    await this.client.query(`UPDATE ${chunkIdStr} SET status = 'progressing';`)

    try {
      const taskConfig = config as TaskConfig
      const resolved = this.resolveProviderAndModel(taskConfig)
      if ('error' in resolved) {
        throw new Error(resolved.error)
      }

      const { provider, providerId, modelId } = resolved

      const { systemPrompt, userPrompt, continuePrompt, cacheKey } = await buildPromptInputs({
        content: chunk.content ?? '',
        entityTypes: Array.isArray(taskConfig.entityTypes) ? taskConfig.entityTypes : undefined,
        language: taskConfig.outputLanguage,
        providerId,
        modelId,
        embeddingUpdatedAt: taskConfig.embeddingUpdatedAt
      })
      log('LLM request prepared', {
        chunkId: chunkIdStr,
        providerId,
        modelId,
        cacheKey,
        inputChars: String(chunk.content ?? '').length
      })

      const cached = await this.readCache(cacheKey)
      if (cached?.value) {
        const cachedAt = toDate(cached.createTime) ?? new Date()
        log('LLM cache hit', {
          chunkId: chunkIdStr,
          providerId,
          modelId,
          cacheKey,
          extractedAt: cachedAt.toISOString()
        })
        await this.client.query(
          `UPDATE ${chunkIdStr} SET status = 'completed', result = $result, error = NONE, cache_key = $cacheKey, cache_hit = true, extracted_at = $extractedAt;`,
          {
            result: { raw_response: cached.value },
            cacheKey,
            extractedAt: cachedAt
          }
        )
        return
      }
      log('LLM cache miss', { chunkId: chunkIdStr, providerId, modelId, cacheKey })
      const llmStart = Date.now()

      const rawResponse = await runExtraction({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: modelId,
        systemPrompt,
        userPrompt,
        continuePrompt
      })
      const durationMs = Date.now() - llmStart
      const extractedAt = new Date()
      log('LLM request completed', {
        chunkId: chunkIdStr,
        providerId,
        modelId,
        durationMs,
        outputChars: rawResponse.length,
        hasCompletionDelimiter: rawResponse.includes(DEFAULT_COMPLETION_DELIMITER)
      })
      await this.client.query(
        `UPDATE ${chunkIdStr} SET status = 'completed', result = $result, error = NONE, cache_key = $cacheKey, cache_hit = false, extracted_at = $extractedAt;`,
        { result: { raw_response: rawResponse }, cacheKey, extractedAt }
      )

      await this.writeCache(cacheKey, rawResponse)
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
