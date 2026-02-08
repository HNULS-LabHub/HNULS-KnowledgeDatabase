/**
 * @file SharedUtils 统一导出
 * @description 跨进程共享的工具类和方法
 */

// SurrealDB 查询服务
export {
  SurrealDBQueryService,
  DatabaseOperationError,
  DatabaseConnectionError,
  QuerySyntaxError,
  RecordNotFoundError,
  parseSurrealDBError
} from './surrealdb-query'

export type { SurrealDBConfig, SurrealDBLogger } from './surrealdb-query'
