import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '../logger'
import { DocumentService } from './document-service'
import { KnowledgeLibraryService } from './knowledge-library-service'
import { KnowledgeConfigService } from './knowledge-config-service'

export interface FileMoveOptions {
  conflictPolicy?: 'rename' | 'skip' | 'overwrite'
}

export interface MoveResult {
  success: boolean
  newPath?: string
  error?: string
}

export interface BatchMoveResult {
  total: number
  success: number
  failed: number
  results: Array<{
    source: string
    target: string
    success: boolean
    error?: string
    newPath?: string
  }>
}

/**
 * 文件移动服务
 * 负责在知识库内部移动文件/目录
 */
export class FileMoveService {
  constructor(
    private knowledgeLibraryService: KnowledgeLibraryService,
    private documentService: DocumentService,
    private knowledgeConfigService: KnowledgeConfigService
  ) {}

  /**
   * 移动文件/目录到新位置（知识库内部）
   * @param knowledgeBaseId 知识库ID
   * @param sourcePath 源路径（相对路径，如 "folder/file.txt"）
   * @param targetPath 目标目录路径（相对路径，如 "newFolder" 或 "" 表示根目录）
   * @param conflictPolicy 冲突处理策略
   * @returns 移动结果
   */
  async moveFileOrDirectory(
    knowledgeBaseId: number,
    sourcePath: string,
    targetPath: string,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<MoveResult> {
    logger.info('[FileMoveService] moveFileOrDirectory started', {
      knowledgeBaseId,
      sourcePath,
      targetPath,
      conflictPolicy
    })

    try {
      // 获取知识库元数据
      const kb = await this.knowledgeLibraryService.getById(knowledgeBaseId)
      if (!kb || !kb.documentPath) {
        logger.error('[FileMoveService] Knowledge base not found or missing documentPath', {
          knowledgeBaseId,
          kb
        })
        return {
          success: false,
          error: `Knowledge base ${knowledgeBaseId} not found or missing documentPath`
        }
      }

      // 确保目录存在
      await this.documentService.ensureKnowledgeBaseDirectory(kb.documentPath)
      const basePath = this.documentService.getFullDirectoryPath(kb.documentPath)

      // 构建完整路径
      const fullSourcePath = path.join(basePath, sourcePath)
      const targetDirPath = targetPath ? path.join(basePath, targetPath) : basePath
      const fileName = path.basename(sourcePath)
      const fullTargetPath = path.join(targetDirPath, fileName)

      // 验证源路径存在
      let sourceStats: Awaited<ReturnType<typeof fs.stat>> | null = null
      try {
        await fs.access(fullSourcePath)
        sourceStats = await fs.stat(fullSourcePath)
      } catch {
        return {
          success: false,
          error: `Source path does not exist: ${sourcePath}`
        }
      }

      // 验证不能移动到自身或子目录
      const normalizedSource = path.normalize(fullSourcePath)
      const normalizedTarget = path.normalize(fullTargetPath)
      if (normalizedSource === normalizedTarget) {
        return {
          success: false,
          error: 'Cannot move to the same location'
        }
      }

      // 检查目标是否是源的子目录
      const relativePath = path.relative(normalizedSource, normalizedTarget)
      if (!relativePath.startsWith('..') && relativePath !== '') {
        return {
          success: false,
          error: 'Cannot move directory into itself or its subdirectory'
        }
      }

      // 确保目标目录存在
      await fs.mkdir(targetDirPath, { recursive: true })

      // 处理冲突
      const finalTargetPath = await this.getWritablePath(fullTargetPath, conflictPolicy)
      if (!finalTargetPath) {
        return {
          success: false,
          error: 'File exists and conflict policy is skip'
        }
      }

      // 执行移动
      await fs.rename(fullSourcePath, finalTargetPath)

      // 计算相对路径
      const relativeNewPath = path.relative(basePath, finalTargetPath).replace(/\\/g, '/')

      logger.info('[FileMoveService] Move completed', {
        sourcePath,
        targetPath: relativeNewPath
      })

      // 同步 KnowledgeConfig（不影响移动主流程）
      try {
        if (sourceStats?.isDirectory()) {
          await this.knowledgeConfigService.moveDocumentKeysByPrefix(
            basePath,
            sourcePath,
            relativeNewPath
          )
        } else {
          await this.knowledgeConfigService.moveDocumentKey(basePath, sourcePath, relativeNewPath)
        }
      } catch (configError) {
        logger.warn('[FileMoveService] Failed to sync KnowledgeConfig after move', {
          knowledgeBaseId,
          sourcePath,
          targetPath: relativeNewPath,
          error: configError
        })
      }

      // 同步 SurrealDB（不影响移动主流程）
      try {
        if (sourceStats?.isDirectory()) {
          await this.knowledgeLibraryService.syncMovedDirectoryToSurrealDB({
            knowledgeBaseId,
            oldPrefix: sourcePath,
            newPrefix: relativeNewPath
          })
        } else {
          await this.knowledgeLibraryService.syncMovedFileToSurrealDB({
            knowledgeBaseId,
            oldFileKey: sourcePath,
            newFileKey: relativeNewPath
          })
        }
      } catch (dbError) {
        logger.warn('[FileMoveService] Failed to sync SurrealDB after move', {
          knowledgeBaseId,
          sourcePath,
          targetPath: relativeNewPath,
          error: dbError
        })
      }

      return {
        success: true,
        newPath: relativeNewPath
      }
    } catch (error) {
      logger.error('[FileMoveService] Failed to move file', {
        knowledgeBaseId,
        sourcePath,
        targetPath,
        error
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 批量移动文件/目录
   * @param knowledgeBaseId 知识库ID
   * @param moves 移动操作列表
   * @param conflictPolicy 冲突处理策略
   * @returns 批量移动结果
   */
  async moveMultiple(
    knowledgeBaseId: number,
    moves: Array<{ source: string; target: string }>,
    conflictPolicy: 'rename' | 'skip' | 'overwrite' = 'rename'
  ): Promise<BatchMoveResult> {
    logger.info('[FileMoveService] moveMultiple started', {
      knowledgeBaseId,
      movesCount: moves.length,
      conflictPolicy
    })

    const result: BatchMoveResult = {
      total: moves.length,
      success: 0,
      failed: 0,
      results: []
    }

    // 逐个移动（避免并发冲突）
    for (const move of moves) {
      const moveResult = await this.moveFileOrDirectory(
        knowledgeBaseId,
        move.source,
        move.target,
        conflictPolicy
      )

      result.results.push({
        source: move.source,
        target: move.target,
        success: moveResult.success,
        error: moveResult.error,
        newPath: moveResult.newPath
      })

      if (moveResult.success) {
        result.success++
      } else {
        result.failed++
      }
    }

    logger.info('[FileMoveService] Batch move completed', result)
    return result
  }

  /**
   * 删除文件/目录
   * @param knowledgeBaseId 知识库ID
   * @param filePath 文件/目录路径（相对路径，如 "folder/file.txt"）
   * @returns 删除结果
   */
  async deleteFileOrDirectory(
    knowledgeBaseId: number,
    filePath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 获取知识库元数据
      const knowledgeBase = await this.knowledgeLibraryService.getById(knowledgeBaseId)

      if (!knowledgeBase) {
        return {
          success: false,
          error: `Knowledge base with id ${knowledgeBaseId} not found`
        }
      }

      // 检查是否有文档目录
      if (!knowledgeBase.documentPath) {
        return {
          success: false,
          error: 'Knowledge base has no document directory'
        }
      }

      // 获取完整目录路径
      const baseDirectory = this.documentService.getFullDirectoryPath(knowledgeBase.documentPath)

      // 构建完整文件路径
      const fullFilePath = path.join(baseDirectory, filePath)

      // 安全检查：确保目标路径在知识库目录内
      const normalizedBase = path.normalize(baseDirectory)
      const normalizedTarget = path.normalize(fullFilePath)

      if (!normalizedTarget.startsWith(normalizedBase)) {
        logger.error(
          '[FileMoveService] Security check failed: path outside knowledge base directory',
          {
            baseDirectory: normalizedBase,
            targetPath: normalizedTarget
          }
        )
        return {
          success: false,
          error: 'Invalid file path: path outside knowledge base directory'
        }
      }

      // 检查文件/目录是否存在
      try {
        const stats = await fs.stat(fullFilePath)

        // 删除文件或目录
        const isDirectory = stats.isDirectory()
        if (isDirectory) {
          await fs.rm(fullFilePath, { recursive: true, force: true })
          logger.info('[FileMoveService] Deleted directory', {
            knowledgeBaseId,
            filePath,
            fullPath: fullFilePath
          })
        } else {
          await fs.unlink(fullFilePath)
          logger.info('[FileMoveService] Deleted file', {
            knowledgeBaseId,
            filePath,
            fullPath: fullFilePath
          })
        }

        // 清理配置文件中的相关配置
        try {
          await this.knowledgeConfigService.cleanupDocumentConfig(baseDirectory, filePath)
          logger.info('[FileMoveService] Cleaned up document config', {
            knowledgeBaseId,
            filePath
          })
        } catch (configError) {
          // 配置清理失败不影响删除操作
          logger.warn('[FileMoveService] Failed to cleanup document config', {
            knowledgeBaseId,
            filePath,
            error: configError
          })
        }

        // 同步 SurrealDB 删除（不影响删除主流程）
        try {
          await this.knowledgeLibraryService.syncDeletedPathToSurrealDB({
            knowledgeBaseId,
            filePath,
            isDirectory
          })
        } catch (dbError) {
          logger.warn('[FileMoveService] Failed to sync SurrealDB after delete', {
            knowledgeBaseId,
            filePath,
            isDirectory,
            error: dbError
          })
        }

        return {
          success: true
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return {
            success: false,
            error: 'File or directory not found'
          }
        }
        throw error
      }
    } catch (error) {
      logger.error('[FileMoveService] Failed to delete file/directory', {
        knowledgeBaseId,
        filePath,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 根据冲突策略返回可写路径
   */
  private async getWritablePath(
    targetPath: string,
    conflictPolicy: 'rename' | 'skip' | 'overwrite'
  ): Promise<string | null> {
    try {
      await fs.access(targetPath)
      // 文件/目录已存在

      if (conflictPolicy === 'skip') {
        return null // 跳过
      }

      if (conflictPolicy === 'overwrite') {
        // 检查是否是目录
        const stats = await fs.stat(targetPath)
        if (stats.isDirectory()) {
          // 目录不能直接覆盖，需要先删除
          await fs.rm(targetPath, { recursive: true, force: true })
        }
        return targetPath
      }

      // rename: 生成新名称
      const { dir, name, ext } = path.parse(targetPath)
      let counter = 1
      let candidate = path.join(dir, `${name} (${counter})${ext}`)

      // 检查是否是目录
      const stats = await fs.stat(targetPath)
      if (stats.isDirectory()) {
        // 目录没有扩展名
        candidate = path.join(dir, `${name} (${counter})`)
      }

      while (true) {
        try {
          await fs.access(candidate)
          counter++
          if (stats.isDirectory()) {
            candidate = path.join(dir, `${name} (${counter})`)
          } else {
            candidate = path.join(dir, `${name} (${counter})${ext}`)
          }
        } catch {
          return candidate
        }
      }
    } catch {
      // 不存在，直接使用
      return targetPath
    }
  }
}
