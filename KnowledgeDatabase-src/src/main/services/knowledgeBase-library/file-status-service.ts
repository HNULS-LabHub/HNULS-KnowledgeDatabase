import * as path from 'path'
import { MinerUMetaStore } from '../mineru-parser/meta-store'
import { ChunkMetaStore } from '../chunking/chunk-meta-store'
import { logger } from '../logger'
import { safeDocName } from '../mineru-parser/util'

/**
 * 文件状态信息
 */
export interface FileStatusInfo {
  /** 解析状态 */
  status: 'parsed' | 'parsing' | 'failed' | 'pending'
  /** 分块数量 */
  chunkCount?: number
}

/**
 * 文件状态服务
 * 负责查询文件的解析状态和分块数量
 */
export class FileStatusService {
  private mineruMetaStore: MinerUMetaStore
  private chunkMetaStore: ChunkMetaStore

  constructor() {
    this.mineruMetaStore = new MinerUMetaStore()
    this.chunkMetaStore = new ChunkMetaStore()
  }

  /**
   * 获取文件的状态信息
   * @param kbRoot 知识库根目录
   * @param fileName 文件名
   * @returns 状态信息
   */
  async getFileStatus(kbRoot: string, fileName: string): Promise<FileStatusInfo> {
    try {
      // 1. 获取解析状态
      const status = await this.getParsingStatus(kbRoot, fileName)

      // 2. 如果已解析，获取分块数量
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
}
