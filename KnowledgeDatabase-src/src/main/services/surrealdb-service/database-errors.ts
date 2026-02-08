/**
 * 数据库操作错误类（Main Process）
 *
 * 说明：错误类型统一从 SharedUtils 导入，避免出现两套 Error class 导致 instanceof 失效。
 */

import {
  DatabaseOperationError,
  DatabaseConnectionError,
  QuerySyntaxError,
  RecordNotFoundError,
  parseSurrealDBError
} from '@shared-utils/surrealdb-query'

export {
  DatabaseOperationError,
  DatabaseConnectionError,
  QuerySyntaxError,
  RecordNotFoundError,
  parseSurrealDBError
}

/**
 * 约束违反错误
 */
export class ConstraintViolationError extends DatabaseOperationError {
  constructor(
    message: string,
    operation: string,
    table: string,
    params: any,
    originalError: unknown
  ) {
    super(message, operation, table, params, originalError)
    this.name = 'ConstraintViolationError'
  }
}

/**
 * 判断是否为数据库错误
 */
export function isDatabaseError(error: unknown): error is DatabaseOperationError {
  return error instanceof DatabaseOperationError
}
