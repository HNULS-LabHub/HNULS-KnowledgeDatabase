import type { KnowledgeConfig, KnowledgeGlobalConfig, DocumentConfig } from '@preload/types'

/**
 * 知识库配置数据源
 */
export class KnowledgeConfigDataSource {
  /**
   * 获取知识库配置
   */
  static async getConfig(knowledgeBaseId: number): Promise<KnowledgeConfig> {
    const result = await window.api.knowledgeConfig.getConfig(knowledgeBaseId)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get config')
    }
    return result.data
  }

  /**
   * 更新全局配置
   */
  static async updateGlobalConfig(
    knowledgeBaseId: number,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ): Promise<KnowledgeConfig> {
    const result = await window.api.knowledgeConfig.updateGlobalConfig(
      knowledgeBaseId,
      globalConfig
    )
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to update global config')
    }
    return result.data
  }

  /**
   * 获取文档配置（已合并全局配置）
   */
  static async getDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<Required<DocumentConfig>> {
    const result = await window.api.knowledgeConfig.getDocumentConfig(knowledgeBaseId, fileKey)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to get document config')
    }
    return result.data
  }

  /**
   * 更新文档配置
   */
  static async updateDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string,
    docConfig: DocumentConfig
  ): Promise<KnowledgeConfig> {
    const result = await window.api.knowledgeConfig.updateDocumentConfig(
      knowledgeBaseId,
      fileKey,
      docConfig
    )
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to update document config')
    }
    return result.data
  }

  /**
   * 清除文档配置（回正）
   */
  static async clearDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<KnowledgeConfig> {
    const result = await window.api.knowledgeConfig.clearDocumentConfig(knowledgeBaseId, fileKey)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to clear document config')
    }
    return result.data
  }

  /**
   * 验证并清理配置
   */
  static async validateAndCleanup(knowledgeBaseId: number): Promise<void> {
    const result = await window.api.knowledgeConfig.validateAndCleanup(knowledgeBaseId)
    if (!result.success) {
      throw new Error(result.error || 'Failed to validate and cleanup config')
    }
  }
}
