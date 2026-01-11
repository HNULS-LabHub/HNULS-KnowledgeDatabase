import type {
  KnowledgeBase,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData
} from './knowledge-library.types'

/**
 * 知识库数据源适配器
 * 负责调用 Electron 后端 API
 */
export const KnowledgeLibraryDataSource = {
  /**
   * 获取所有知识库
   */
  async getAll(): Promise<KnowledgeBase[]> {
    if (!window.api?.knowledgeLibrary) {
      throw new Error('Knowledge library API is not available. Please run in Electron environment.')
    }
    return await window.api.knowledgeLibrary.getAll()
  },

  /**
   * 根据 ID 获取知识库
   */
  async getById(id: number): Promise<KnowledgeBase> {
    if (!window.api?.knowledgeLibrary) {
      throw new Error('Knowledge library API is not available. Please run in Electron environment.')
    }
    return await window.api.knowledgeLibrary.getById(id)
  },

  /**
   * 创建知识库
   */
  async create(data: CreateKnowledgeBaseData): Promise<KnowledgeBase> {
    if (!window.api?.knowledgeLibrary) {
      throw new Error('Knowledge library API is not available. Please run in Electron environment.')
    }
    return await window.api.knowledgeLibrary.create(data)
  },

  /**
   * 更新知识库
   */
  async update(id: number, data: UpdateKnowledgeBaseData): Promise<KnowledgeBase> {
    if (!window.api?.knowledgeLibrary) {
      throw new Error('Knowledge library API is not available. Please run in Electron environment.')
    }
    return await window.api.knowledgeLibrary.update(id, data)
  },

  /**
   * 删除知识库
   */
  async delete(id: number): Promise<void> {
    if (!window.api?.knowledgeLibrary) {
      throw new Error('Knowledge library API is not available. Please run in Electron environment.')
    }
    return await window.api.knowledgeLibrary.delete(id)
  }
}
