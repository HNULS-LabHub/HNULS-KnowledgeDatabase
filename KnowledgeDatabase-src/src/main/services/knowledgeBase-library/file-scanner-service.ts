import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '../logger'
import type { FileNode } from '../../../renderer/src/stores/knowledge-library/file.types'

/**
 * 文件扫描服务
 * 负责扫描指定目录下的所有文件
 */
export class FileScannerService {
  /**
   * 扫描指定目录下的所有文件
   * @param directoryPath 要扫描的目录路径
   * @returns 文件列表（扁平数组）
   */
  async scanDirectory(directoryPath: string): Promise<FileNode[]> {
    const files: FileNode[] = []

    try {
      // 检查目录是否存在
      try {
        const stats = await fs.stat(directoryPath)
        if (!stats.isDirectory()) {
          logger.warn(`Path is not a directory: ${directoryPath}`)
          return files
        }
      } catch {
        logger.warn(`Directory does not exist: ${directoryPath}`)
        return files
      }

      // 递归扫描目录
      await this.scanDirectoryRecursive(directoryPath, directoryPath, files)

      logger.info(`Scanned ${files.length} files from directory: ${directoryPath}`)
    } catch (error) {
      logger.error('Failed to scan directory', error)
      throw error
    }

    return files
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectoryRecursive(
    basePath: string,
    currentPath: string,
    files: FileNode[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        // 忽略隐藏文件和系统文件
        if (entry.name.startsWith('.') || this.isSystemFile(entry.name)) {
          continue
        }

        const fullPath = path.join(currentPath, entry.name)
        const relativePath = path.relative(basePath, fullPath)

        if (entry.isDirectory()) {
          // 递归处理子目录
          await this.scanDirectoryRecursive(basePath, fullPath, files)
        } else if (entry.isFile()) {
          // 处理文件
          const fileNode = await this.createFileNode(fullPath, relativePath, entry.name)
          files.push(fileNode)
        }
      }
    } catch (error) {
      logger.error(`Failed to scan directory: ${currentPath}`, error)
      // 继续扫描其他文件，不中断整个流程
    }
  }

  /**
   * 创建文件节点
   */
  private async createFileNode(
    fullPath: string,
    relativePath: string,
    fileName: string
  ): Promise<FileNode> {
    try {
      const stats = await fs.stat(fullPath)
      const extension = this.getFileExtension(fileName)
      const size = await this.formatFileSize(stats.size)

      return {
        id: relativePath.replace(/\\/g, '/'), // 统一使用正斜杠
        name: fileName,
        type: 'file',
        size,
        path: relativePath.replace(/\\/g, '/'),
        extension,
        updateTime: stats.mtime.toISOString()
      }
    } catch (error) {
      logger.error(`Failed to create file node for: ${fullPath}`, error)
      // 返回基本信息，即使获取详细信息失败
      return {
        id: relativePath.replace(/\\/g, '/'),
        name: fileName,
        type: 'file',
        path: relativePath.replace(/\\/g, '/'),
        extension: this.getFileExtension(fileName)
      }
    }
  }

  /**
   * 获取文件大小（格式化）
   */
  private async formatFileSize(bytes: number): Promise<string> {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    if (lastDot === -1 || lastDot === fileName.length - 1) {
      return ''
    }
    return fileName.substring(lastDot + 1).toLowerCase()
  }

  /**
   * 判断是否为系统文件
   */
  private isSystemFile(fileName: string): boolean {
    const systemFiles = ['Thumbs.db', 'desktop.ini', '.DS_Store', '.gitkeep']
    return systemFiles.includes(fileName)
  }
}
