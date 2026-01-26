import * as path from 'path'
import * as fs from 'fs/promises'
import { logger } from '../logger'
import type {
  KnowledgeConfig,
  KnowledgeGlobalConfig,
  DocumentConfig
} from '../../../preload/types/knowledge-config.types'

export class KnowledgeConfigService {
  private readonly defaultVersion = '1.0.0'

  /**
   * 获取配置文件路径
   */
  private getConfigPath(knowledgeBaseDocumentPath: string): string {
    return path.join(knowledgeBaseDocumentPath, '.config', 'KnowledgeConfig.json')
  }

  /**
   * 获取默认全局配置
   */
  private getDefaultGlobalConfig(): KnowledgeGlobalConfig {
    return {
      chunking: {
        mode: 'recursive',
        maxChars: 1000
      }
    }
  }

  /**
   * 确保配置文件存在
   */
  private async ensureConfigExists(configPath: string): Promise<void> {
    try {
      await fs.access(configPath)
    } catch {
      const defaultConfig: KnowledgeConfig = {
        version: this.defaultVersion,
        global: this.getDefaultGlobalConfig(),
        documents: {}
      }
      await this.writeConfig(configPath, defaultConfig)
      logger.info(`Created knowledge config file: ${configPath}`)
    }
  }

  /**
   * 读取配置文件
   */
  async readConfig(knowledgeBaseDocumentPath: string): Promise<KnowledgeConfig> {
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    await this.ensureConfigExists(configPath)

    try {
      const content = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      logger.error('Failed to read knowledge config', error)
      return {
        version: this.defaultVersion,
        global: this.getDefaultGlobalConfig(),
        documents: {}
      }
    }
  }

  /**
   * 写入配置文件
   */
  private async writeConfig(configPath: string, config: KnowledgeConfig): Promise<void> {
    try {
      const dir = path.dirname(configPath)
      await fs.mkdir(dir, { recursive: true })

      const tempPath = `${configPath}.tmp`
      await fs.writeFile(tempPath, JSON.stringify(config, null, 2), 'utf-8')
      await fs.rename(tempPath, configPath)
    } catch (error) {
      logger.error('Failed to write knowledge config', error)
      throw error
    }
  }

  /**
   * 更新全局配置
   */
  async updateGlobalConfig(
    knowledgeBaseDocumentPath: string,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ): Promise<KnowledgeConfig> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    config.global = { ...config.global, ...globalConfig }

    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    await this.writeConfig(configPath, config)

    logger.info('Updated global config')
    return config
  }

  /**
   * 获取文档配置（合并全局配置）
   */
  async getDocumentConfig(
    knowledgeBaseDocumentPath: string,
    fileKey: string
  ): Promise<Required<DocumentConfig>> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const docConfig = config.documents[fileKey] || {}

    // 合并全局配置和文档配置
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
  async updateDocumentConfig(
    knowledgeBaseDocumentPath: string,
    fileKey: string,
    docConfig: DocumentConfig
  ): Promise<KnowledgeConfig> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)

    // 如果配置为空，删除该文档配置（回正）
    if (!docConfig.chunking || Object.keys(docConfig.chunking).length === 0) {
      delete config.documents[fileKey]
    } else {
      config.documents[fileKey] = docConfig
    }

    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    await this.writeConfig(configPath, config)

    logger.info(`Updated document config for ${fileKey}`)
    return config
  }

  /**
   * 清除文档配置（回正）
   */
  async clearDocumentConfig(
    knowledgeBaseDocumentPath: string,
    fileKey: string
  ): Promise<KnowledgeConfig> {
    return this.updateDocumentConfig(knowledgeBaseDocumentPath, fileKey, {})
  }

  /**
   * 文件移动/重命名：迁移单个 document key
   */
  async moveDocumentKey(
    knowledgeBaseDocumentPath: string,
    oldFileKey: string,
    newFileKey: string
  ): Promise<void> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)

    const oldKey = oldFileKey.replace(/\\/g, '/')
    const newKey = newFileKey.replace(/\\/g, '/')

    if (!config.documents[oldKey]) return

    config.documents[newKey] = config.documents[oldKey]
    delete config.documents[oldKey]

    await this.writeConfig(configPath, config)
    logger.info(`Moved document config key: ${oldKey} -> ${newKey}`)
  }

  /**
   * 目录移动：迁移 prefix 下所有 document keys
   */
  async moveDocumentKeysByPrefix(
    knowledgeBaseDocumentPath: string,
    oldPrefix: string,
    newPrefix: string
  ): Promise<void> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)

    const from = oldPrefix.replace(/\\/g, '/').replace(/\/+$/, '') + '/'
    const to = newPrefix.replace(/\\/g, '/').replace(/\/+$/, '') + '/'

    let hasChanges = false
    for (const key of Object.keys(config.documents)) {
      if (!key.startsWith(from)) continue
      const nextKey = to + key.slice(from.length)
      config.documents[nextKey] = config.documents[key]
      delete config.documents[key]
      hasChanges = true
    }

    if (hasChanges) {
      await this.writeConfig(configPath, config)
      logger.info(`Moved document config keys by prefix: ${from} -> ${to}`)
    }
  }

  /**
   * 清理已删除文档的配置
   * @param knowledgeBaseDocumentPath 知识库文档路径
   * @param fileKey 文件标识（支持目录，会清理该目录下所有文件配置）
   */
  async cleanupDocumentConfig(knowledgeBaseDocumentPath: string, fileKey: string): Promise<void> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    let hasChanges = false

    // 清理指定文件的配置
    if (config.documents[fileKey]) {
      delete config.documents[fileKey]
      hasChanges = true
    }

    // 如果是目录，清理该目录下所有文件的配置
    const dirPrefix = fileKey.endsWith('/') ? fileKey : `${fileKey}/`
    for (const key of Object.keys(config.documents)) {
      if (key.startsWith(dirPrefix)) {
        delete config.documents[key]
        hasChanges = true
      }
    }

    if (hasChanges) {
      await this.writeConfig(configPath, config)
      logger.info(`Cleaned up document config for ${fileKey}`)
    }
  }

  /**
   * 验证并清理不存在的文档配置（惰性清理）
   * @param knowledgeBaseDocumentPath 知识库文档路径
   */
  async validateAndCleanupConfig(knowledgeBaseDocumentPath: string): Promise<void> {
    const config = await this.readConfig(knowledgeBaseDocumentPath)
    const configPath = this.getConfigPath(knowledgeBaseDocumentPath)
    const basePath = knowledgeBaseDocumentPath
    let hasChanges = false

    // 检查每个文档配置对应的文件是否存在
    for (const fileKey of Object.keys(config.documents)) {
      const fullPath = path.join(basePath, fileKey)
      try {
        await fs.access(fullPath)
      } catch {
        // 文件不存在，删除配置
        delete config.documents[fileKey]
        hasChanges = true
        logger.info(`Cleaned up orphaned config for ${fileKey}`)
      }
    }

    if (hasChanges) {
      await this.writeConfig(configPath, config)
    }
  }
}
