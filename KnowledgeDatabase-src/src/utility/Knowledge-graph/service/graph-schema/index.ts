/**
 * @file 图谱表 Schema 服务
 * @description 在目标知识库中创建 KG 图谱表（entity / relates / entity_chunks / relation_chunks）
 */

import type { KGSurrealClient } from '../../db/surreal-client'

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-GraphSchema] ${msg}`, data)
  } else {
    console.log(`[KG-GraphSchema] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-GraphSchema] ${msg}`, error)
}

/**
 * 根据图谱表基名生成四张表的表名
 */
export function getKgTableNames(graphTableBase: string) {
  return {
    entity: `${graphTableBase}_entity`,
    relates: `${graphTableBase}_relates`,
    entityChunks: `${graphTableBase}_entity_chunks`,
    relationChunks: `${graphTableBase}_relation_chunks`
  }
}

/**
 * 在目标知识库中创建图谱表 Schema
 *
 * @returns 创建的表名列表
 */
export async function createGraphSchema(
  client: KGSurrealClient,
  namespace: string,
  database: string,
  graphTableBase: string
): Promise<string[]> {
  const t = getKgTableNames(graphTableBase)

  const schemaSql = `
-- ============ Entity ============
DEFINE TABLE IF NOT EXISTS ${t.entity} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS entity_name   ON ${t.entity} TYPE string;
DEFINE FIELD IF NOT EXISTS entity_type   ON ${t.entity} TYPE string;
DEFINE FIELD IF NOT EXISTS description   ON ${t.entity} TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS source_ids    ON ${t.entity} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS file_keys     ON ${t.entity} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS meta          ON ${t.entity} FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS created_at    ON ${t.entity} TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at    ON ${t.entity} TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS uniq_entity_name ON ${t.entity} COLUMNS entity_name UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_entity_type  ON ${t.entity} COLUMNS entity_type;

-- ============ Relates (TYPE RELATION) ============
DEFINE TABLE IF NOT EXISTS ${t.relates} TYPE RELATION FROM ${t.entity} TO ${t.entity} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS keywords      ON ${t.relates} TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS description   ON ${t.relates} TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS weight        ON ${t.relates} TYPE float DEFAULT 1.0;
DEFINE FIELD IF NOT EXISTS source_ids    ON ${t.relates} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS file_keys     ON ${t.relates} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS meta          ON ${t.relates} FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS created_at    ON ${t.relates} TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at    ON ${t.relates} TYPE datetime VALUE time::now();

-- ============ Entity Chunks (溯源映射) ============
DEFINE TABLE IF NOT EXISTS ${t.entityChunks} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS entity_name   ON ${t.entityChunks} TYPE string;
DEFINE FIELD IF NOT EXISTS chunk_ids     ON ${t.entityChunks} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS updated_at    ON ${t.entityChunks} TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS uniq_ec_name  ON ${t.entityChunks} COLUMNS entity_name UNIQUE;

-- ============ Relation Chunks (溯源映射) ============
DEFINE TABLE IF NOT EXISTS ${t.relationChunks} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS relation_key  ON ${t.relationChunks} TYPE string;
DEFINE FIELD IF NOT EXISTS chunk_ids     ON ${t.relationChunks} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS updated_at    ON ${t.relationChunks} TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS uniq_rc_key   ON ${t.relationChunks} COLUMNS relation_key UNIQUE;
`

  try {
    log(`Creating graph schema in ${namespace}.${database}`, { graphTableBase })
    await client.queryInDatabase(namespace, database, schemaSql)
    const tables = [t.entity, t.relates, t.entityChunks, t.relationChunks]
    log(`Graph schema created: ${tables.join(', ')}`)
    return tables
  } catch (error) {
    logError(`Failed to create graph schema in ${namespace}.${database}`, error)
    throw error
  }
}
