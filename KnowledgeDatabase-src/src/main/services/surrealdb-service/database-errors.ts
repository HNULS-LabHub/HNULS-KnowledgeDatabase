/**
 * 数据库操作错误类
 * 
 * 提供详细的错误上下文，便于调试和错误处理
 */

/**
 * 数据库操作错误基类
 */
export class DatabaseOperationError extends Error {
  constructor(
    message: string,
    public operation: string,
    public table: string,
    public params: any,
    public originalError: unknown
  ) {
    super(message)
    this.name = 'DatabaseOperationError'
    
    // 保持错误堆栈
    if (originalError instanceof Error && originalError.stack) {
      this.stack = originalError.stack
    }
  }

  /**
   * 获取格式化的错误信息
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      operation: this.operation,
      table: this.table,
      params: this.params,
      originalError: this.originalError instanceof Error 
        ? this.originalError.message 
        : String(this.originalError)
    }
  }
}

/**
 * 连接错误
 */
export class DatabaseConnectionError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

/**
 * 查询语法错误
 */
export class QuerySyntaxError extends DatabaseOperationError {
  constructor(
    message: string,
    sql: string,
    params: any,
    originalError: unknown
  ) {
    super(message, 'QUERY', 'custom', { sql, params }, originalError)
    this.name = 'QuerySyntaxError'
  }
}

/**
 * 记录不存在错误
 */
export class RecordNotFoundError extends DatabaseOperationError {
  constructor(table: string, id: string) {
    super(
      `Record not found: ${table}:${id}`,
      'SELECT',
      table,
      { id },
      null
    )
    this.name = 'RecordNotFoundError'
  }
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

/**
 * 从 SurrealDB 错误中提取有用信息
 */
export function parseSurrealDBError(error: unknown): {
  message: string
  code?: string
  details?: string
} {
  if (error instanceof Error) {
    const message = error.message
    
    // 尝试解析常见的 SurrealDB 错误模式
    if (message.includes('already exists')) {
      return {
        message: '记录已存在',
        code: 'DUPLICATE',
        details: message
      }
    }
    
    if (message.includes('not found')) {
      return {
        message: '记录不存在',
        code: 'NOT_FOUND',
        details: message
      }
    }
    
    if (message.includes('syntax error') || message.includes('parse error')) {
      return {
        message: 'SQL 语法错误',
        code: 'SYNTAX_ERROR',
        details: message
      }
    }
    
    if (message.includes('permission') || message.includes('access denied')) {
      return {
        message: '权限不足',
        code: 'PERMISSION_DENIED',
        details: message
      }
    }
    
    if (message.includes('connection') || message.includes('connect')) {
      return {
        message: '数据库连接失败',
        code: 'CONNECTION_ERROR',
        details: message
      }
    }
    
    return {
      message: message,
      details: message
    }
  }
  
  return {
    message: String(error),
    details: String(error)
  }
}
