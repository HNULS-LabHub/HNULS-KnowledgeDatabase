/**
 * @file 向量搜索模块
 * @description 对 entity / relation / chunk 表执行 HNSW KNN 向量搜索，
 *              以及查询文本的向量化（调用 Embedding API）
 */

import type { KGSurrealClient } from '../../db/surreal-client'
import type {
  EmbeddingCallConfig,
  EntitySearchHit,
  RelationSearchHit,
  ChunkSearchHit
} from './types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-VectorSearch] ${msg}`, data)
  } else {
    console.log(`[KG-VectorSearch] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-VectorSearch] ${msg}`, error)
}

// ============================================================================
// 辅助：Record ID 转字符串
// ============================================================================

function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}

// ============================================================================
// VectorSearch
// ============================================================================

export class VectorSearch {
  constructor(private readonly client: KGSurrealClient) {}

  // ==========================================================================
  // Embedding API 调用
  // ==========================================================================

  /**
   * 将文本向量化（调用 OpenAI 兼容 Embedding API）
   */
  async embedText(text: string, config: EmbeddingCallConfig): Promise<number[]> {
    const url = `${config.baseUrl.replace(/\/$/, '')}/v1/embeddings`

    const body: Record<string, unknown> = {
      model: config.model,
      input: text
    }
    if (config.dimensions !== undefined) {
      body.dimensions = config.dimensions
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          ...(config.headers || {})
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data = await response.json()

      if (!response.ok) {
        const errMsg =
          (data as any)?.error?.message || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`Embedding API error: ${errMsg}`)
      }

      const embeddingData = data as {
        data: Array<{ embedding: number[] }>
      }

      if (embeddingData.data && embeddingData.data.length > 0) {
        return embeddingData.data[0].embedding
      }

      throw new Error('No embedding returned in response')
    } catch (err) {
      clearTimeout(timeoutId)

      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Embedding request timeout (30s)')
      }
      throw err
    }
  }

  // ==========================================================================
  // 实体向量搜索
  // ==========================================================================

  /**
   * 在实体表上执行 HNSW KNN 搜索
   */
  async searchEntities(params: {
    namespace: string
    database: string
    tableName: string
    queryVector: number[]
    topK: number
    ef: number
  }): Promise<EntitySearchHit[]> {
    const { namespace, database, tableName, queryVector, topK, ef } = params

    const sql = `
      SELECT
        id,
        entity_name,
        entity_type,
        description,
        vector::distance::knn() AS distance
      FROM \`${tableName}\`
      WHERE embedding <|${topK},${ef}|> $queryVector
      ORDER BY distance ASC;
    `

    try {
      const raw = await this.client.queryInDatabase(namespace, database, sql, { queryVector })
      const records = this.client.extractRecords(raw)

      return records
        .filter((r) => r && typeof r === 'object')
        .map((r: any) => ({
          id: rid(r.id),
          entity_name: String(r.entity_name ?? ''),
          entity_type: String(r.entity_type ?? ''),
          description: String(r.description ?? ''),
          distance: typeof r.distance === 'number' ? r.distance : Infinity
        }))
    } catch (error) {
      logError(`Entity search failed on ${tableName}`, error)
      throw error
    }
  }

  // ==========================================================================
  // 关系向量搜索
  // ==========================================================================

  /**
   * 在关系表上执行 HNSW KNN 搜索
   */
  async searchRelations(params: {
    namespace: string
    database: string
    tableName: string
    queryVector: number[]
    topK: number
    ef: number
  }): Promise<RelationSearchHit[]> {
    const { namespace, database, tableName, queryVector, topK, ef } = params

    const sql = `
      SELECT
        id,
        in.entity_name AS source_name,
        out.entity_name AS target_name,
        keywords,
        description,
        weight,
        vector::distance::knn() AS distance
      FROM \`${tableName}\`
      WHERE embedding <|${topK},${ef}|> $queryVector
      ORDER BY distance ASC;
    `

    try {
      const raw = await this.client.queryInDatabase(namespace, database, sql, { queryVector })
      const records = this.client.extractRecords(raw)

      return records
        .filter((r) => r && typeof r === 'object')
        .map((r: any) => ({
          id: rid(r.id),
          source_name: String(r.source_name ?? ''),
          target_name: String(r.target_name ?? ''),
          keywords: String(r.keywords ?? ''),
          description: String(r.description ?? ''),
          weight: typeof r.weight === 'number' ? r.weight : 1.0,
          distance: typeof r.distance === 'number' ? r.distance : Infinity
        }))
    } catch (error) {
      logError(`Relation search failed on ${tableName}`, error)
      throw error
    }
  }

  // ==========================================================================
  // Chunk 向量搜索（naive 模式）
  // ==========================================================================

  /**
   * 在 chunk 向量表上执行 HNSW KNN 搜索
   */
  async searchChunks(params: {
    namespace: string
    database: string
    tableName: string
    queryVector: number[]
    topK: number
    ef: number
  }): Promise<ChunkSearchHit[]> {
    const { namespace, database, tableName, queryVector, topK, ef } = params

    const sql = `
      SELECT
        id,
        content,
        chunk_index,
        file_key,
        file_name,
        vector::distance::knn() AS distance
      FROM \`${tableName}\`
      WHERE embedding <|${topK},${ef}|> $queryVector
      ORDER BY distance ASC;
    `

    try {
      const raw = await this.client.queryInDatabase(namespace, database, sql, { queryVector })
      const records = this.client.extractRecords(raw)

      return records
        .filter((r) => r && typeof r === 'object')
        .map((r: any) => ({
          id: rid(r.id),
          content: String(r.content ?? ''),
          chunk_index: typeof r.chunk_index === 'number' ? r.chunk_index : undefined,
          file_key: r.file_key ? String(r.file_key) : undefined,
          file_name: r.file_name ? String(r.file_name) : undefined,
          distance: typeof r.distance === 'number' ? r.distance : Infinity
        }))
    } catch (error) {
      logError(`Chunk search failed on ${tableName}`, error)
      throw error
    }
  }

  // ==========================================================================
  // 批量向量化多个关键词
  // ==========================================================================

  /**
   * 将多个关键词分别向量化
   * @returns 关键词与其对应向量的映射数组
   */
  async embedKeywords(
    keywords: string[],
    config: EmbeddingCallConfig
  ): Promise<Array<{ keyword: string; vector: number[] }>> {
    const results: Array<{ keyword: string; vector: number[] }> = []

    for (const keyword of keywords) {
      if (!keyword.trim()) continue
      try {
        const vector = await this.embedText(keyword, config)
        results.push({ keyword, vector })
      } catch (error) {
        logError(`Failed to embed keyword: "${keyword}"`, error)
        // 跳过失败的关键词，继续处理其余
      }
    }

    return results
  }

  // ==========================================================================
  // 多关键词搜索合并（去重）
  // ==========================================================================

  /**
   * 对多个关键词向量分别搜索实体，合并去重（取最小 distance）
   */
  async searchEntitiesByKeywords(params: {
    namespace: string
    database: string
    tableName: string
    keywordVectors: Array<{ keyword: string; vector: number[] }>
    topK: number
    ef: number
  }): Promise<EntitySearchHit[]> {
    const { namespace, database, tableName, keywordVectors, topK, ef } = params
    const hitMap = new Map<string, EntitySearchHit>()

    for (const { vector } of keywordVectors) {
      const hits = await this.searchEntities({
        namespace,
        database,
        tableName,
        queryVector: vector,
        topK,
        ef
      })
      for (const hit of hits) {
        const existing = hitMap.get(hit.id)
        if (!existing || hit.distance < existing.distance) {
          hitMap.set(hit.id, hit)
        }
      }
    }

    // 按 distance 升序返回
    return Array.from(hitMap.values()).sort((a, b) => a.distance - b.distance)
  }

  /**
   * 对多个关键词向量分别搜索关系，合并去重（取最小 distance）
   */
  async searchRelationsByKeywords(params: {
    namespace: string
    database: string
    tableName: string
    keywordVectors: Array<{ keyword: string; vector: number[] }>
    topK: number
    ef: number
  }): Promise<RelationSearchHit[]> {
    const { namespace, database, tableName, keywordVectors, topK, ef } = params
    const hitMap = new Map<string, RelationSearchHit>()

    for (const { vector } of keywordVectors) {
      const hits = await this.searchRelations({
        namespace,
        database,
        tableName,
        queryVector: vector,
        topK,
        ef
      })
      for (const hit of hits) {
        const existing = hitMap.get(hit.id)
        if (!existing || hit.distance < existing.distance) {
          hitMap.set(hit.id, hit)
        }
      }
    }

    return Array.from(hitMap.values()).sort((a, b) => a.distance - b.distance)
  }
}
