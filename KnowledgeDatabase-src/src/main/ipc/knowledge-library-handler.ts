import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import type {
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData
} from '../services/knowledgeBase-library'
import { isDatabaseError } from '../services/surrealdb-service'
import { logger } from '../services/logger'

/**
 * 知识库元数据 IPC 处理器
 *
 * 提供知识库元数据的 CRUD 操作
 */
export class KnowledgeLibraryIPCHandler extends BaseIPCHandler {
  constructor(private knowledgeLibraryService: KnowledgeLibraryService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'knowledge-library'
  }

  /**
   * 统一错误处理
   */
  private handleError(operation: string, error: unknown, context?: any) {
    // 记录详细错误日志
    logger.error(`IPC ${operation} failed`, {
      operation,
      context,
      error: error instanceof Error ? error.message : String(error),
      isDatabaseError: isDatabaseError(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    // 返回结构化错误信息
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
   * 获取所有知识库
   */
  async handleGetall(_event: IpcMainInvokeEvent) {
    try {
      const knowledgeBases = await this.knowledgeLibraryService.getAll()
      return {
        success: true,
        data: knowledgeBases
      }
    } catch (error) {
      return this.handleError('knowledge-library:getall', error)
    }
  }

  /**
   * 根据 ID 获取知识库
   */
  async handleGetbyid(_event: IpcMainInvokeEvent, id: number) {
    try {
      const knowledgeBase = await this.knowledgeLibraryService.getById(id)
      if (!knowledgeBase) {
        return {
          success: false,
          error: {
            message: `知识库不存在 (ID: ${id})`,
            type: 'NOT_FOUND',
            id
          }
        }
      }
      return {
        success: true,
        data: knowledgeBase
      }
    } catch (error) {
      return this.handleError('knowledge-library:getbyid', error, { id })
    }
  }

  /**
   * 创建知识库
   */
  async handleCreate(_event: IpcMainInvokeEvent, data: CreateKnowledgeBaseData) {
    try {
      // 验证必填字段
      if (!data.name || !data.name.trim()) {
        return {
          success: false,
          error: {
            message: '知识库名称不能为空',
            type: 'VALIDATION_ERROR',
            field: 'name'
          }
        }
      }

      const knowledgeBase = await this.knowledgeLibraryService.create(data)

      logger.info('Knowledge base created successfully', {
        id: knowledgeBase.id,
        name: knowledgeBase.name
      })

      return {
        success: true,
        data: knowledgeBase
      }
    } catch (error) {
      return this.handleError('knowledge-library:create', error, { data })
    }
  }

  /**
   * 更新知识库
   */
  async handleUpdate(_event: IpcMainInvokeEvent, id: number, data: UpdateKnowledgeBaseData) {
    try {
      const knowledgeBase = await this.knowledgeLibraryService.update(id, data)
      if (!knowledgeBase) {
        return {
          success: false,
          error: {
            message: `知识库不存在 (ID: ${id})`,
            type: 'NOT_FOUND',
            id
          }
        }
      }

      logger.info('Knowledge base updated successfully', {
        id,
        updates: Object.keys(data)
      })

      return {
        success: true,
        data: knowledgeBase
      }
    } catch (error) {
      return this.handleError('knowledge-library:update', error, { id, data })
    }
  }

  /**
   * 删除知识库
   */
  async handleDelete(_event: IpcMainInvokeEvent, id: number) {
    try {
      const deleted = await this.knowledgeLibraryService.delete(id)
      if (!deleted) {
        return {
          success: false,
          error: {
            message: `知识库不存在 (ID: ${id})`,
            type: 'NOT_FOUND',
            id
          }
        }
      }

      logger.info('Knowledge base deleted successfully', { id })

      return {
        success: true,
        data: { id }
      }
    } catch (error) {
      return this.handleError('knowledge-library:delete', error, { id })
    }
  }
}
