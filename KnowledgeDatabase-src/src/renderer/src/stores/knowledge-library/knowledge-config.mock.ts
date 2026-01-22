import type {
  KnowledgeConfig,
  KnowledgeGlobalConfig,
  DocumentConfig
} from '@preload/types'

/**
 * 知识库配置 Mock 数据源（用于开发测试）
 */
export class KnowledgeConfigMockDataSource {
  private static configs: Map<number, KnowledgeConfig> = new Map()

  /**
   * 获取默认配置
   */
  private static getDefaultConfig(): KnowledgeConfig {
    return {
      version: '1.0.0',
      global: {
        chunking: {
          mode: 'recursive',
          maxChars: 1000
        }
      },
      documents: {}
    }
  }

  /**
   * 获取知识库配置
   */
  static async getConfig(knowledgeBaseId: number): Promise<KnowledgeConfig> {
    if (!this.configs.has(knowledgeBaseId)) {
      this.configs.set(knowledgeBaseId, this.getDefaultConfig())
    }
    return this.configs.get(knowledgeBaseId)!
  }

  /**
   * 更新全局配置
   */
  static async updateGlobalConfig(
    knowledgeBaseId: number,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ): Promise<KnowledgeConfig> {
    const config = await this.getConfig(knowledgeBaseId)
    config.global = { ...config.global, ...globalConfig }
    return config
  }

  /**
   * 获取文档配置（已合并全局配置）
   */
  static async getDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<Required<DocumentConfig>> {
    const config = await this.getConfig(knowledgeBaseId)
    const docConfig = config.documents[fileKey] || {}

    return {
      chunking: {
        mode: 'recursive',
        maxChars: docConfig.chunking?.maxChars ?? config.global.chunking.maxChars
      }
    }
  }

  /**
   * 更新文档配置
   */
  static async updateDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string,
    docConfig: DocumentConfig
  ): Promise<KnowledgeConfig> {
    const config = await this.getConfig(knowledgeBaseId)

    if (!docConfig.chunking || Object.keys(docConfig.chunking).length === 0) {
      delete config.documents[fileKey]
    } else {
      config.documents[fileKey] = docConfig
    }

    return config
  }

  /**
   * 清除文档配置（回正）
   */
  static async clearDocumentConfig(
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<KnowledgeConfig> {
    return this.updateDocumentConfig(knowledgeBaseId, fileKey, {})
  }

  /**
   * 验证并清理配置
   */
  static async validateAndCleanup(_knowledgeBaseId: number): Promise<void> {
    // Mock 实现不需要清理
  }
}
