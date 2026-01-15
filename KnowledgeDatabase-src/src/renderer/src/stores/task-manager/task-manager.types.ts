// 使用 window.api 的类型定义
export type ImportProgress = Parameters<Parameters<typeof window.api.fileImport.onProgress>[0]>[0]
export type ImportResult = Awaited<ReturnType<typeof window.api.fileImport.import>>

export interface ImportTask {
  taskId: string
  knowledgeBaseId: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: ImportProgress | null
  result: ImportResult | null
  error: string | null
  startTime: number
  endTime: number | null
}
