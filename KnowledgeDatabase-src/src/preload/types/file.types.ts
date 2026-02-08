/**
 * 文件业务域类型定义
 */

/**
 * 文件节点接口
 */
export interface FileNode {
  /** 文件唯一标识（文件名或路径hash） */
  id: string | number
  /** 文件名（不含路径） */
  name: string
  /** 类型：文件或文件夹 */
  type: 'file' | 'folder'
  /** 文件大小（格式化字符串，如 "2.4 MB"） */
  size?: string
  /** 文件完整路径（相对于知识库文档目录） */
  path?: string
  /** 文件扩展名（不含点号，如 "pdf"） */
  extension?: string
  /** 更新时间（ISO格式或格式化字符串） */
  updateTime?: string
  /** 上传时间（ISO格式或格式化字符串） */
  uploadTime?: string
  /** 解析状态（当前阶段为空） */
  status?: 'parsed' | 'parsing' | 'failed' | 'pending' | 'embedded'
  /** 分块数量（当前阶段为空） */
  chunkCount?: number
  /** 嵌入信息（当文件已有嵌入向量时） */
  embeddingInfo?: {
    configName: string  // 嵌入模型配置名，如 "text-embedding-3-small"
    dimensions: number  // 向量维度
    status: 'pending' | 'running' | 'completed' | 'failed'  // 嵌入任务状态
  }[]
  /** 解析相关元数据（当前阶段为空） */
  metadata?: {
    tokenCount?: number
    embeddingModel?: string
    parseTime?: string
    md5?: string
  }
}

/**
 * 文件移动选项
 */
export interface FileMoveOptions {
  conflictPolicy?: 'rename' | 'skip' | 'overwrite'
}

/**
 * 文件移动结果
 */
export interface MoveResult {
  success: boolean
  newPath?: string
  error?: string
}

/**
 * 批量移动结果
 */
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
 * 文件 API 接口定义
 */
export interface FileAPI {
  getAll(knowledgeBaseId: number): Promise<FileNode[]>
  scanDirectory(knowledgeBaseId: number): Promise<FileNode[]>
  moveFile(
    knowledgeBaseId: number,
    sourcePath: string,
    targetPath: string,
    conflictPolicy?: 'rename' | 'skip' | 'overwrite'
  ): Promise<MoveResult>
  moveMultiple(
    knowledgeBaseId: number,
    moves: Array<{ source: string; target: string }>,
    conflictPolicy?: 'rename' | 'skip' | 'overwrite'
  ): Promise<BatchMoveResult>
  deleteFile(
    knowledgeBaseId: number,
    filePath: string
  ): Promise<{ success: boolean; error?: string }>
}
