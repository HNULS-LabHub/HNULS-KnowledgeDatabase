import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { KnowledgeLibraryService } from '../services/knowledgeBase-library'
import type {
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData
} from '../services/knowledgeBase-library'

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
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
          error: `Knowledge base with id ${id} not found`
        }
      }
      return {
        success: true,
        data: knowledgeBase
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
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
          error: 'Knowledge base name is required'
        }
      }

      const knowledgeBase = await this.knowledgeLibraryService.create(data)
      return {
        success: true,
        data: knowledgeBase
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 更新知识库
   */
  async handleUpdate(
    _event: IpcMainInvokeEvent,
    id: number,
    data: UpdateKnowledgeBaseData
  ) {
    try {
      const knowledgeBase = await this.knowledgeLibraryService.update(id, data)
      if (!knowledgeBase) {
        return {
          success: false,
          error: `Knowledge base with id ${id} not found`
        }
      }
      return {
        success: true,
        data: knowledgeBase
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
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
          error: `Knowledge base with id ${id} not found`
        }
      }
      return {
        success: true,
        data: { id }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
