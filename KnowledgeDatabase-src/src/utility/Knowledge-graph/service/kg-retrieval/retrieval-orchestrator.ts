/**
 * @file 检索管线编排器
 * @description 组合 KeywordExtractor / VectorSearch / GraphTraversal / ChunkCollector / RerankClient，
 *              实现四种检索模式（local / global / hybrid / naive）的完整管线
 */

import type { KGSurrealClient } from '../../db/surreal-client'
import type {
  KGModelProviderConfig,
  KGRetrievalParams,
  KGRetrievalResult,
  KGRetrievalEntity,
  KGRetrievalRelation,
  KGRetrievalChunk,
  KGRetrievalMeta
} from '@shared/knowledge-graph-ipc.types'
import { getKgTableNames } from '../graph-schema'
import { KeywordExtractor } from './keyword-extractor'
import { VectorSearch } from './vector-search'
import { GraphTraversal } from './graph-traversal'
import { ChunkCollector } from './chunk-collector'
import { KGRerankClient } from './rerank-client'
import type {
  EmbeddingCallConfig,
  RerankCallConfig,
  ExtractedKeywords,
  ScoredChunk,
  TokenBudgetConfig,
  VectorSearchConfig,
  GraphTraversalConfig,
  EntitySearchHit,
  RelationSearchHit
} from './types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-RetrievalOrchestrator] ${msg}`, data)
  } else {
    console.log(`[KG-RetrievalOrchestrator] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-RetrievalOrchestrator] ${msg}`, error)
}

// ============================================================================
// 默认值
// ============================================================================

const DEFAULT_VECTOR_SEARCH: VectorSearchConfig = {
  entityTopK: 20,
  relationTopK: 20,
  chunkTopK: 60,
  ef: 100
}

const DEFAULT_GRAPH_TRAVERSAL: GraphTraversalConfig = {
  maxDepth: 1,
  maxNeighbors: 10
}

const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  maxEntityDescTokens: 2000,
  maxRelationDescTokens: 2000,
  maxChunkTokens: 4000,
  maxTotalTokens: 8000
}

// ============================================================================
// RetrievalOrchestrator
// ============================================================================

export class RetrievalOrchestrator {
  private keywordExtractor: KeywordExtractor
  private vectorSearch: VectorSearch
  private graphTraversal: GraphTraversal
  private chunkCollector: ChunkCollector
  private rerankClient: KGRerankClient

  constructor(
    private readonly client: KGSurrealClient,
    providers: Map<string, KGModelProviderConfig>
  ) {
    this.keywordExtractor = new KeywordExtractor(providers)
    this.vectorSearch = new VectorSearch(client)
    this.graphTraversal = new GraphTraversal(client)
    this.chunkCollector = new ChunkCollector(client)
    this.rerankClient = new KGRerankClient()
  }

  /**
   * 更新 providers（主进程同步配置时调用）
   */
  updateProviders(providers: Map<string, KGModelProviderConfig>): void {
    this.keywordExtractor.updateProviders(providers)
  }

  // ==========================================================================
  // 主入口
  // ==========================================================================

  /**
   * 执行检索
   */
  async search(params: KGRetrievalParams): Promise<KGRetrievalResult> {
    const startTime = Date.now()

    log(`Starting retrieval: mode=${params.mode}, query="${params.query.slice(0, 80)}..."`)

    // 参数校验
    this.validateParams(params)

    // 解析配置
    const embeddingConfig = this.resolveEmbeddingConfig(params)
    const vsConfig = this.resolveVectorSearchConfig(params)
    const gtConfig = this.resolveGraphTraversalConfig(params)
    const tokenBudget = this.resolveTokenBudget(params)
    const tableNames = getKgTableNames(params.graphTableBase)

    let result: KGRetrievalResult

    switch (params.mode) {
      case 'local':
        result = await this.localSearch(
          params,
          embeddingConfig,
          vsConfig,
          gtConfig,
          tokenBudget,
          tableNames
        )
        break
      case 'global':
        result = await this.globalSearch(
          params,
          embeddingConfig,
          vsConfig,
          gtConfig,
          tokenBudget,
          tableNames
        )
        break
      case 'hybrid':
        result = await this.hybridSearch(
          params,
          embeddingConfig,
          vsConfig,
          gtConfig,
          tokenBudget,
          tableNames
        )
        break
      case 'naive':
        result = await this.naiveSearch(params, embeddingConfig, vsConfig, tokenBudget)
        break
      default:
        throw new Error(`Unknown retrieval mode: ${params.mode}`)
    }

    result.meta.durationMs = Date.now() - startTime

    log(
      `Retrieval completed: mode=${params.mode}, entities=${result.meta.entityCount}, relations=${result.meta.relationCount}, chunks=${result.meta.chunkCount}, duration=${result.meta.durationMs}ms`
    )

    return result
  }

