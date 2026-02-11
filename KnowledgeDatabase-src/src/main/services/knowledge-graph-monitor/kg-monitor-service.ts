import { Surreal } from 'surrealdb'
import { logger } from '../logger'
import type {
  KgTaskQueryParams,
  KgTaskQueryResult,
  KgChunkQueryParams,
  KgChunkQueryResult,
  KgTaskRecord,
  KgChunkRecord
} from '../../preload/types/kg-monitor.types'

type DbConfig = {
  serverUrl: string
  username: string
  password: string
  namespace: string
  database: string
}

export class KgMonitorService {
  private db: Surreal
  private config: DbConfig | null = null
  private connected = false
  private connecting: Promise<void> | null = null
  private opChain: Promise<void> = Promise.resolve()

  constructor() {
    this.db = new Surreal()
  }

  setConfig(config: DbConfig): void {
    this.config = config
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) return
    if (this.connecting) return this.connecting
    if (!this.config) {
      throw new Error('KgMonitorService: missing DB config')
    }

    this.connecting = (async () => {
      await this.db.connect(this.config!.serverUrl)
      await this.db.signin({
        username: this.config!.username,
        password: this.config!.password
      })
      await this.db.use({
        namespace: this.config!.namespace,
        database: this.config!.database
      })
      this.connected = true
      logger.info('[KgMonitorService] Connected to SurrealDB', {
        namespace: this.config!.namespace,
        database: this.config!.database
      })
    })()

    return this.connecting
  }

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.opChain.then(fn, fn)
    this.opChain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private async query<T = any>(sql: string, params?: Record<string, any>): Promise<T> {
    await this.ensureConnected()
    return this.runExclusive(async () => this.db.query(sql, params) as T)
  }

  private extractRecords(result: any): any[] {
    if (!result) return []
    if (Array.isArray(result)) {
      if (result.length === 1 && Array.isArray(result[0])) {
        return result[0]
      }
      for (const entry of result) {
        if (Array.isArray(entry?.result)) {
          return entry.result
        }
      }
      if (result.length > 0 && typeof result[0] === 'object' && !Array.isArray(result[0])) {
        return result
      }
      return []
    }
    if (Array.isArray(result?.result)) return result.result
    return []
  }

  private toTimestamp(value: unknown): number {
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const ts = new Date(value).getTime()
      return Number.isFinite(ts) ? ts : 0
    }
    return 0
  }

  async getTasks(params: KgTaskQueryParams): Promise<KgTaskQueryResult> {
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.max(1, params.pageSize ?? 20)
    const offset = (page - 1) * pageSize

    const status = params.status ?? 'all'
    const fileKey = params.fileKey ?? ''

    const sortMap: Record<string, string> = {
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      fileKey: 'file_key',
      status: 'status'
    }
    const sortBy = sortMap[params.sortBy ?? 'updatedAt'] ?? 'updated_at'
    const sortDir = params.sortDir === 'asc' ? 'ASC' : 'DESC'

    const listSql = `
      SELECT
        id,
        file_key,
        status,
        chunks_total,
        chunks_completed,
        chunks_failed,
        created_at,
        updated_at,
        source_namespace,
        source_database,
        source_table,
        error
      FROM kg_task
      WHERE ($status = 'all' OR status = $status)
        AND ($fileKey = '' OR file_key = $fileKey)
      ORDER BY ${sortBy} ${sortDir}
      LIMIT $limit START $offset;
    `

    const countSql = `
      SELECT COUNT() AS total
      FROM kg_task
      WHERE ($status = 'all' OR status = $status)
        AND ($fileKey = '' OR file_key = $fileKey)
      GROUP ALL;
    `

    const [listResult, countResult] = await Promise.all([
      this.query(listSql, { status, fileKey, limit: pageSize, offset }),
      this.query(countSql, { status, fileKey })
    ])

    const list = this.extractRecords(listResult)
    const totalRow = this.extractRecords(countResult)[0]
    const total = Number(totalRow?.total ?? 0)

    const items: KgTaskRecord[] = list.map((row: any) => ({
      taskId: String(row.id),
      fileKey: row.file_key ?? '',
      status: row.status,
      chunksTotal: Number(row.chunks_total ?? 0),
      chunksCompleted: Number(row.chunks_completed ?? 0),
      chunksFailed: Number(row.chunks_failed ?? 0),
      createdAt: this.toTimestamp(row.created_at),
      updatedAt: this.toTimestamp(row.updated_at),
      error: row.error ?? undefined,
      sourceNamespace: row.source_namespace ?? undefined,
      sourceDatabase: row.source_database ?? undefined,
      sourceTable: row.source_table ?? undefined
    }))

    return { items, total }
  }

  async getTaskChunks(params: KgChunkQueryParams): Promise<KgChunkQueryResult> {
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.max(1, params.pageSize ?? 20)
    const offset = (page - 1) * pageSize

    const listSql = `
      SELECT
        task_id,
        chunk_index,
        status,
        error,
        created_at,
        updated_at
      FROM kg_chunk
      WHERE task_id = $taskId
      ORDER BY chunk_index ASC
      LIMIT $limit START $offset;
    `

    const countSql = `
      SELECT COUNT() AS total
      FROM kg_chunk
      WHERE task_id = $taskId
      GROUP ALL;
    `

    const [listResult, countResult] = await Promise.all([
      this.query(listSql, { taskId: params.taskId, limit: pageSize, offset }),
      this.query(countSql, { taskId: params.taskId })
    ])

    const list = this.extractRecords(listResult)
    const totalRow = this.extractRecords(countResult)[0]
    const total = Number(totalRow?.total ?? 0)

    const items: KgChunkRecord[] = list.map((row: any) => ({
      taskId: row.task_id ?? params.taskId,
      chunkIndex: Number(row.chunk_index ?? 0),
      status: row.status,
      error: row.error ?? undefined,
      createdAt: this.toTimestamp(row.created_at),
      updatedAt: this.toTimestamp(row.updated_at)
    }))

    return { items, total }
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const cancelTaskSql = `
      UPDATE kg_task
      SET status = 'failed', updated_at = time::now()
      WHERE id = $taskId AND status = 'pending';
    `
    const cancelChunkSql = `
      UPDATE kg_chunk
      SET status = 'failed', error = 'cancelled by user', updated_at = time::now()
      WHERE task_id = $taskId AND status = 'pending';
    `

    await this.query(cancelTaskSql, { taskId })
    await this.query(cancelChunkSql, { taskId })
    return true
  }

  async retryTask(taskId: string): Promise<boolean> {
    const retryTaskSql = `
      UPDATE kg_task
      SET status = 'pending', chunks_failed = 0, updated_at = time::now()
      WHERE id = $taskId AND status = 'failed';
    `
    const retryChunkSql = `
      UPDATE kg_chunk
      SET status = 'pending', error = NONE, updated_at = time::now()
      WHERE task_id = $taskId AND status = 'failed';
    `

    await this.query(retryTaskSql, { taskId })
    await this.query(retryChunkSql, { taskId })
    return true
  }

  async removeTask(taskId: string): Promise<boolean> {
    const deleteChunksSql = `
      DELETE kg_chunk WHERE task_id = $taskId;
    `
    const deleteTaskSql = `
      DELETE $taskId;
    `

    await this.query(deleteChunksSql, { taskId })
    await this.query(deleteTaskSql, { taskId })
    return true
  }
}
