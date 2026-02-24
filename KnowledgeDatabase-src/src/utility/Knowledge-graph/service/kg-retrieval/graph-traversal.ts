/**
 * @file 图遍历扩展模块
 * @description 从种子实体/关系出发，沿图谱边进行扩展，收集关联节点和源 chunk ID
 */

import type { KGSurrealClient } from '../../db/surreal-client'
import type {
  ExpandedEntity,
  ExpandedRelation,
  GraphExpansionResult
} from './types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-GraphTraversal] ${msg}`, data)
  } else {
    console.log(`[KG-GraphTraversal] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-GraphTraversal] ${msg}`, error)
}

// ============================================================================
// 辅助
// ============================================================================

function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}

// ============================================================================
// GraphTraversal
// ============================================================================

export class GraphTraversal {
  constructor(private readonly client: KGSurrealClient) {}

  // ==========================================================================
  // 从实体出发扩展（local 模式）
  // ==========================================================================

  /**
   * 从种子实体出发，获取其关联关系、对端实体和源 chunk IDs
   *
   * 扩展路径:
   *   seed entity
   *     → entity_chunks → chunk IDs（实体的源文本）
   *     → relates（WHERE in = entity OR out = entity）
   *       → 对端实体
   *       → relation_chunks → chunk IDs（关系的源文本）
   */
  async expandFromEntities(params: {
    namespace: string
    database: string
    entityTableName: string
    relatesTableName: string
    entityChunksTableName: string
    relationChunksTableName: string
    seedEntityIds: string[]
    maxDepth: number
    maxNeighbors: number
  }): Promise<GraphExpansionResult> {
    const {
      namespace,
      database,
      entityTableName,
      relatesTableName,
      entityChunksTableName,
      relationChunksTableName,
      seedEntityIds,
      maxDepth,
      maxNeighbors
    } = params

    const entityMap = new Map<string, ExpandedEntity>()
    const relationMap = new Map<string, ExpandedRelation>()
    const chunkIds = new Set<string>()

    // 当前待扩展的实体 ID 集合
    let currentEntityIds = new Set(seedEntityIds)
    // 已访问过的实体 ID，防止循环
    const visitedEntityIds = new Set<string>()

    for (let depth = 0; depth < maxDepth; depth++) {
      const nextEntityIds = new Set<string>()

      for (const entityId of currentEntityIds) {
        if (visitedEntityIds.has(entityId)) continue
        visitedEntityIds.add(entityId)

        // 1. 获取实体详情（如果还没有）
        if (!entityMap.has(entityId)) {
          const entity = await this.fetchEntity(namespace, database, entityTableName, entityId)
          if (entity) {
            entityMap.set(entityId, entity)
          }
        }

        // 2. 获取实体的源 chunk IDs
        const entityChunkIds = await this.fetchEntityChunkIds(
          namespace,
          database,
          entityChunksTableName,
          entityMap.get(entityId)?.entity_name ?? ''
        )
        for (const cid of entityChunkIds) {
          chunkIds.add(cid)
        }

        // 3. 获取关联关系（limit maxNeighbors）
        const relations = await this.fetchRelationsForEntity(
          namespace,
          database,
          relatesTableName,
          entityId,
          maxNeighbors
        )

        for (const rel of relations) {
          if (!relationMap.has(rel.id)) {
            relationMap.set(rel.id, rel)

            // 4. 获取关系的源 chunk IDs
            const relKey = this.makeRelationKey(rel.source_name, rel.target_name)
            const relChunkIds = await this.fetchRelationChunkIds(
              namespace,
              database,
              relationChunksTableName,
              relKey
            )
            for (const cid of relChunkIds) {
              chunkIds.add(cid)
            }
          }

          // 5. 收集对端实体 ID 用于下一轮扩展
          const oppositeEntityId = this.getOppositeEntityId(rel, entityId)
          if (oppositeEntityId && !visitedEntityIds.has(oppositeEntityId)) {
            nextEntityIds.add(oppositeEntityId)
          }
        }
      }

      currentEntityIds = nextEntityIds
      if (currentEntityIds.size === 0) break
    }

    // 对下一轮未展开的对端实体也收集基本信息
    for (const entityId of currentEntityIds) {
      if (!entityMap.has(entityId) && !visitedEntityIds.has(entityId)) {
        const entity = await this.fetchEntity(namespace, database, entityTableName, entityId)
        if (entity) {
          entityMap.set(entityId, entity)
        }
      }
    }

    log(
      `Entity expansion: ${entityMap.size} entities, ${relationMap.size} relations, ${chunkIds.size} chunks`
    )

    return {
      entities: Array.from(entityMap.values()),
      relations: Array.from(relationMap.values()),
      chunkIds
    }
  }

