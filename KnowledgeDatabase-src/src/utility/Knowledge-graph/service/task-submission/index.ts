/**
 * @file 任务提交服务
 * @description 接收主进程提交的参数，从嵌入表拉 chunks，创建任务和暂存分块
 */

import type { KGSurrealClient } from '../../db/surreal-client'
import type { KGSubmitTaskParams } from '@shared/knowledge-graph-ipc.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[KG-TaskSubmission] ${msg}`, data)
  } else {
    console.log(`[KG-TaskSubmission] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[KG-TaskSubmission] ${msg}`, error)
}

/** RecordId 对象或字符串 → "table:id" 字符串 */
function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}

// ============================================================================
// Schema 初始化 SQL
// ============================================================================

const KG_TASK_SCHEMA = `
DEFINE TABLE IF NOT EXISTS kg_task SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS status ON kg_task TYPE string DEFAULT 'pending'
  ASSERT $value IN ['pending', 'progressing', 'completed', 'failed'];
DEFINE FIELD IF NOT EXISTS file_key ON kg_task TYPE string;
DEFINE FIELD IF NOT EXISTS source_namespace ON kg_task TYPE string;
DEFINE FIELD IF NOT EXISTS source_database ON kg_task TYPE string;
DEFINE FIELD IF NOT EXISTS source_table ON kg_task TYPE string;
DEFINE FIELD IF NOT EXISTS chunks_total ON kg_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS chunks_total_origin ON kg_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS chunks_completed ON kg_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS chunks_failed ON kg_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS config ON kg_task FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS created_at ON kg_task TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON kg_task TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS idx_kg_task_status ON kg_task COLUMNS status;
`

const KG_CHUNK_SCHEMA = `
DEFINE TABLE IF NOT EXISTS kg_chunk SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS task_id ON kg_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS chunk_index ON kg_chunk TYPE int;
DEFINE FIELD IF NOT EXISTS content ON kg_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS status ON kg_chunk TYPE string DEFAULT 'pending'
  ASSERT $value IN ['pending', 'progressing', 'completed', 'failed'];
DEFINE FIELD IF NOT EXISTS result ON kg_chunk FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS error ON kg_chunk TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at ON kg_chunk TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON kg_chunk TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS idx_kg_chunk_task ON kg_chunk COLUMNS task_id;
DEFINE INDEX IF NOT EXISTS idx_kg_chunk_status ON kg_chunk COLUMNS status;
DEFINE INDEX IF NOT EXISTS idx_kg_chunk_task_status ON kg_chunk COLUMNS task_id, status;
`

// ============================================================================
// TaskSubmissionService
// ============================================================================

export class TaskSubmissionService {
  private client: KGSurrealClient
  private schemaInitialized = false

  constructor(client: KGSurrealClient) {
    this.client = client
  }

  /**
   * 确保 schema 已初始化
   */
  async ensureSchema(): Promise<void> {
    if (this.schemaInitialized) return

    try {
      log('Initializing kg_task and kg_chunk schemas...')
      await this.client.query(KG_TASK_SCHEMA)
      await this.client.query(KG_CHUNK_SCHEMA)
      this.schemaInitialized = true
      log('Schema initialized successfully')
    } catch (error) {
      logError('Failed to initialize schema', error)
      throw error
    }
  }

  /**
   * 提交任务
   * 1. 从嵌入表按 fileKey 拉 chunks
   * 2. 创建 kg_task 记录
   * 3. 批量创建 kg_chunk 记录
   *
   * @returns { taskId, chunksTotal }
   */
  async submitTask(
    params: KGSubmitTaskParams
  ): Promise<{ taskId: string; chunksTotal: number }> {
    await this.ensureSchema()

    const { fileKey, sourceNamespace, sourceDatabase, sourceTable, config } = params

    // 1. 从嵌入表拉 chunks
    log('Fetching chunks from embedding table', {
      namespace: sourceNamespace,
      database: sourceDatabase,
      table: sourceTable,
      fileKey
    })

    const chunksSql = `
      SELECT chunk_index, content
      FROM ${sourceTable}
      WHERE file_key = $fileKey OR document.file_key = $fileKey
      ORDER BY chunk_index ASC;
    `

    const rawResult = await this.client.queryInDatabase(
      sourceNamespace,
      sourceDatabase,
      chunksSql,
      { fileKey }
    )

    const chunks = this.client.extractRecords(rawResult)

    if (chunks.length === 0) {
      throw new Error(`No chunks found for fileKey="${fileKey}" in ${sourceNamespace}.${sourceDatabase}.${sourceTable}`)
    }

    log(`Fetched ${chunks.length} chunks for fileKey="${fileKey}"`)

    // 2. 创建 kg_task 记录
    const createTaskSql = `
      CREATE kg_task CONTENT {
        status: 'pending',
        file_key: $fileKey,
        source_namespace: $sourceNamespace,
        source_database: $sourceDatabase,
        source_table: $sourceTable,
        chunks_total: $chunksTotal,
        chunks_total_origin: $chunksTotal,
        chunks_completed: 0,
        chunks_failed: 0,
        config: $config
      };
    `

    const taskResult = await this.client.query(createTaskSql, {
      fileKey,
      sourceNamespace,
      sourceDatabase,
      sourceTable,
      chunksTotal: chunks.length,
      config
    })

    const taskRecords = this.client.extractRecords(taskResult)
    if (taskRecords.length === 0) {
      throw new Error('Failed to create kg_task record')
    }

    const taskId = taskRecords[0].id
    const taskIdStr = rid(taskId)
    log(`Created task: ${taskIdStr}`)

    // 3. 批量创建 kg_chunk 记录
    // 分批插入，每批 50 条
    const BATCH_SIZE = 50
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const insertStatements = batch
        .map(
          (chunk: any, batchIdx: number) => `
          CREATE kg_chunk CONTENT {
            task_id: '${taskIdStr}',
            chunk_index: ${chunk.chunk_index ?? i + batchIdx},
            content: $content_${i + batchIdx},
            status: 'pending'
          };`
        )
        .join('\n')

      const batchParams: Record<string, any> = {}
      batch.forEach((chunk: any, batchIdx: number) => {
        batchParams[`content_${i + batchIdx}`] = chunk.content
      })

      await this.client.query(insertStatements, batchParams)
    }

    log(`Created ${chunks.length} chunk records for task ${taskIdStr}`)

    return { taskId: taskIdStr, chunksTotal: chunks.length }
  }
}
