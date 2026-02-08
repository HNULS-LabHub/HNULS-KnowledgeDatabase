/**
 * 分块服务主类
 *
 * 职责：
 * - 管理分块策略插件
 * - 读取文档内容（纯文本文件直接读，非纯文本从解析结果读）
 * - 调用策略执行分块
 * - 保存分块结果
 *
 * IPC 调用范例（前端调用）：
 * ```typescript
 * // 在 renderer 进程中使用
 * import { chunkingAPI } from '@preload/api'
 *
 * // 执行分块
 * const result = await chunkingAPI.chunkDocument({
 *   knowledgeBaseId: 1,
 *   fileRelativePath: 'documents/example.pdf',
 *   config: {
 *     mode: 'recursive',
 *     maxChars: 1000
 *   },
 *   parsingVersionId: 'version-1' // 非纯文本文件需要指定
 * })
 *
 * if (result.success && result.data) {
 *   console.log('分块成功，共', result.data.chunks.length, '个分块')
 * } else {
 *   console.error('分块失败:', result.error)
 * }
 *
 * // 获取分块结果
 * const getResult = await chunkingAPI.getChunkingResult({
 *   knowledgeBaseId: 1,
 *   fileRelativePath: 'documents/example.pdf',
 *   config: {
 *     mode: 'recursive',
 *     maxChars: 1000
 *   }
 * })
 *
 * if (getResult.success && getResult.data) {
 *   console.log('获取到', getResult.data.chunks.length, '个分块')
 * }
 * ```
 */
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '../logger'
import { DocumentService } from '../knowledgeBase-library/document-service'
import { KnowledgeLibraryService } from '../knowledgeBase-library/knowledge-library-service'
import { MinerUMetaStore } from '../mineru-parser/meta-store'
import { getDocDir as getParserDocDir } from '../mineru-parser/util'
import { IChunkingStrategy } from './strategies'
import { RecursiveChunkingStrategy, SemanticChunkingStrategy } from './strategies'
import { ChunkMetaStore } from './chunk-meta-store'
import { isPlainTextFile } from './util'
import type { ChunkingRequest, ChunkingResult, GetChunkingResultRequest } from './types'

export class ChunkingService {
  private strategies = new Map<string, IChunkingStrategy>()
  private chunkMetaStore: ChunkMetaStore
  private documentService: DocumentService
  private knowledgeLibraryService: KnowledgeLibraryService
  private minerUMetaStore: MinerUMetaStore

  constructor() {
    // 注册分块策略插件
    this.registerStrategy(new RecursiveChunkingStrategy())
    this.registerStrategy(new SemanticChunkingStrategy())

    // 初始化服务
    this.chunkMetaStore = new ChunkMetaStore()
    this.documentService = new DocumentService()
    this.knowledgeLibraryService = new KnowledgeLibraryService()
    this.minerUMetaStore = new MinerUMetaStore()
  }

  /**
   * 注册分块策略（插件机制）
   */
  registerStrategy(strategy: IChunkingStrategy): void {
    this.strategies.set(strategy.name, strategy)
    logger.info(`[ChunkingService] Registered strategy: ${strategy.name}`)
  }

