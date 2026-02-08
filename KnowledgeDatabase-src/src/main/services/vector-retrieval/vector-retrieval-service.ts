/**
 * @file 向量召回服务
 * @description 负责将 queryText 嵌入成向量，并在指定知识库的指定向量表中执行 KNN 检索
 */

import { logger } from '../logger'
import { KnowledgeLibraryService } from '../knowledgeBase-library/knowledge-library-service'
import { KnowledgeConfigService } from '../knowledgeBase-library/knowledge-config-service'
import { DocumentService } from '../knowledgeBase-library/document-service'
import { ModelConfigService } from '../model-config/model-config-service'
import type { VectorRetrievalHit, VectorRetrievalSearchParams } from './types'
import { OpenAICompatibleEmbeddingClient } from './embedding-client'
import { RerankClient } from './reranker/rerank-client'
import type { KnowledgeConfig } from '../../../preload/types/knowledge-config.types'
import type { PersistedModelProviderConfig } from '../model-config/types'
import type { SurrealDBService, QueryService } from '../surrealdb-service'

type ResolvedEmbeddingConfig = {
  id: string
  name?: string
  dimensions: number
  candidates: Array<{ providerId: string; modelId: string }>
}

export class VectorRetrievalService {
  private readonly documentService = new DocumentService()
  private readonly knowledgeConfigService = new KnowledgeConfigService()
  private readonly modelConfigService = new ModelConfigService()
  private readonly embeddingClient = new OpenAICompatibleEmbeddingClient()
  private readonly rerankClient = new RerankClient()


  constructor(
    private readonly surrealDBService: SurrealDBService,
    private readonly knowledgeLibraryService: KnowledgeLibraryService
  ) {}

