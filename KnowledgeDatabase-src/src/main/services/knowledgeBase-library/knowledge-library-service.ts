import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { logger } from '../logger'
import type {
  KnowledgeBaseMeta,
  KnowledgeLibraryMeta,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData
} from './types'

/**
 * 知识库元数据服务
 * 负责管理知识库元数据的存储和读取
 */
export class KnowledgeLibraryService {
  private metaFilePath: string
  private readonly defaultVersion = '1.0.0'

  constructor() {
    // 获取用户数据目录下的 data 目录
    const userDataPath = app.getPath('userData')
    this.metaFilePath = path.join(userDataPath, 'data', 'Knowledge-library-meta.json')
  }

  /**
   * 获取元数据文件路径
   */
  getMetaFilePath(): string {
    return this.metaFilePath
  }

  /**
   * 确保元数据文件存在，如果不存在则创建
   */
  private async ensureFileExists(): Promise<void> {
    try {
      await fs.access(this.metaFilePath)
    } catch {
      // 文件不存在，创建默认结构
      const defaultData: KnowledgeLibraryMeta = {
        version: this.defaultVersion,
        knowledgeBases: []
      }
      await this.writeFile(defaultData)
      logger.info(`Created knowledge library meta file: ${this.metaFilePath}`)
    }
  }

  /**
   * 读取元数据文件
   */
  private async readFile(): Promise<KnowledgeLibraryMeta> {
    await this.ensureFileExists()

    try {
      const content = await fs.readFile(this.metaFilePath, 'utf-8')
      const data: KnowledgeLibraryMeta = JSON.parse(content)

      // 验证数据结构
      if (!data.version || !Array.isArray(data.knowledgeBases)) {
        throw new Error('Invalid meta file structure')
      }

      return data
    } catch (error) {
      logger.error('Failed to read knowledge library meta file', error)
      // 如果读取失败，返回默认结构
      return {
        version: this.defaultVersion,
        knowledgeBases: []
      }
    }
  }

  /**
   * 写入元数据文件
   */
  private async writeFile(data: KnowledgeLibraryMeta): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.metaFilePath)
      await fs.mkdir(dir, { recursive: true })

      // 写入文件（使用原子写入，先写入临时文件再重命名）
      const tempPath = `${this.metaFilePath}.tmp`
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
      await fs.rename(tempPath, this.metaFilePath)
    } catch (error) {
      logger.error('Failed to write knowledge library meta file', error)
      throw error
    }
  }

  /**
   * 生成新的知识库 ID
   */
  private async generateId(): Promise<number> {
    const data = await this.readFile()
    if (data.knowledgeBases.length === 0) {
      return 1
    }
    const maxId = Math.max(...data.knowledgeBases.map((kb) => kb.id))
    return maxId + 1
  }

  /**
   * 获取所有知识库元数据
   */
  async getAll(): Promise<KnowledgeBaseMeta[]> {
    const data = await this.readFile()
    return data.knowledgeBases
  }

  /**
   * 根据 ID 获取知识库元数据
   */
  async getById(id: number): Promise<KnowledgeBaseMeta | null> {
    const data = await this.readFile()
    const kb = data.knowledgeBases.find((kb) => kb.id === id)
    return kb || null
  }

  /**
   * 创建新知识库
   */
  async create(data: CreateKnowledgeBaseData): Promise<KnowledgeBaseMeta> {
    const meta = await this.readFile()
    const now = new Date().toISOString()

    const newKB: KnowledgeBaseMeta = {
      id: await this.generateId(),
      name: data.name.trim(),
      description: data.description.trim(),
      docCount: 0,
      chunkCount: 0,
      lastUpdated: now,
      createdAt: now,
      color: data.color,
      icon: data.icon
    }

    meta.knowledgeBases.push(newKB)
    await this.writeFile(meta)

    logger.info(`Created knowledge base: ${newKB.name} (ID: ${newKB.id})`)
    return newKB
  }

  /**
   * 更新知识库元数据
   */
  async update(id: number, updateData: UpdateKnowledgeBaseData): Promise<KnowledgeBaseMeta | null> {
    const meta = await this.readFile()
    const index = meta.knowledgeBases.findIndex((kb) => kb.id === id)

    if (index === -1) {
      return null
    }

    const updatedKB: KnowledgeBaseMeta = {
      ...meta.knowledgeBases[index],
      ...updateData,
      id, // 确保 ID 不被修改
      lastUpdated: new Date().toISOString()
    }

    meta.knowledgeBases[index] = updatedKB
    await this.writeFile(meta)

    logger.info(`Updated knowledge base: ${updatedKB.name} (ID: ${id})`)
    return updatedKB
  }

  /**
   * 删除知识库
   */
  async delete(id: number): Promise<boolean> {
    const meta = await this.readFile()
    const index = meta.knowledgeBases.findIndex((kb) => kb.id === id)

    if (index === -1) {
      return false
    }

    const deletedKB = meta.knowledgeBases[index]
    meta.knowledgeBases.splice(index, 1)
    await this.writeFile(meta)

    logger.info(`Deleted knowledge base: ${deletedKB.name} (ID: ${id})`)
    return true
  }
}
