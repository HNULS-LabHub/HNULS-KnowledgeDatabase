/**
 * @file Chunk 收集与截断模块
 * @description 根据 chunk ID 集合批量读取完整内容，去重、按分数排序、按 token 预算截断
 */

import type { KGSurrealClient } from '../../db/surreal-client'
import type { RawChunk, ScoredChunk, TokenBudgetConfig } from './types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-ChunkCollector] ${msg}`, data)
  } else {
    console.log(`[KG-ChunkCollector] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-ChunkCollector] ${msg}`, error)
}

// ============================================================================
// 辅助
// ============================================================================

function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}

/**
 * 简易 token 估算（字符数 / 4）
 * 与 LightRAG 保持一致的粗估策略，后期可替换为 tiktoken
 */
function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

// ============================================================================
// ChunkCollector
// ============================================================================

export class ChunkCollector {
  constructor(private readonly client: KGSurrealClient) {}

  // ==========================================================================
  // 从数据库批量获取 chunk 内容
  // ==========================================================================

  /**
   * 根据 chunkIds 批量获取 chunk 内容
   * chunk ID 格式为完整的 SurrealDB Record ID（如 emb_cfg_xxx_3072_chunks:abc123）
   */
  async fetchChunksByIds(params: {
    namespace: string
    database: string
    chunkTableName: string
    chunkIds: string[]
  }): Promise<RawChunk[]> {
    const { namespace, database, chunkTableName, chunkIds } = params

    if (chunkIds.length === 0) return []

    // 分批获取，避免单次查询过大
    const BATCH_SIZE = 100
    const allChunks: RawChunk[] = []

    for (let i = 0; i < chunkIds.length; i += BATCH_SIZE) {
      const batch = chunkIds.slice(i, i + BATCH_SIZE)
      try {
        const chunks = await this.fetchChunkBatch(namespace, database, chunkTableName, batch)
        allChunks.push(...chunks)
      } catch (error) {
        logError(`Failed to fetch chunk batch (offset ${i}, size ${batch.length})`, error)
      }
    }

    log(`Fetched ${allChunks.length}/${chunkIds.length} chunks from ${chunkTableName}`)
    return allChunks
  }

  /**
   * 单批次获取 chunk
   */
  private async fetchChunkBatch(
    namespace: string,
    database: string,
    chunkTableName: string,
    chunkIds: string[]
  ): Promise<RawChunk[]> {
    // 使用 IN 子句批量查询
    // chunk ID 可能是完整 Record ID（含表名前缀），也可能只是 ID 部分
    // 为安全起见，使用参数化查询
    const sql = `
      SELECT id, content, chunk_index, file_key, file_name
      FROM \`${chunkTableName}\`
      WHERE id IN $ids;
    `

    const raw = await this.client.queryInDatabase(namespace, database, sql, { ids: chunkIds })
    const records = this.client.extractRecords(raw)

    return records
      .filter((r) => r && typeof r === 'object')
      .map((r: any) => ({
        id: rid(r.id),
        content: String(r.content ?? ''),
        chunk_index: typeof r.chunk_index === 'number' ? r.chunk_index : undefined,
        file_key: r.file_key ? String(r.file_key) : undefined,
        file_name: r.file_name ? String(r.file_name) : undefined
      }))
  }

  // ==========================================================================
  // 去重
  // ==========================================================================

  /**
   * 对 ScoredChunk 数组去重（按 id），保留分数最高的
   */
  deduplicateChunks(chunks: ScoredChunk[]): ScoredChunk[] {
    const map = new Map<string, ScoredChunk>()

    for (const chunk of chunks) {
      const existing = map.get(chunk.id)
      if (!existing || chunk.score > existing.score) {
        map.set(chunk.id, chunk)
      }
    }

    return Array.from(map.values())
  }

  // ==========================================================================
  // Token 预算截断
  // ==========================================================================

  /**
   * 按 token 预算截断 chunk 列表
   * chunks 应已按分数降序排列
   */
  truncateByTokenBudget(chunks: ScoredChunk[], maxTokens: number): ScoredChunk[] {
    if (maxTokens <= 0) return chunks

    const result: ScoredChunk[] = []
    let usedTokens = 0

    for (const chunk of chunks) {
      const tokens = estimateTokens(chunk.content)
      if (usedTokens + tokens > maxTokens && result.length > 0) {
        break
      }
      result.push(chunk)
      usedTokens += tokens
    }

    if (result.length < chunks.length) {
      log(`Token budget truncation: ${chunks.length} → ${result.length} chunks (${usedTokens}/${maxTokens} tokens)`)
    }

    return result
  }

  // ==========================================================================
  // 实体/关系描述截断
  // ==========================================================================

  /**
   * 对实体描述列表按 token 预算截断
   */
  truncateDescriptions(
    items: Array<{ description: string; [key: string]: any }>,
    maxTokens: number
  ): typeof items {
    if (maxTokens <= 0) return items

    const result: typeof items = []
    let usedTokens = 0

    for (const item of items) {
      const tokens = estimateTokens(item.description)
      if (usedTokens + tokens > maxTokens && result.length > 0) {
        break
      }
      result.push(item)
      usedTokens += tokens
    }

    return result
  }

  // ==========================================================================
  // 综合：去重 + 排序 + 截断
  // ==========================================================================

  /**
   * 一站式处理：去重 → 按分数降序排序 → token 截断
   */
  deduplicateAndTruncate(chunks: ScoredChunk[], maxTokens: number): ScoredChunk[] {
    // 1. 去重
    const unique = this.deduplicateChunks(chunks)

    // 2. 按分数降序
    unique.sort((a, b) => b.score - a.score)

    // 3. token 截断
    return this.truncateByTokenBudget(unique, maxTokens)
  }

  // ==========================================================================
  // RawChunk → ScoredChunk 转换
  // ==========================================================================

  /**
   * 将 RawChunk 转换为 ScoredChunk，附加分数和来源标记
   */
  toScoredChunks(
    rawChunks: RawChunk[],
    score: number,
    source: ScoredChunk['source']
  ): ScoredChunk[] {
    return rawChunks.map((c) => ({
      id: c.id,
      content: c.content,
      file_key: c.file_key ?? '',
      file_name: c.file_name,
      chunk_index: c.chunk_index,
      score,
      source
    }))
  }
}
