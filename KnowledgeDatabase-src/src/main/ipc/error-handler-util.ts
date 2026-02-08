/**
 * IPC 错误处理工具
 *
 * 提供统一的错误处理和响应格式化
 */

import { isDatabaseError } from '../services/surrealdb-service'
import { logger } from '../services/logger'

/**
 * IPC 响应格式
 */
export interface IPCResponse<T = any> {
  success: boolean
  data?: T
  error?: IPCError
}

/**
 * IPC 错误格式
 */
export interface IPCError {
  message: string
  type: string
  code?: string
  details?: any
  [key: string]: any
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 统一错误处理器
 */
export class IPCErrorHandler {
  /**
   * 处理错误并返回标准格式
   */
  static handle(operation: string, error: unknown, context?: any): IPCResponse {
    // 记录详细错误日志
    logger.error(`IPC ${operation} failed`, {
      operation,
      context,
      error: error instanceof Error ? error.message : String(error),
      isDatabaseError: isDatabaseError(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    // 数据库错误
    if (isDatabaseError(error)) {
      return {
        success: false,
        error: {
          message: error.message,
          type: ErrorType.DATABASE_ERROR,
          operation: error.operation,
          table: error.table,
          details: error.toJSON()
        }
      }
    }

    // 标准 Error 对象
    if (error instanceof Error) {
      return {
        success: false,
        error: {
          message: error.message,
          type: ErrorType.UNKNOWN_ERROR,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      }
    }

    // 其他类型错误
    return {
      success: false,
      error: {
        message: String(error),
        type: ErrorType.UNKNOWN_ERROR
      }
    }
  }

  /**
   * 创建验证错误
   */
  static validationError(message: string, field?: string): IPCResponse {
    return {
      success: false,
      error: {
        message,
        type: ErrorType.VALIDATION_ERROR,
        field
      }
    }
  }

  /**
   * 创建未找到错误
   */
  static notFoundError(message: string, id?: string | number): IPCResponse {
    return {
      success: false,
      error: {
        message,
        type: ErrorType.NOT_FOUND,
        id
      }
    }
  }

  /**
   * 创建权限错误
   */
  static permissionError(message: string): IPCResponse {
    return {
      success: false,
      error: {
        message,
        type: ErrorType.PERMISSION_DENIED
      }
    }
  }

  /**
   * 包装成功响应
   */
  static success<T>(data: T): IPCResponse<T> {
    return {
      success: true,
      data
    }
  }

  /**
   * 记录操作成功
   */
  static logSuccess(operation: string, context?: any): void {
    logger.info(`IPC ${operation} succeeded`, context)
  }
}

/**
 * 装饰器：自动处理 IPC 方法的错误
 */
export function handleIPCError(operation: string) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      try {
        const result = await originalMethod.apply(this, args)
        return IPCErrorHandler.success(result)
      } catch (error) {
        return IPCErrorHandler.handle(operation, error, { args })
      }
    }

    return descriptor
  }
}