  // ==========================================================================
  // Local 模式（实体中心）
  // ==========================================================================

  private async localSearch(
    params: KGRetrievalParams,
    embeddingConfig: EmbeddingCallConfig,
    vsConfig: VectorSearchConfig,
    gtConfig: GraphTraversalConfig,
    tokenBudget: TokenBudgetConfig,
    tableNames: ReturnType<typeof getKgTableNames>
  ): Promise<KGRetrievalResult> {
    const { targetNamespace, targetDatabase } = params

    // 1. 关键词提取（低层级关键词）
    const keywords = await this.extractKeywords(params)

    // 2. 关键词向量化
    const keywordsToEmbed = keywords.lowLevel.length > 0 ? keywords.lowLevel : [params.query]
    const keywordVectors = await this.vectorSearch.embedKeywords(keywordsToEmbed, embeddingConfig)

    if (keywordVectors.length === 0) {
      // fallback：直接向量化原始查询
      const queryVector = await this.vectorSearch.embedText(params.query, embeddingConfig)
      keywordVectors.push({ keyword: params.query, vector: queryVector })
    }

    // 3. 实体向量搜索
    const entityHits = await this.vectorSearch.searchEntitiesByKeywords({
      namespace: targetNamespace,
      database: targetDatabase,
      tableName: tableNames.entity,
      keywordVectors,
      topK: vsConfig.entityTopK,
      ef: vsConfig.ef
    })

    log(`Local: ${entityHits.length} seed entities found`)

    if (entityHits.length === 0) {
      return this.emptyResult(params.mode, keywords)
    }

    // 4. 图扩展
    const expansion = await this.graphTraversal.expandFromEntities({
      namespace: targetNamespace,
      database: targetDatabase,
      entityTableName: tableNames.entity,
      relatesTableName: tableNames.relates,
      entityChunksTableName: tableNames.entityChunks,
      relationChunksTableName: tableNames.relationChunks,
      seedEntityIds: entityHits.map((e) => e.id),
      maxDepth: gtConfig.maxDepth,
      maxNeighbors: gtConfig.maxNeighbors
    })

    // 5. 收集 chunks
    const chunkTableName = this.resolveChunkTableName(params)
    const scoredChunks = await this.collectAndScoreChunks(
      targetNamespace,
      targetDatabase,
      chunkTableName,
      expansion.chunkIds,
      'entity_expansion'
    )

    // 6. 重排（可选）
    const { chunks: finalChunks, rerankApplied } = await this.maybeRerank(params, scoredChunks)

    // 7. Token 截断
    const truncatedEntities = this.chunkCollector.truncateDescriptions(
      this.entityHitsToRetrievalEntities(entityHits),
      tokenBudget.maxEntityDescTokens
    ) as KGRetrievalEntity[]

    const truncatedRelations = this.chunkCollector.truncateDescriptions(
      this.expandedRelationsToRetrieval(expansion.relations, entityHits),
      tokenBudget.maxRelationDescTokens
    ) as KGRetrievalRelation[]

    const truncatedChunks = this.chunkCollector.deduplicateAndTruncate(
      finalChunks,
      tokenBudget.maxChunkTokens
    )

    return {
      entities: truncatedEntities,
      relations: truncatedRelations,
      chunks: this.scoredChunksToRetrieval(truncatedChunks),
      meta: this.buildMeta(
        params.mode,
        keywords,
        truncatedEntities,
        truncatedRelations,
        truncatedChunks,
        rerankApplied
      )
    }
  }

  // ==========================================================================
  // Global 模式（关系中心）
  // ==========================================================================

