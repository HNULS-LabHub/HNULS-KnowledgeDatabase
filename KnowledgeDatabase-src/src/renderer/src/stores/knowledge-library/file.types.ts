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
  /** 解析状态 */
  status?: 'parsed' | 'parsing' | 'failed' | 'pending' | 'embedded'
  /** 分块数量 */
  chunkCount?: number
  /** 嵌入信息（当文件已有嵌入向量时） */
  embeddingInfo?: Array<{
    configName: string
    dimensions: number
    status: 'pending' | 'running' | 'completed' | 'failed'
  }>
  /** 解析相关元数据（当前阶段为空） */
  metadata?: {
    tokenCount?: number
    embeddingModel?: string
    parseTime?: string
    md5?: string
  }
}

/**
 * 树形节点接口（用于树形视图）
 */
export interface TreeNode extends FileNode {
  /** 子节点列表 */
  children?: TreeNode[]
  /** 层级深度（从0开始） */
  level?: number
}
