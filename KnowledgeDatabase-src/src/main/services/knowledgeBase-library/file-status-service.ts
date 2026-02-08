import * as path from 'path'
import { MinerUMetaStore } from '../mineru-parser/meta-store'
import { ChunkMetaStore } from '../chunking/chunk-meta-store'
import { logger } from '../logger'
import { safeDocName } from '../mineru-parser/util'
import type { QueryService } from '../surrealdb-service/query-service'

/**
 * 嵌入信息
 */
export interface EmbeddingInfo {
  configName: string
  dimensions: number
  status: 'pending' | 'running' | 'completed' | 'failed'
}

/**
 * 文件状态信息
 */
export interface FileStatusInfo {
  /** 解析状态 */
  status: 'parsed' | 'parsing' | 'failed' | 'pending' | 'embedded'
  /** 分块数量 */
  chunkCount?: number
  /** 嵌入信息（当文件已有嵌入向量时） */
  embeddingInfo?: EmbeddingInfo[]
}

/**
 * 文件状态服务
 * 负责查询文件的解析状态和分块数量
 */
// 纯文本格式，不需要解析
const TEXT_FORMATS = new Set(['md', 'txt', 'markdown', 'text'])

export class FileStatusService {
  private mineruMetaStore: MinerUMetaStore
  private chunkMetaStore: ChunkMetaStore
  private queryService?: QueryService

  constructor(queryService?: QueryService) {
    this.mineruMetaStore = new MinerUMetaStore()
    this.chunkMetaStore = new ChunkMetaStore()
    this.queryService = queryService
  }

  /**
   * 设置 QueryService（用于查询嵌入信息）
   */
  setQueryService(queryService: QueryService): void {
    this.queryService = queryService
  }

  /**
   * 获取文件的状态信息
   * @param kbRoot 知识库根目录
   * @param fileName 文件名
   * @returns 状态信息
   */
  async getFileStatus(kbRoot: string, fileName: string): Promise<FileStatusInfo> {
    try {
      const fileExt = path.extname(fileName).toLowerCase().slice(1) // 去掉点号
      const fileKey = path.relative(kbRoot, path.join(kbRoot, fileName)).replace(/\\/g, '/')

      // 1. 查询嵌入信息（最高优先级）
      let embeddingInfo: EmbeddingInfo[] | undefined
      if (this.queryService && this.queryService.isConnected()) {
        embeddingInfo = await this.getEmbeddingInfo(fileKey)
        // 如果有嵌入信息，直接返回 'embedded' 状态
        if (embeddingInfo && embeddingInfo.length > 0) {
          return {
            status: 'embedded',
            embeddingInfo
          }
        }
      }

      // 2. 纯文本格式不需要解析，直接跳过 pending
      if (TEXT_FORMATS.has(fileExt)) {
        return {
          status: 'parsed',  // 纯文本直接视为已解析
          chunkCount: undefined
        }
      }

      // 3. 获取解析状态（非纯文本格式）
      const status = await this.getParsingStatus(kbRoot, fileName)

      // 4. 如果已解析，获取分块数量
      let chunkCount: number | undefined = undefined
      if (status === 'parsed') {
        chunkCount = await this.getChunkCount(kbRoot, fileName)
      }

      return {
        status,
        chunkCount
      }
    } catch (error) {
      logger.error(`Failed to get file status for ${fileName}`, error)
      // 返回默认状态
      return {
        status: 'pending',
        chunkCount: undefined
      }
    }
  }

  /**
   * 获取解析状态
   */
  private async getParsingStatus(
    kbRoot: string,
    fileName: string
  ): Promise<'parsed' | 'parsing' | 'failed' | 'pending'> {
    try {
      const meta = await this.mineruMetaStore.loadOrInit({ kbRoot, fileName })

      // 如果没有活跃版本，返回 pending
      if (!meta.activeVersionId) {
        return 'pending'
      }

      // 获取活跃版本的状态
      const activeVersion = meta.versions[meta.activeVersionId]
      if (!activeVersion) {
        return 'pending'
      }

      // 映射 MinerU 状态到文件状态
      switch (activeVersion.state) {
        case 'done':
          return 'parsed'
        case 'running':
        case 'converting':
        case 'pending':
          return 'parsing'
        case 'failed':
          return 'failed'
        case 'waiting-file':
        default:
          return 'pending'
      }
    } catch (error) {
      // 如果元数据不存在，说明文件从未被解析过
      logger.debug(`No parsing metadata found for ${fileName}, returning pending`)
      return 'pending'
    }
  }

  /**
   * 获取分块数量
   */
  private async getChunkCount(kbRoot: string, fileName: string): Promise<number | undefined> {
    try {
      const meta = await this.chunkMetaStore.loadOrInit({ kbRoot, fileName })

      // 如果有活跃配置，获取对应的分块结果
      if (meta.activeConfig) {
        const configKey = JSON.stringify(meta.activeConfig)
        const result = meta.results[configKey]

        if (result && result.chunks) {
          return result.chunks.length
        }
      }

      // 如果没有活跃配置，尝试获取最新的分块结果
      const allResults = Object.values(meta.results)
      if (allResults.length > 0) {
        // 按更新时间排序，取最新的
        const latestResult = allResults.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })[0]

        if (latestResult && latestResult.chunks) {
          return latestResult.chunks.length
        }
      }

      return undefined
    } catch (error) {
      logger.debug(`No chunk metadata found for ${fileName}`)
      return undefined
    }
  }

  /**
   * 批量获取文件状态
   * @param kbRoot 知识库根目录
   * @param fileNames 文件名列表
   * @returns 状态信息映射 (fileName -> FileStatusInfo)
   */
  async getBatchFileStatus(
    kbRoot: string,
    fileNames: string[]
  ): Promise<Map<string, FileStatusInfo>> {
    const statusMap = new Map<string, FileStatusInfo>()

    // 并行查询所有文件的状态
    await Promise.all(
      fileNames.map(async (fileName) => {
        const status = await this.getFileStatus(kbRoot, fileName)
        statusMap.set(fileName, status)
      })
    )

    return statusMap
  }

  /**
   * 查询文件的嵌入信息
   * @param fileKey 文件的 file_key
   * @returns 嵌入信息列表
   */
  private async getEmbeddingInfo(fileKey: string): Promise<EmbeddingInfo[] | undefined> {
    if (!this.queryService || !this.queryService.isConnected()) {
      return undefined
    }

    try {
      const sql = `
        SELECT
          embedding_config_name,
          dimensions,
          status
        FROM kb_document_embedding
        WHERE file_key = $fileKey
        AND status = 'completed';
      `

      const result = await this.queryService.query<any[]>(sql, { fileKey })

      if (!result || result.length === 0 || !result[0]) {
        return undefined
      }

      // 解析查询结果（SurrealDB 返回格式）
      const records = result[0] as any[]
      if (!Array.isArray(records) || records.length === 0) {
        return undefined
      }

      // 过滤出有效的嵌入记录
      const embeddings: EmbeddingInfo[] = records
        .filter((record: any) => record.embedding_config_name && record.dimensions)
        .map((record: any) => ({
          configName: record.embedding_config_name,
          dimensions: record.dimensions,
          status: record.status || 'completed'
        }))

      return embeddings.length > 0 ? embeddings : undefined
    } catch (error) {
      logger.debug(`Failed to query embedding info for ${fileKey}`, error)
      return undefined
    }
  }
}
