import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { SurrealDBService, isDatabaseError } from '../services/surrealdb-service'
import { logger } from '../services/logger'

/**
 * 数据库操作 IPC 处理器
 *
 * 提供数据库 CRUD 操作和日志查询功能
 */
export class DatabaseIPCHandler extends BaseIPCHandler {
  constructor(private surrealDBService: SurrealDBService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'database'
  }

  /**
   * 统一错误处理
   */
  private handleError(operation: string, error: unknown, context?: any) {
    logger.error(`IPC database:${operation} failed`, {
      operation,
      context,
      error: error instanceof Error ? error.message : String(error),
      isDatabaseError: isDatabaseError(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    if (isDatabaseError(error)) {
      return {
        success: false,
        error: {
          message: error.message,
          type: 'DATABASE_ERROR',
          operation: error.operation,
          table: error.table,
          details: error.toJSON()
        }
      }
    }

    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'UNKNOWN_ERROR'
      }
    }
  }

  /**
   * 包装成功响应
   */
  private wrapSuccess(data: any) {
    return {
      success: true,
      data
    }
  }

  // ==================== User 操作 ====================

  async handleCreateuser(_event: IpcMainInvokeEvent, data: any) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.create('user', data)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('createuser', error, { data })
    }
  }

  async handleGetusers(_event: IpcMainInvokeEvent) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.select('user')
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('getusers', error)
    }
  }

  async handleGetuser(_event: IpcMainInvokeEvent, id: string) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.select('user', id)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('getuser', error, { id })
    }
  }

  async handleUpdateuser(_event: IpcMainInvokeEvent, id: string, data: any) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.update('user', id, data)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('updateuser', error, { id, data })
    }
  }

  async handleDeleteuser(_event: IpcMainInvokeEvent, id: string) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      await queryService.delete('user', id)
      return this.wrapSuccess({ id })
    } catch (error) {
      return this.handleError('deleteuser', error, { id })
    }
  }

  // ==================== Document 操作 ====================

  async handleCreatedocument(_event: IpcMainInvokeEvent, data: any) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.create('document', data)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('createdocument', error, { data })
    }
  }

  async handleGetdocuments(_event: IpcMainInvokeEvent) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.select('document')
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('getdocuments', error)
    }
  }

  async handleGetdocument(_event: IpcMainInvokeEvent, id: string) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.select('document', id)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('getdocument', error, { id })
    }
  }

  async handleUpdatedocument(_event: IpcMainInvokeEvent, id: string, data: any) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.update('document', id, data)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('updatedocument', error, { id, data })
    }
  }

  async handleDeletedocument(_event: IpcMainInvokeEvent, id: string) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      await queryService.delete('document', id)
      return this.wrapSuccess({ id })
    } catch (error) {
      return this.handleError('deletedocument', error, { id })
    }
  }

  // ==================== 通用查询 ====================

  async handleQuery(_event: IpcMainInvokeEvent, sql: string, params?: any) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.query(sql, params)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('query', error, { sql, params })
    }
  }

  // ==================== 日志查询 ====================

  async handleGetlogs(_event: IpcMainInvokeEvent, options?: any) {
    try {
      const queryService = this.surrealDBService.getQueryService()
      const result = await queryService.getOperationLogs(options)
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('getlogs', error, { options })
    }
  }

  async handleGetstatus(_event: IpcMainInvokeEvent) {
    try {
      const result = {
        connected: this.surrealDBService.getQueryService().isConnected(),
        serverRunning: this.surrealDBService.isRunning(),
        serverUrl: this.surrealDBService.getServerUrl()
      }
      return this.wrapSuccess(result)
    } catch (error) {
      return this.handleError('getstatus', error)
    }
  }
}