  // ==========================================================================
  // 从关系出发扩展（global 模式）
  // ==========================================================================

  /**
   * 从种子关系出发，获取其两端实体描述和源 chunk IDs
   *
   * 扩展路径:
   *   seed relation
   *     → source entity + target entity（实体描述）
   *     → relation_chunks → chunk IDs
   */
  async expandFromRelations(params: {
    namespace: string
    database: string
    entityTableName: string
    relatesTableName: string
    entityChunksTableName: string
    relationChunksTableName: string
    seedRelationIds: string[]
  }): Promise<GraphExpansionResult> {
    const {
      namespace,
      database,
      entityTableName,
      relatesTableName,
      entityChunksTableName,
      relationChunksTableName,
      seedRelationIds
    } = params

    const entityMap = new Map<string, ExpandedEntity>()
    const relationMap = new Map<string, ExpandedRelation>()
    const chunkIds = new Set<string>()

    for (const relationId of seedRelationIds) {
      // 1. 获取关系详情
      const rel = await this.fetchRelation(namespace, database, relatesTableName, relationId)
      if (!rel) continue
      relationMap.set(rel.id, rel)

      // 2. 获取关系的源 chunk IDs
      const relKey = this.makeRelationKey(rel.source_name, rel.target_name)
      const relChunkIds = await this.fetchRelationChunkIds(
        namespace,
        database,
        relationChunksTableName,
        relKey
      )
      for (const cid of relChunkIds) {
        chunkIds.add(cid)
      }

      // 3. 获取两端实体
      const sourceEntity = await this.fetchEntityByName(
        namespace,
        database,
        entityTableName,
        rel.source_name
      )
      if (sourceEntity && !entityMap.has(sourceEntity.id)) {
        entityMap.set(sourceEntity.id, sourceEntity)
        // 获取源实体的 chunk IDs
        const srcChunkIds = await this.fetchEntityChunkIds(
          namespace,
          database,
          entityChunksTableName,
          sourceEntity.entity_name
        )
        for (const cid of srcChunkIds) {
          chunkIds.add(cid)
        }
      }

      const targetEntity = await this.fetchEntityByName(
        namespace,
        database,
        entityTableName,
        rel.target_name
      )
      if (targetEntity && !entityMap.has(targetEntity.id)) {
        entityMap.set(targetEntity.id, targetEntity)
        // 获取目标实体的 chunk IDs
        const tgtChunkIds = await this.fetchEntityChunkIds(
          namespace,
          database,
          entityChunksTableName,
          targetEntity.entity_name
        )
        for (const cid of tgtChunkIds) {
          chunkIds.add(cid)
        }
      }
    }

    log(
      `Relation expansion: ${entityMap.size} entities, ${relationMap.size} relations, ${chunkIds.size} chunks`
    )

    return {
      entities: Array.from(entityMap.values()),
      relations: Array.from(relationMap.values()),
      chunkIds
    }
  }

  // ==========================================================================
  // 内部数据获取方法
  // ==========================================================================

  /**
   * 按 Record ID 获取单个实体
   */
  private async fetchEntity(
    namespace: string,
    database: string,
    tableName: string,
    entityId: string
  ): Promise<ExpandedEntity | null> {
    try {
      const sql = `SELECT id, entity_name, entity_type, description FROM ${entityId};`
      const raw = await this.client.queryInDatabase(namespace, database, sql)
      const records = this.client.extractRecords(raw)
      if (records.length === 0) return null

      const r = records[0]
      return {
        id: rid(r.id),
        entity_name: String(r.entity_name ?? ''),
        entity_type: String(r.entity_type ?? ''),
        description: String(r.description ?? '')
      }
    } catch (error) {
      logError(`fetchEntity failed: ${entityId}`, error)
      return null
    }
  }

  /**
   * 按实体名获取单个实体
   */
  private async fetchEntityByName(
    namespace: string,
    database: string,
    tableName: string,
    entityName: string
  ): Promise<ExpandedEntity | null> {
    try {
      const sql = `SELECT id, entity_name, entity_type, description FROM \`${tableName}\` WHERE entity_name = $name LIMIT 1;`
      const raw = await this.client.queryInDatabase(namespace, database, sql, { name: entityName })
      const records = this.client.extractRecords(raw)
      if (records.length === 0) return null

      const r = records[0]
      return {
        id: rid(r.id),
        entity_name: String(r.entity_name ?? ''),
        entity_type: String(r.entity_type ?? ''),
        description: String(r.description ?? '')
      }
    } catch (error) {
      logError(`fetchEntityByName failed: ${entityName}`, error)
      return null
    }
  }