  private async globalSearch(
    params: KGRetrievalParams,
    embeddingConfig: EmbeddingCallConfig,
    vsConfig: VectorSearchConfig,
    gtConfig: GraphTraversalConfig,
    tokenBudget: TokenBudgetConfig,
    tableNames: ReturnType<typeof getKgTableNames>
  ): Promise<KGRetrievalResult> {
    const { targetNamespace, targetDatabase } = params

    // 1. 关键词提取（高层级关键词）
    const keywords = await this.extractKeywords(params)

    // 2. 关键词向量化
    const keywordsToEmbed = keywords.highLevel.length > 0 ? keywords.highLevel : [params.query]
    const keywordVectors = await this.vectorSearch.embedKeywords(keywordsToEmbed, embeddingConfig)

    if (keywordVectors.length === 0) {
      const queryVector = await this.vectorSearch.embedText(params.query, embeddingConfig)
      keywordVectors.push({ keyword: params.query, vector: queryVector })
    }

    // 3. 关系向量搜索
    const relationHits = await this.vectorSearch.searchRelationsByKeywords({
      namespace: targetNamespace,
      database: targetDatabase,
      tableName: tableNames.relates,
      keywordVectors,
      topK: vsConfig.relationTopK,
      ef: vsConfig.ef
    })

    log(`Global: ${relationHits.length} seed relations found`)

    if (relationHits.length === 0) {
      return this.emptyResult(params.mode, keywords)
    }

    // 4. 图扩展（从关系出发）
    const expansion = await this.graphTraversal.expandFromRelations({
      namespace: targetNamespace,
      database: targetDatabase,
      entityTableName: tableNames.entity,
      relatesTableName: tableNames.relates,
      entityChunksTableName: tableNames.entityChunks,
      relationChunksTableName: tableNames.relationChunks,
      seedRelationIds: relationHits.map((r) => r.id)
    })

    // 5. 收集 chunks
    const chunkTableName = this.resolveChunkTableName(params)
    const scoredChunks = await this.collectAndScoreChunks(
      targetNamespace,
      targetDatabase,
      chunkTableName,
      expansion.chunkIds,
      'relation_expansion'
    )

    // 6. 重排（可选）
    const { chunks: finalChunks, rerankApplied } = await this.maybeRerank(params, scoredChunks)

    // 7. Token 截断
    const truncatedEntities = this.chunkCollector.truncateDescriptions(
      this.expandedEntitiesToRetrieval(expansion.entities),
      tokenBudget.maxEntityDescTokens
    ) as KGRetrievalEntity[]

    const truncatedRelations = this.chunkCollector.truncateDescriptions(
      this.relationHitsToRetrievalRelations(relationHits),
      tokenBudget.maxRelationDescTokens
    ) as KGRetrievalRelation[]

    const truncatedChunks = this.chunkCollector.deduplicateAndTruncate(
      finalChunks,
      tokenBudget.maxChunkTokens
    )

    return {
      entities: truncatedEntities,
      relations: truncatedRelations,
      chunks: this.scoredChunksToRetrieval(truncatedChunks),
      meta: this.buildMeta(
        params.mode,
        keywords,
        truncatedEntities,
        truncatedRelations,
        truncatedChunks,
        rerankApplied
      )
    }
  }

  // ==========================================================================
  // Hybrid 模式（local + global 合并）
  // ==========================================================================

