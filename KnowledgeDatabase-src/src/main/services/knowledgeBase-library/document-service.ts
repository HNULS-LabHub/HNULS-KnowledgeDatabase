import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { logger } from '../logger'

/**
 * 文档目录管理服务
 * 负责管理知识库的文档目录创建和管理
 */
export class DocumentService {
  private documentsBasePath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.documentsBasePath = path.join(userDataPath, 'data', 'document')
  }

  /**
   * 初始化文档目录（程序启动时调用）
   * 在 userData/data/ 下创建 document 目录
   */
  async initializeDocumentsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.documentsBasePath, { recursive: true })
      logger.info(`Initialized documents directory: ${this.documentsBasePath}`)
    } catch (error) {
      logger.error('Failed to initialize documents directory', error)
      throw error
    }
  }

  /**
   * 为知识库创建文档目录
   * @param knowledgeBaseId 知识库ID
   * @param knowledgeBaseName 知识库名称
   * @returns 创建的目录名称（不含完整路径，如 "技术文档-0001"）
   */
  async createKnowledgeBaseDirectory(
    knowledgeBaseId: number,
    knowledgeBaseName: string
  ): Promise<string> {
    try {
      // 确保基础目录存在
      await this.initializeDocumentsDirectory()

      // 生成目录名称（带序列号）
      const directoryName = await this.generateUniqueDirectoryName(knowledgeBaseName)
      const directoryPath = path.join(this.documentsBasePath, directoryName)

      // 创建目录
      await fs.mkdir(directoryPath, { recursive: true })

      logger.info(`Created knowledge base directory: ${directoryName} (ID: ${knowledgeBaseId})`)

      return directoryName
    } catch (error) {
      logger.error('Failed to create knowledge base directory', error)
      throw error
    }
  }

  /**
   * 生成唯一的目录名称（带序列号）
   */
  private async generateUniqueDirectoryName(baseName: string): Promise<string> {
    // 清理名称，移除非法字符
    const sanitizedName = baseName.replace(/[<>:"/\\|?*]/g, '_').trim()

    let sequence = 1
    let directoryName = `${sanitizedName}-${String(sequence).padStart(4, '0')}`
    let directoryPath = path.join(this.documentsBasePath, directoryName)

    // 检查目录是否存在，如果存在则递增序列号
    while (await this.directoryExists(directoryPath)) {
      sequence++
      directoryName = `${sanitizedName}-${String(sequence).padStart(4, '0')}`
      directoryPath = path.join(this.documentsBasePath, directoryName)
    }

    return directoryName
  }

  /**
   * 检查目录是否存在
   */
  private async directoryExists(directoryPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(directoryPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * 根据目录名称获取完整路径
   */
  getFullDirectoryPath(directoryName: string): string {
    return path.join(this.documentsBasePath, directoryName)
  }

  /**
   * 确保知识库目录存在，如果不存在则自动创建
   * @param directoryName 目录名称（不含完整路径）
   * @returns 目录是否已存在（true=已存在，false=新创建）
   */
  async ensureKnowledgeBaseDirectory(directoryName: string): Promise<boolean> {
    try {
      const directoryPath = this.getFullDirectoryPath(directoryName)

      // 检查目录是否存在
      const exists = await this.directoryExists(directoryPath)

      if (!exists) {
        // 目录不存在，自动创建
        await fs.mkdir(directoryPath, { recursive: true })
        logger.info(`Auto-created missing knowledge base directory: ${directoryName}`)
        return false // 新创建的
      }

      return true // 已存在
    } catch (error) {
      logger.error('Failed to ensure knowledge base directory', { directoryName, error })
      throw error
    }
  }

  /**
   * 删除知识库的文档目录
   * @param directoryName 目录名称（不含完整路径）
   */
  async deleteKnowledgeBaseDirectory(directoryName: string): Promise<void> {
    try {
      const directoryPath = path.join(this.documentsBasePath, directoryName)

      // 检查目录是否存在
      if (await this.directoryExists(directoryPath)) {
        await fs.rm(directoryPath, { recursive: true, force: true })
        logger.info(`Deleted knowledge base directory: ${directoryName}`)
      }
    } catch (error) {
      logger.error('Failed to delete knowledge base directory', error)
      throw error
    }
  }
}