  /**
   * 执行分块
   */
  async chunkDocument(request: ChunkingRequest): Promise<ChunkingResult> {
    // 1. 获取知识库信息
    const kb = await this.knowledgeLibraryService.getById(request.knowledgeBaseId)
    if (!kb || !kb.documentPath) {
      throw new Error(`Knowledge base ${request.knowledgeBaseId} not found or missing documentPath`)
    }

    await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
    const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

    const fileName = path.basename(request.fileRelativePath)
    const fileKey = request.fileRelativePath.replace(/\\/g, '/')
    const fileExtension = path.extname(fileName).slice(1) // 移除点号

    // 2. 检查是否已有相同配置的分块结果
    const existingResult = await this.chunkMetaStore.getResult({
      kbRoot,
      fileName,
      config: request.config
    })

    if (existingResult) {
      logger.info(
        `[ChunkingService] Found existing chunking result for ${fileKey} with config ${JSON.stringify(request.config)}`
      )
      return existingResult
    }

    // 3. 读取文档内容
    const content = await this.readDocumentContent({
      kbRoot,
      fileRelativePath: request.fileRelativePath,
      fileExtension,
      parsingVersionId: request.parsingVersionId
    })

    // 4. 获取策略并执行分块
    const strategy = this.strategies.get(request.config.mode)
    if (!strategy) {
      throw new Error(`Chunking strategy '${request.config.mode}' not found`)
    }

    if (!strategy.validateConfig(request.config)) {
      throw new Error(`Invalid chunking config: ${JSON.stringify(request.config)}`)
    }

    logger.info(`[ChunkingService] Chunking document ${fileKey} with strategy ${strategy.name}`)
    const chunks = await strategy.chunk(content, request.config)

    // 5. 创建分块结果
    const result: ChunkingResult = {
      fileKey,
      config: request.config,
      chunks,
      totalChars: content.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 6. 保存分块结果
    await this.chunkMetaStore.saveResult({
      kbRoot,
      fileName,
      result
    })

    logger.info(
      `[ChunkingService] Chunking completed for ${fileKey}: ${chunks.length} chunks created`
    )

    return result
  }

  /**
   * 获取分块结果
   */
  async getChunkingResult(request: GetChunkingResultRequest): Promise<ChunkingResult | null> {
    const kb = await this.knowledgeLibraryService.getById(request.knowledgeBaseId)
    if (!kb || !kb.documentPath) {
      throw new Error(`Knowledge base ${request.knowledgeBaseId} not found or missing documentPath`)
    }

    await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
    const kbRoot = this.documentService.getFullDirectoryPath(kb.documentPath)

    const fileName = path.basename(request.fileRelativePath)

    return await this.chunkMetaStore.getResult({
      kbRoot,
      fileName,
      config: request.config
    })
  }

  /**
   * 读取文档内容
   *
   * 对于纯文本文件：直接读取文件
   * 对于非纯文本文件：从 MinerU 解析结果读取（full.md）
   */
  private async readDocumentContent(params: {
    kbRoot: string
    fileRelativePath: string
    fileExtension: string
    parsingVersionId?: string
  }): Promise<string> {
    const isPlainText = isPlainTextFile(params.fileExtension)

    if (isPlainText) {
      // 纯文本文件：直接读取
      const filePath = path.join(params.kbRoot, params.fileRelativePath)
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        logger.info(`[ChunkingService] Read plain text file: ${filePath} (${content.length} chars)`)
        return content
      } catch (error) {
        throw new Error(`Failed to read plain text file: ${filePath} - ${error}`)
      }
    } else {
      // 非纯文本文件：从 MinerU 解析结果读取
      const fileName = path.basename(params.fileRelativePath)
      const { docDir } = getParserDocDir(params.kbRoot, fileName)

      // 获取解析版本 ID
      let versionId = params.parsingVersionId
      if (!versionId) {
        // 如果没有指定，使用 active version
        const meta = await this.minerUMetaStore.loadOrInit({ kbRoot: params.kbRoot, fileName })
        versionId = meta.activeVersionId ?? undefined
      }

      if (!versionId) {
        throw new Error(
          `No parsing version available for non-plain-text file: ${params.fileRelativePath}. Please parse the document first.`
        )
      }

      // 读取解析后的 markdown 文件（MinerU 解析结果文件名为 full.md）
      const mdPath = path.join(docDir, versionId, 'full.md')
      try {
        const content = await fs.readFile(mdPath, 'utf-8')
        logger.info(`[ChunkingService] Read parsed document: ${mdPath} (${content.length} chars)`)
        return content
      } catch (error) {
        throw new Error(
          `Failed to read parsed document: ${mdPath} - ${error}. Make sure the document is parsed first.`
        )
      }
    }
  }
}