  private async hybridSearch(
    params: KGRetrievalParams,
    embeddingConfig: EmbeddingCallConfig,
    vsConfig: VectorSearchConfig,
    gtConfig: GraphTraversalConfig,
    tokenBudget: TokenBudgetConfig,
    tableNames: ReturnType<typeof getKgTableNames>
  ): Promise<KGRetrievalResult> {
    const { targetNamespace, targetDatabase } = params

    // 1. 关键词提取（两种都要）
    const keywords = await this.extractKeywords(params)

    // 2. 向量化全部关键词
    const lowKeywords = keywords.lowLevel.length > 0 ? keywords.lowLevel : [params.query]
    const highKeywords = keywords.highLevel.length > 0 ? keywords.highLevel : [params.query]

    const lowVectors = await this.vectorSearch.embedKeywords(lowKeywords, embeddingConfig)
    const highVectors = await this.vectorSearch.embedKeywords(highKeywords, embeddingConfig)

    // fallback
    if (lowVectors.length === 0 || highVectors.length === 0) {
      const queryVector = await this.vectorSearch.embedText(params.query, embeddingConfig)
      if (lowVectors.length === 0) lowVectors.push({ keyword: params.query, vector: queryVector })
      if (highVectors.length === 0) highVectors.push({ keyword: params.query, vector: queryVector })
    }

    // 3. 并行：实体搜索 + 关系搜索
    const [entityHits, relationHits] = await Promise.all([
      this.vectorSearch.searchEntitiesByKeywords({
        namespace: targetNamespace,
        database: targetDatabase,
        tableName: tableNames.entity,
        keywordVectors: lowVectors,
        topK: vsConfig.entityTopK,
        ef: vsConfig.ef
      }),
      this.vectorSearch.searchRelationsByKeywords({
        namespace: targetNamespace,
        database: targetDatabase,
        tableName: tableNames.relates,
        keywordVectors: highVectors,
        topK: vsConfig.relationTopK,
        ef: vsConfig.ef
      })
    ])

    log(`Hybrid: ${entityHits.length} entities + ${relationHits.length} relations`)

    // 4. 并行：图扩展
    const [entityExpansion, relationExpansion] = await Promise.all([
      entityHits.length > 0
        ? this.graphTraversal.expandFromEntities({
            namespace: targetNamespace,
            database: targetDatabase,
            entityTableName: tableNames.entity,
            relatesTableName: tableNames.relates,
            entityChunksTableName: tableNames.entityChunks,
            relationChunksTableName: tableNames.relationChunks,
            seedEntityIds: entityHits.map((e) => e.id),
            maxDepth: gtConfig.maxDepth,
            maxNeighbors: gtConfig.maxNeighbors
          })
        : { entities: [], relations: [], chunkIds: new Set<string>() },
      relationHits.length > 0
        ? this.graphTraversal.expandFromRelations({
            namespace: targetNamespace,
            database: targetDatabase,
            entityTableName: tableNames.entity,
            relatesTableName: tableNames.relates,
            entityChunksTableName: tableNames.entityChunks,
            relationChunksTableName: tableNames.relationChunks,
            seedRelationIds: relationHits.map((r) => r.id)
          })
        : { entities: [], relations: [], chunkIds: new Set<string>() }
    ])

    // 5. 合并 chunk IDs
    const mergedChunkIds = new Set<string>()
    for (const cid of entityExpansion.chunkIds) mergedChunkIds.add(cid)
    for (const cid of relationExpansion.chunkIds) mergedChunkIds.add(cid)

    // 6. 收集 chunks
    const chunkTableName = this.resolveChunkTableName(params)

    // 分别收集并标记来源
    const entityChunks = await this.collectAndScoreChunks(
      targetNamespace,
      targetDatabase,
      chunkTableName,
      entityExpansion.chunkIds,
      'entity_expansion'
    )
    const relationChunks = await this.collectAndScoreChunks(
      targetNamespace,
      targetDatabase,
      chunkTableName,
      relationExpansion.chunkIds,
      'relation_expansion'
    )

    // 合并
    const allChunks = [...entityChunks, ...relationChunks]

    // 7. 重排（可选）
    const { chunks: finalChunks, rerankApplied } = await this.maybeRerank(params, allChunks)

    // 8. 合并实体和关系（去重）
    const entityMap = new Map<string, KGRetrievalEntity>()
    for (const e of this.entityHitsToRetrievalEntities(entityHits)) entityMap.set(e.id, e)
    for (const e of this.expandedEntitiesToRetrieval(entityExpansion.entities)) {
      if (!entityMap.has(e.id)) entityMap.set(e.id, e)
    }
    for (const e of this.expandedEntitiesToRetrieval(relationExpansion.entities)) {
      if (!entityMap.has(e.id)) entityMap.set(e.id, e)
    }

    const relationMap = new Map<string, KGRetrievalRelation>()
    for (const r of this.relationHitsToRetrievalRelations(relationHits)) relationMap.set(r.id, r)
    for (const r of this.expandedRelationsToRetrieval(entityExpansion.relations, entityHits)) {
      if (!relationMap.has(r.id)) relationMap.set(r.id, r)
    }
    for (const r of this.expandedRelationsToRetrieval(relationExpansion.relations, entityHits)) {
      if (!relationMap.has(r.id)) relationMap.set(r.id, r)
    }

    // 9. Token 截断
    const truncatedEntities = this.chunkCollector.truncateDescriptions(
      Array.from(entityMap.values()),
      tokenBudget.maxEntityDescTokens
    ) as KGRetrievalEntity[]

    const truncatedRelations = this.chunkCollector.truncateDescriptions(
      Array.from(relationMap.values()),
      tokenBudget.maxRelationDescTokens
    ) as KGRetrievalRelation[]

    const truncatedChunks = this.chunkCollector.deduplicateAndTruncate(
      finalChunks,
      tokenBudget.maxChunkTokens
    )

    return {
      entities: truncatedEntities,
      relations: truncatedRelations,
      chunks: this.scoredChunksToRetrieval(truncatedChunks),
      meta: this.buildMeta(
        params.mode,
        keywords,
        truncatedEntities,
        truncatedRelations,
        truncatedChunks,
        rerankApplied
      )
    }
  }