  private getQueryService(): QueryService {
    return this.surrealDBService.getQueryService()
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  async search(params: VectorRetrievalSearchParams): Promise<{
    results: VectorRetrievalHit[]
    resolved: {
      knowledgeBaseId: number
      tableName: string
      dimensions: number
      embeddingConfigId: string
      embeddingModelId: string
      embeddingProviderId: string
    }
  }> {
    const knowledgeBaseId = Number(params.knowledgeBaseId)
    const tableName = String(params.tableName || '').trim()
    const queryText = String(params.queryText || '').trim()
    const k = this.normalizePositiveInt(params.k, 10)
    const ef = this.normalizePositiveInt(params.ef, 100)

    if (!knowledgeBaseId || Number.isNaN(knowledgeBaseId)) {
      throw new Error('Invalid knowledgeBaseId')
    }

    if (!queryText) {
      throw new Error('queryText is required')
    }

    this.assertSafeVectorTableName(tableName)

    const dimensions = this.parseDimensionsFromTableName(tableName)
    if (!dimensions) {
      throw new Error(`Cannot parse dimensions from tableName: ${tableName}`)
    }

    // 1) 获取知识库信息
    const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
    if (!kb) {
      throw new Error(`Knowledge base not found (ID: ${knowledgeBaseId})`)
    }
    if (!kb.databaseName) {
      throw new Error(`Knowledge base missing databaseName (ID: ${knowledgeBaseId})`)
    }
    if (!kb.documentPath) {
      throw new Error(`Knowledge base missing documentPath (ID: ${knowledgeBaseId})`)
    }

    // 2) 读取知识库配置，解析 embedding config
    await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
    const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

    const kbConfig = (await this.knowledgeConfigService.readConfig(kbRoot)) as KnowledgeConfig
    const embeddingConfig = this.resolveEmbeddingConfigForTable(kbConfig, tableName, dimensions)

    // 3) 选取 provider + model，并调用 embeddings API 生成 queryVector
    const provider = await this.resolveProviderForEmbedding(embeddingConfig)
    const { queryVector, providerId, modelId } = await this.embedQueryText({
      queryText,
      dimensions,
      candidates: embeddingConfig.candidates,
      providerMap: provider
    })

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      throw new Error('Embedding returned empty vector')
    }
    if (queryVector.length !== dimensions) {
      throw new Error(
        `Embedding dimension mismatch: expected ${dimensions}, got ${queryVector.length}`
      )
    }

    // 4) KNN 查询
    const queryService = this.getQueryService()
    if (!queryService.isConnected()) {
      throw new Error('Database not connected')
    }
    const namespace = this.getNamespace()

    // ========== [Feature] fileKey/fileKeys 筛选逻辑（v3 新增） ==========
    // 构建 WHERE 子句的筛选条件
    // - 优先级: params.fileKey > params.fileKeys
    // - fileKey: 单个文件筛选 (file_key = $fileKey)
    // - fileKeys: 多个文件筛选 (file_key IN $fileKeys)
    const filters: string[] = [`embedding <|${k},${ef}|> $queryVector`]
    const queryParams: Record<string, any> = { queryVector }

    if (params.fileKey) {
      filters.push('file_key = $fileKey')
      queryParams.fileKey = params.fileKey
    } else if (Array.isArray(params.fileKeys) && params.fileKeys.length > 0) {
      filters.push('file_key IN $fileKeys')
      queryParams.fileKeys = params.fileKeys
    }

    const whereClause = filters.join(' AND ')
    // ========== [/Feature] fileKey/fileKeys 筛选逻辑 ==========

    const sql = `
      SELECT
        id,
        content,
        chunk_index,
        file_key,
        file_name,
        vector::distance::knn() AS distance
      FROM \`${tableName}\`
      WHERE ${whereClause}
      ORDER BY distance ASC;
    `

    const raw = await queryService.queryInDatabase<any>(namespace, kb.databaseName, sql, queryParams)

    const records = this.extractRecords(raw)

    const results: VectorRetrievalHit[] = records
      .filter((r) => r && typeof r === 'object')
      .map((r: any) => ({
        id: typeof r.id === 'object' ? r.id.id || String(r.id) : String(r.id),
        content: String(r.content ?? ''),
        chunk_index: typeof r.chunk_index === 'number' ? r.chunk_index : undefined,
        file_key: r.file_key ? String(r.file_key) : undefined,
        file_name: r.file_name ? String(r.file_name) : undefined,
        distance: typeof r.distance === 'number' ? r.distance : undefined
      }))

    return {
      results,
      resolved: {
        knowledgeBaseId,
        tableName,
        dimensions,
        embeddingConfigId: embeddingConfig.id,
        embeddingModelId: modelId,
        embeddingProviderId: providerId
      }
    }
  }

  // ==========================================================================
  // Rerank
  // ==========================================================================

  /**
   * 向量召回 + 重排
   * 先执行普通 search，再调用重排模型对结果重新排序
   */
  async searchWithRerank(params: VectorRetrievalSearchParams): Promise<{
    results: VectorRetrievalHit[]
    resolved: {
      knowledgeBaseId: number
      tableName: string
      dimensions: number
      embeddingConfigId: string
      embeddingModelId: string
      embeddingProviderId: string
      rerankModelId: string
      rerankProviderId: string
    }
  }> {
    const rerankModelId = String(params.rerankModelId || '').trim()
    if (!rerankModelId) {
      throw new Error('rerankModelId is required for searchWithRerank')
    }

    // 1) 执行普通向量召回
    const { results: hits, resolved: searchResolved } = await this.search(params)

    if (hits.length === 0) {
      return {
        results: [],
        resolved: {
          ...searchResolved,
          rerankModelId,
          rerankProviderId: ''
        }
      }
    }

    // 2) 解析重排模型对应的 provider
    const { provider, providerId } = await this.resolveModelProvider(rerankModelId)

    // 3) 组装 documents
    const documents = hits.map((h) => h.content)
    const topN = this.normalizePositiveInt(params.rerankTopN, hits.length)

    // 4) 调用重排
    logger.info('[VectorRetrieval] Starting rerank', {
      rerankModelId,
      rerankProviderId: providerId,
      documentCount: documents.length,
      topN
    })

    const rerankResults = await this.rerankClient.rerank({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: rerankModelId,
      query: String(params.queryText || '').trim(),
      documents,
      topN,
      headers: provider.defaultHeaders
    })

    // 5) 按 relevance_score 降序映射回原始 Hit
    const rerankedHits: VectorRetrievalHit[] = rerankResults
      .filter((r) => r.index >= 0 && r.index < hits.length)
      .map((r) => ({
        ...hits[r.index],
        rerank_score: r.relevance_score
      }))

    logger.info('[VectorRetrieval] Rerank completed', {
      inputCount: hits.length,
      outputCount: rerankedHits.length,
      topScore: rerankedHits[0]?.rerank_score
    })

    return {
      results: rerankedHits,
      resolved: {
        ...searchResolved,
        rerankModelId,
        rerankProviderId: providerId
      }
    }
  }

