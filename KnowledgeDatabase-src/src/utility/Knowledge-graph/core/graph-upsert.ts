/**
 * @file 图谱数据 Upsert
 * @description 将解析后的 entities 和 relations 批量 upsert 到目标知识库
 */

import type { KGSurrealClient } from '../db/surreal-client'
import type { ParsedEntity, ParsedRelation } from './response-parser'
import { makeRelationId } from './response-parser'

export interface UpsertResult {
  entitiesUpserted: number
  relationsUpserted: number
}

/**
 * 将解析后的 entities 和 relations 批量 upsert 到目标知识库
 *
 * @param client - SurrealDB 客户端
 * @param namespace - 目标 namespace
 * @param database - 目标 database
 * @param tableNames - 图谱表名 { entity, relates, entityChunks, relationChunks }
 * @param entities - 解析后的实体列表
 * @param relations - 解析后的关系列表
 * @param chunkId - 来源 chunk 标识（用于 source_ids 溯源）
 * @param fileKey - 来源文件标识
 */
export async function upsertGraphData(
  client: KGSurrealClient,
  namespace: string,
  database: string,
  tableNames: { entity: string; relates: string; entityChunks: string; relationChunks: string },
  entities: ParsedEntity[],
  relations: ParsedRelation[],
  chunkId: string,
  fileKey: string
): Promise<UpsertResult> {
  let entitiesUpserted = 0
  let relationsUpserted = 0
  const SQL_BATCH_SIZE = 30

  const statements: string[] = []
  const params: Record<string, any> = {}

  // ---- Entity UPSERT ----
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    const p = `e${i}`
    statements.push(`
      UPSERT ${tableNames.entity}:\u27E8${e.sanitizedName}\u27E9 SET
        entity_name = $${p}_name,
        entity_type = $${p}_type,
        description = IF description IS NONE OR description = ''
          THEN $${p}_desc
          ELSE string::concat(description, '\n---\n', $${p}_desc)
        END,
        source_ids = IF source_ids IS NONE
          THEN [$${p}_chunk]
          ELSE array::union(source_ids, [$${p}_chunk])
        END,
        file_keys = IF file_keys IS NONE
          THEN [$${p}_fk]
          ELSE array::union(file_keys, [$${p}_fk])
        END,
        embedding = NONE,
        embedding_hash = '';
    `)
    params[`${p}_name`] = e.name
    params[`${p}_type`] = e.type
    params[`${p}_desc`] = e.description
    params[`${p}_chunk`] = chunkId
    params[`${p}_fk`] = fileKey
  }

  // ---- Entity Chunks 映射 ----
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    statements.push(`
      UPSERT ${tableNames.entityChunks}:\u27E8${e.sanitizedName}\u27E9 SET
        entity_name = $e${i}_name,
        chunk_ids = IF chunk_ids IS NONE
          THEN [$e${i}_chunk]
          ELSE array::union(chunk_ids, [$e${i}_chunk])
        END;
    `)
  }

  // ---- Relation RELATE ----
  for (let i = 0; i < relations.length; i++) {
    const r = relations[i]
    const relId = makeRelationId(r.srcSanitized, r.tgtSanitized)
    const p = `r${i}`
    // RELATE 方向必须与 makeRelationId 的排序一致，否则不同 chunk 对同一关系的方向不同会导致 in/out 冲突
    const sorted = [r.srcSanitized, r.tgtSanitized].sort()
    statements.push(`
      RELATE ${tableNames.entity}:\u27E8${sorted[0]}\u27E9 -> ${tableNames.relates}:\u27E8${relId}\u27E9 -> ${tableNames.entity}:\u27E8${sorted[1]}\u27E9 SET
        keywords = $${p}_kw,
        description = IF description IS NONE OR description = ''
          THEN $${p}_desc
          ELSE string::concat(description, '\n---\n', $${p}_desc)
        END,
        source_ids = IF source_ids IS NONE
          THEN [$${p}_chunk]
          ELSE array::union(source_ids, [$${p}_chunk])
        END,
        file_keys = IF file_keys IS NONE
          THEN [$${p}_fk]
          ELSE array::union(file_keys, [$${p}_fk])
        END;
    `)
    params[`${p}_kw`] = r.keywords
    params[`${p}_desc`] = r.description
    params[`${p}_chunk`] = chunkId
    params[`${p}_fk`] = fileKey
  }

  // ---- Relation Chunks 映射 ----
  for (let i = 0; i < relations.length; i++) {
    const r = relations[i]
    const relId = makeRelationId(r.srcSanitized, r.tgtSanitized)
    statements.push(`
      UPSERT ${tableNames.relationChunks}:\u27E8${relId}\u27E9 SET
        relation_key = $r${i}_relkey,
        chunk_ids = IF chunk_ids IS NONE
          THEN [$r${i}_chunk]
          ELSE array::union(chunk_ids, [$r${i}_chunk])
        END;
    `)
    params[`r${i}_relkey`] = `${r.srcSanitized}::${r.tgtSanitized}`
  }

  // 在目标库中执行所有语句
  if (statements.length > 0) {
    for (let i = 0; i < statements.length; i += SQL_BATCH_SIZE) {
      const sql = statements.slice(i, i + SQL_BATCH_SIZE).join('\n')
      await client.queryInDatabase(namespace, database, sql, params)
    }
    entitiesUpserted = entities.length
    relationsUpserted = relations.length
  }

  return { entitiesUpserted, relationsUpserted }
}