  // ==========================================================================
  // Naive 模式（直接 chunk 向量搜索）
  // ==========================================================================

  private async naiveSearch(
    params: KGRetrievalParams,
    embeddingConfig: EmbeddingCallConfig,
    vsConfig: VectorSearchConfig,
    tokenBudget: TokenBudgetConfig
  ): Promise<KGRetrievalResult> {
    const { targetNamespace, targetDatabase } = params

    const chunkTableName = params.chunkTableName
    if (!chunkTableName) {
      throw new Error('Naive mode requires chunkTableName')
    }

    // 1. 查询文本向量化
    const queryVector = await this.vectorSearch.embedText(params.query, embeddingConfig)

    // 2. Chunk 向量搜索
    const chunkHits = await this.vectorSearch.searchChunks({
      namespace: targetNamespace,
      database: targetDatabase,
      tableName: chunkTableName,
      queryVector,
      topK: vsConfig.chunkTopK,
      ef: vsConfig.ef
    })

    log(`Naive: ${chunkHits.length} chunk hits`)

    // 3. 转换为 ScoredChunk
    const scoredChunks: ScoredChunk[] = chunkHits.map((h) => ({
      id: h.id,
      content: h.content,
      file_key: h.file_key ?? '',
      file_name: h.file_name,
      chunk_index: h.chunk_index,
      score: h.distance > 0 ? 1 / h.distance : 1,
      source: 'direct_vector' as const
    }))

    // 4. 重排（可选）
    const { chunks: finalChunks, rerankApplied } = await this.maybeRerank(params, scoredChunks)

    // 5. Token 截断
    const truncatedChunks = this.chunkCollector.deduplicateAndTruncate(
      finalChunks,
      tokenBudget.maxChunkTokens
    )

    const keywords: ExtractedKeywords = { highLevel: [], lowLevel: [] }

    return {
      entities: [],
      relations: [],
      chunks: this.scoredChunksToRetrieval(truncatedChunks),
      meta: this.buildMeta(params.mode, keywords, [], [], truncatedChunks, rerankApplied)
    }
  }

  // ==========================================================================
  // 公共步骤
  // ==========================================================================

  /**
   * 提取关键词
   */
  private async extractKeywords(params: KGRetrievalParams): Promise<ExtractedKeywords> {
    const kw = params.keywordExtraction

    if (!kw || !kw.useLLM) {
      // 手动模式或未配置
      return this.keywordExtractor.extract({
        query: params.query,
        useLLM: false,
        manualHighLevel: kw?.manualHighLevelKeywords,
        manualLowLevel: kw?.manualLowLevelKeywords
      })
    }

    return this.keywordExtractor.extract({
      query: params.query,
      useLLM: true,
      llmProviderId: kw.llmProviderId,
      llmModelId: kw.llmModelId
    })
  }

  /**
   * 收集并评分 chunks
   */
  private async collectAndScoreChunks(
    namespace: string,
    database: string,
    chunkTableName: string | null,
    chunkIds: Set<string>,
    source: ScoredChunk['source']
  ): Promise<ScoredChunk[]> {
    if (chunkIds.size === 0 || !chunkTableName) return []

    const rawChunks = await this.chunkCollector.fetchChunksByIds({
      namespace,
      database,
      chunkTableName,
      chunkIds: Array.from(chunkIds)
    })

    // 给图扩展来的 chunks 一个基础分数（无向量距离信息，统一给 1.0）
    return this.chunkCollector.toScoredChunks(rawChunks, 1.0, source)
  }