  /**
   * 根据模型 ID 解析对应的 provider 配置
   * 遍历所有 providers，查找包含该 modelId 的启用 provider
   */
  private async resolveModelProvider(modelId: string): Promise<{
    provider: PersistedModelProviderConfig
    providerId: string
  }> {
    const modelConfig = await this.modelConfigService.getConfig()

    for (const p of modelConfig.providers || []) {
      if (!p?.enabled || !p.baseUrl || !p.apiKey) continue
      const hasModel = p.models?.some((m) => m.id === modelId)
      if (hasModel) {
        return { provider: p, providerId: p.id }
      }
    }

    throw new Error(`No enabled provider found for model: ${modelId}`)
  }

  // ==========================================================================
  // Embedding config resolve
  // ==========================================================================

  /**
   * 生成向量表名（与 VectorIndexer 的命名保持一致）
   */
  private getChunksTableName(configId: string, dimensions: number): string {
    const safeId = configId.replace(/[^a-zA-Z0-9_]/g, '_')
    return `emb_cfg_${safeId}_${dimensions}_chunks`
  }

  private getAltChunksTableName(configId: string, dimensions: number): string {
    const safeId = configId.replace(/[^a-zA-Z0-9_]/g, '_')
    return `emb_${safeId}_${dimensions}_chunks`
  }

  private resolveEmbeddingConfigForTable(
    cfg: KnowledgeConfig,
    tableName: string,
    dimensions: number
  ): ResolvedEmbeddingConfig {
    const list = cfg.global?.embedding?.configs || []
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('No embedding configs found in KnowledgeConfig.json')
    }

    // 先按“表名计算一致”匹配，避免 cfg_ 前缀/安全字符差异
    for (const item of list as any[]) {
      if (!item?.id) continue
      const expected1 = this.getChunksTableName(String(item.id), dimensions)
      const expected2 = this.getAltChunksTableName(String(item.id), dimensions)
      if (tableName === expected1 || tableName === expected2) {
        return {
          id: String(item.id),
          name: item.name ? String(item.name) : undefined,
          dimensions: dimensions,
          candidates: Array.isArray(item.candidates) ? item.candidates : []
        }
      }
    }

    // fallback：从表名解析 configId，再尝试多种归一化匹配
    const parsed = this.parseConfigIdFromTableName(tableName)
    if (parsed) {
      const candidates = this.buildConfigIdCandidates(parsed)
      for (const id of candidates) {
        const hit = (list as any[]).find((x) => String(x?.id) === id)
        if (hit) {
          return {
            id: String(hit.id),
            name: hit.name ? String(hit.name) : undefined,
            dimensions: dimensions,
            candidates: Array.isArray(hit.candidates) ? hit.candidates : []
          }
        }
      }
    }