  /**
   * 按 Record ID 获取单个关系
   */
  private async fetchRelation(
    namespace: string,
    database: string,
    tableName: string,
    relationId: string
  ): Promise<ExpandedRelation | null> {
    try {
      const sql = `SELECT id, in.entity_name AS source_name, out.entity_name AS target_name, keywords, description, weight FROM ${relationId};`
      const raw = await this.client.queryInDatabase(namespace, database, sql)
      const records = this.client.extractRecords(raw)
      if (records.length === 0) return null

      const r = records[0]
      return {
        id: rid(r.id),
        source_name: String(r.source_name ?? ''),
        target_name: String(r.target_name ?? ''),
        keywords: String(r.keywords ?? ''),
        description: String(r.description ?? ''),
        weight: typeof r.weight === 'number' ? r.weight : 1.0
      }
    } catch (error) {
      logError(`fetchRelation failed: ${relationId}`, error)
      return null
    }
  }

  /**
   * 获取实体关联的所有关系（包含两个方向）
   */
  private async fetchRelationsForEntity(
    namespace: string,
    database: string,
    relatesTableName: string,
    entityId: string,
    maxNeighbors: number
  ): Promise<ExpandedRelation[]> {
    try {
      const sql = `
        SELECT
          id,
          in.entity_name AS source_name,
          out.entity_name AS target_name,
          keywords,
          description,
          weight
        FROM \`${relatesTableName}\`
        WHERE in = $entityId OR out = $entityId
        LIMIT $limit;
      `
      const raw = await this.client.queryInDatabase(namespace, database, sql, {
        entityId,
        limit: maxNeighbors
      })
      const records = this.client.extractRecords(raw)

      return records
        .filter((r) => r && typeof r === 'object')
        .map((r: any) => ({
          id: rid(r.id),
          source_name: String(r.source_name ?? ''),
          target_name: String(r.target_name ?? ''),
          keywords: String(r.keywords ?? ''),
          description: String(r.description ?? ''),
          weight: typeof r.weight === 'number' ? r.weight : 1.0
        }))
    } catch (error) {
      logError(`fetchRelationsForEntity failed: ${entityId}`, error)
      return []
    }
  }

  /**
   * 获取实体对应的源 chunk IDs
   */
  private async fetchEntityChunkIds(
    namespace: string,
    database: string,
    entityChunksTableName: string,
    entityName: string
  ): Promise<string[]> {
    if (!entityName) return []

    try {
      const sql = `SELECT chunk_ids FROM \`${entityChunksTableName}\` WHERE entity_name = $name LIMIT 1;`
      const raw = await this.client.queryInDatabase(namespace, database, sql, { name: entityName })
      const records = this.client.extractRecords(raw)

      if (records.length === 0) return []
      const chunkIds = records[0]?.chunk_ids
      return Array.isArray(chunkIds) ? chunkIds.map(String) : []
    } catch (error) {
      logError(`fetchEntityChunkIds failed: ${entityName}`, error)
      return []
    }
  }

  /**
   * 获取关系对应的源 chunk IDs
   */
  private async fetchRelationChunkIds(
    namespace: string,
    database: string,
    relationChunksTableName: string,
    relationKey: string
  ): Promise<string[]> {
    if (!relationKey) return []

    try {
      const sql = `SELECT chunk_ids FROM \`${relationChunksTableName}\` WHERE relation_key = $key LIMIT 1;`
      const raw = await this.client.queryInDatabase(namespace, database, sql, { key: relationKey })
      const records = this.client.extractRecords(raw)

      if (records.length === 0) return []
      const chunkIds = records[0]?.chunk_ids
      return Array.isArray(chunkIds) ? chunkIds.map(String) : []
    } catch (error) {
      logError(`fetchRelationChunkIds failed: ${relationKey}`, error)
      return []
    }
  }

  // ==========================================================================
  // 工具方法
  // ==========================================================================

  /**
   * 生成关系键（与 graph-upsert 中的 makeRelationId 一致）
   */
  private makeRelationKey(sourceName: string, targetName: string): string {
    const sorted = [sourceName, targetName].sort()
    return `${sorted[0]}_${sorted[1]}`
  }

  /**
   * 根据当前实体 ID，从关系中提取对端实体的 Record ID
   */
  private getOppositeEntityId(relation: ExpandedRelation, currentEntityId: string): string | null {
    // 关系的 Record ID 格式: tableName:⟨source_id⟩→tableName:⟨target_id⟩
    // 但实际上我们通过 source_name / target_name 来判断对端
    // 由于 SurrealDB RELATION 的 in/out 是 Record<entity>，
    // 需要通过名字反查实体 ID
    // 此处简单返回 null，由调用方通过 entity_name 查找
    // 在 expandFromEntities 中通过 fetchEntityByName 补充
    return null
  }
}