  /**
   * 可选重排
   */
  private async maybeRerank(
    params: KGRetrievalParams,
    chunks: ScoredChunk[]
  ): Promise<{ chunks: ScoredChunk[]; rerankApplied: boolean }> {
    const rerankConfig = params.rerank

    if (
      !rerankConfig?.enabled ||
      !rerankConfig.baseUrl ||
      !rerankConfig.apiKey ||
      !rerankConfig.modelId
    ) {
      return { chunks, rerankApplied: false }
    }

    if (chunks.length === 0) {
      return { chunks, rerankApplied: false }
    }

    const config: RerankCallConfig = {
      baseUrl: rerankConfig.baseUrl,
      apiKey: rerankConfig.apiKey,
      model: rerankConfig.modelId,
      topN: rerankConfig.topN ?? chunks.length,
      headers: rerankConfig.headers
    }

    try {
      const documents = chunks.map((c) => c.content)
      const rerankResults = await this.rerankClient.rerank(config, params.query, documents)

      // 按 relevance_score 重新映射回 ScoredChunk
      const rerankedChunks: ScoredChunk[] = rerankResults
        .filter((r) => r.index >= 0 && r.index < chunks.length)
        .map((r) => ({
          ...chunks[r.index],
          score: r.relevance_score
        }))

      log(`Rerank applied: ${chunks.length} → ${rerankedChunks.length} chunks`)
      return { chunks: rerankedChunks, rerankApplied: true }
    } catch (error) {
      logError('Rerank failed, returning original order', error)
      return { chunks, rerankApplied: false }
    }
  }

  // ==========================================================================
  // 参数解析
  // ==========================================================================

  private validateParams(params: KGRetrievalParams): void {
    if (!params.query?.trim()) {
      throw new Error('query is required')
    }
    if (!params.targetNamespace || !params.targetDatabase || !params.graphTableBase) {
      throw new Error('targetNamespace, targetDatabase, graphTableBase are required')
    }
    if (
      !params.embeddingConfig?.baseUrl ||
      !params.embeddingConfig?.apiKey ||
      !params.embeddingConfig?.modelId
    ) {
      throw new Error('embeddingConfig (baseUrl, apiKey, modelId) is required')
    }
    if (params.mode === 'naive' && !params.chunkTableName) {
      throw new Error('chunkTableName is required for naive mode')
    }
  }

  private resolveEmbeddingConfig(params: KGRetrievalParams): EmbeddingCallConfig {
    const ec = params.embeddingConfig
    return {
      baseUrl: ec.baseUrl,
      apiKey: ec.apiKey,
      model: ec.modelId,
      dimensions: ec.dimensions,
      headers: ec.headers
    }
  }

  private resolveVectorSearchConfig(params: KGRetrievalParams): VectorSearchConfig {
    const vs = params.vectorSearch
    return {
      entityTopK: vs?.entityTopK ?? DEFAULT_VECTOR_SEARCH.entityTopK,
      relationTopK: vs?.relationTopK ?? DEFAULT_VECTOR_SEARCH.relationTopK,
      chunkTopK: vs?.chunkTopK ?? DEFAULT_VECTOR_SEARCH.chunkTopK,
      ef: vs?.ef ?? DEFAULT_VECTOR_SEARCH.ef
    }
  }

  private resolveGraphTraversalConfig(params: KGRetrievalParams): GraphTraversalConfig {
    const gt = params.graphTraversal
    return {
      maxDepth: gt?.maxDepth ?? DEFAULT_GRAPH_TRAVERSAL.maxDepth,
      maxNeighbors: gt?.maxNeighbors ?? DEFAULT_GRAPH_TRAVERSAL.maxNeighbors
    }
  }

  private resolveTokenBudget(params: KGRetrievalParams): TokenBudgetConfig {
    const tb = params.tokenBudget
    return {
      maxEntityDescTokens: tb?.maxEntityDescTokens ?? DEFAULT_TOKEN_BUDGET.maxEntityDescTokens,
      maxRelationDescTokens:
        tb?.maxRelationDescTokens ?? DEFAULT_TOKEN_BUDGET.maxRelationDescTokens,
      maxChunkTokens: tb?.maxChunkTokens ?? DEFAULT_TOKEN_BUDGET.maxChunkTokens,
      maxTotalTokens: tb?.maxTotalTokens ?? DEFAULT_TOKEN_BUDGET.maxTotalTokens
    }
  }