    throw new Error(`Embedding config not found for table: ${tableName}`)
  }

  private parseConfigIdFromTableName(tableName: string): string | null {
    const m = tableName.match(/^emb_(.+)_(\d+)_chunks$/)
    if (!m) return null
    return m[1] ? String(m[1]) : null
  }

  private buildConfigIdCandidates(configIdFromTable: string): string[] {
    const out: string[] = []
    const push = (v: string) => {
      if (v && !out.includes(v)) out.push(v)
    }

    push(configIdFromTable)

    // 常见情况：tableName 的 config 段可能多一个 cfg_ 前缀（例如 cfg_cfg_xxx）
    if (configIdFromTable.startsWith('cfg_')) {
      push(configIdFromTable.slice(4))
      if (configIdFromTable.startsWith('cfg_cfg_')) {
        push(configIdFromTable.slice(4)) // cfg_xxx
        push(configIdFromTable.slice(8)) // xxx
      }
    }

    // 也可能缺少 cfg_ 前缀
    push(`cfg_${configIdFromTable}`)

    return out
  }

  // ==========================================================================
  // Provider resolve + embed
  // ==========================================================================

  private async resolveProviderForEmbedding(
    embeddingConfig: ResolvedEmbeddingConfig
  ): Promise<Map<string, PersistedModelProviderConfig>> {
    if (!Array.isArray(embeddingConfig.candidates) || embeddingConfig.candidates.length === 0) {
      throw new Error('Embedding config has no candidates')
    }

    const modelConfig = await this.modelConfigService.getConfig()
    const providerMap = new Map<string, PersistedModelProviderConfig>()

    for (const p of modelConfig.providers || []) {
      if (p && p.id) {
        providerMap.set(p.id, p)
      }
    }

    return providerMap
  }

  private async embedQueryText(params: {
    queryText: string
    dimensions: number
    candidates: Array<{ providerId: string; modelId: string }>
    providerMap: Map<string, PersistedModelProviderConfig>
  }): Promise<{ queryVector: number[]; providerId: string; modelId: string }> {
    let lastError: Error | null = null

    for (const cand of params.candidates) {
      const providerId = String(cand?.providerId || '')
      const modelId = String(cand?.modelId || '')

      if (!providerId || !modelId) {
        continue
      }

      const provider = params.providerMap.get(providerId)
      if (!provider || !provider.enabled) {
        continue
      }

      if (!provider.baseUrl || !provider.apiKey) {
        continue
      }

      try {
        const queryVector = await this.embeddingClient.createEmbedding({
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model: modelId,
          input: params.queryText,
          dimensions: params.dimensions,
          headers: provider.defaultHeaders
        })

        return { queryVector, providerId, modelId }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        lastError = e
        logger.warn('[VectorRetrieval] Embedding candidate failed, trying next', {
          providerId,
          modelId,
          error: e.message
        })
      }
    }

    throw lastError || new Error('All embedding candidates failed')
  }

  // ==========================================================================
  // SurrealDB connection
  // ==========================================================================

  private getNamespace(): string {
    return this.surrealDBService.getQueryService().getNamespace() || 'knowledge'
  }


  // ==========================================================================
  // Helpers
  // ==========================================================================

  private normalizePositiveInt(v: unknown, fallback: number): number {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    if (!Number.isFinite(n)) return fallback
    const i = Math.floor(n)
    return i > 0 ? i : fallback
  }

  private parseDimensionsFromTableName(tableName: string): number | null {
    const m = tableName.match(/_(\d+)_chunks$/)
    if (!m) return null
    const n = parseInt(m[1], 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  private assertSafeVectorTableName(tableName: string): void {
    if (!tableName) {
      throw new Error('tableName is required')
    }

    // 只允许安全字符，避免动态表名注入
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid tableName: ${tableName}`)
    }
    if (!tableName.startsWith('emb_') || !tableName.endsWith('_chunks')) {
      throw new Error(`Invalid vector tableName: ${tableName}`)
    }
  }

  private extractRecords(result: any): any[] {
    if (!result) return []
    if (Array.isArray(result)) {
      // Handle double-nested arrays: [ [ {record} ] ]
      if (result.length === 1 && Array.isArray(result[0])) {
        const inner = result[0]
        if (inner.length > 0 && typeof inner[0] === 'object' && !Array.isArray(inner[0])) {
          return inner
        }
      }

      for (const entry of result) {
        if (Array.isArray(entry?.result)) {
          if (entry.result.length > 0) return entry.result
        }
      }
      if (result.length > 0 && typeof result[0] === 'object' && !('result' in result[0])) {
        return result
      }
      return []
    }
    if (Array.isArray(result?.result)) return result.result
    return []
  }
}
