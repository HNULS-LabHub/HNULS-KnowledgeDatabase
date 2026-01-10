// 导出所有 API 相关的类型定义

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface TestPingResult {
  success: boolean
  message: string
  timestamp: number
}

export interface TestEchoResult {
  success: boolean
  echo: string
}

// TODO: 添加其他业务域的类型定义
// export interface FileReadResult extends APIResponse<string> {}
// export interface FileWriteResult extends APIResponse {}
// export interface FileListResult extends APIResponse<FileNode[]> {}