  /**
   * 从 params 推断 chunk 向量表名
   * naive 模式直接使用 chunkTableName，其他模式从 graphTableBase 推导
   */
  private resolveChunkTableName(params: KGRetrievalParams): string | null {
    if (params.chunkTableName) {
      return params.chunkTableName
    }
    // 对于 local/global/hybrid 模式，chunk 表名需要从 embeddingConfig 推导
    // 格式: emb_cfg_{safeId}_{dimensions}_chunks
    const ec = params.embeddingConfig
    if (ec.providerId && ec.dimensions) {
      // 使用 embeddingConfig 中的 modelId 或 providerId 来推导
      // 但实际上 chunk 表名依赖于 embedding config ID，这里无法直接推导
      // 作为 fallback，返回 null，由调用方根据实际情况处理
    }
    return null
  }

  // ==========================================================================
  // 类型转换
  // ==========================================================================

  private entityHitsToRetrievalEntities(hits: EntitySearchHit[]): KGRetrievalEntity[] {
    return hits.map((h) => ({
      id: h.id,
      name: h.entity_name,
      entity_type: h.entity_type,
      description: h.description,
      score: h.distance > 0 ? 1 / h.distance : 1
    }))
  }

  private expandedEntitiesToRetrieval(
    entities: Array<{ id: string; entity_name: string; entity_type: string; description: string }>
  ): KGRetrievalEntity[] {
    return entities.map((e) => ({
      id: e.id,
      name: e.entity_name,
      entity_type: e.entity_type,
      description: e.description,
      score: 0 // 扩展来的实体无向量距离分数
    }))
  }

  private relationHitsToRetrievalRelations(hits: RelationSearchHit[]): KGRetrievalRelation[] {
    return hits.map((h) => ({
      id: h.id,
      source_name: h.source_name,
      target_name: h.target_name,
      description: h.description,
      keywords: h.keywords,
      score: h.distance > 0 ? 1 / h.distance : 1
    }))
  }

  private expandedRelationsToRetrieval(
    relations: Array<{
      id: string
      source_name: string
      target_name: string
      keywords: string
      description: string
      weight: number
    }>,
    _entityHits: EntitySearchHit[]
  ): KGRetrievalRelation[] {
    return relations.map((r) => ({
      id: r.id,
      source_name: r.source_name,
      target_name: r.target_name,
      description: r.description,
      keywords: r.keywords,
      score: r.weight
    }))
  }

  private scoredChunksToRetrieval(chunks: ScoredChunk[]): KGRetrievalChunk[] {
    return chunks.map((c) => ({
      id: c.id,
      content: c.content,
      file_key: c.file_key,
      file_name: c.file_name,
      chunk_index: c.chunk_index,
      score: c.score,
      source: c.source
    }))
  }

  // ==========================================================================
  // 构建元数据
  // ==========================================================================

  private buildMeta(
    mode: KGRetrievalParams['mode'],
    keywords: ExtractedKeywords,
    entities: KGRetrievalEntity[],
    relations: KGRetrievalRelation[],
    chunks: ScoredChunk[],
    rerankApplied: boolean
  ): KGRetrievalMeta {
    return {
      mode,
      extractedKeywords: {
        highLevel: keywords.highLevel,
        lowLevel: keywords.lowLevel
      },
      entityCount: entities.length,
      relationCount: relations.length,
      chunkCount: chunks.length,
      durationMs: 0, // 由调用方填充
      rerankApplied
    }
  }

  private emptyResult(
    mode: KGRetrievalParams['mode'],
    keywords: ExtractedKeywords
  ): KGRetrievalResult {
    return {
      entities: [],
      relations: [],
      chunks: [],
      meta: {
        mode,
        extractedKeywords: {
          highLevel: keywords.highLevel,
          lowLevel: keywords.lowLevel
        },
        entityCount: 0,
        relationCount: 0,
        chunkCount: 0,
        durationMs: 0,
        rerankApplied: false
      }
    }
  }
}
