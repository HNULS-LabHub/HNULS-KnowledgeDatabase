/**
 * @file 重排模块类型定义
 * @description 定义重排请求参数、结果和策略接口
 */

/**
 * 重排请求参数
 */
export interface RerankParams {
  /** API BaseURL */
  baseUrl: string
  /** API Key */
  apiKey: string
  /** 重排模型 ID */
  model: string
  /** 查询文本 */
  query: string
  /** 待重排的文档内容列表 */
  documents: string[]
  /** 返回的 top N 数量 */
  topN: number
  /** 自定义请求头 */
  headers?: Record<string, string>
}

/**
 * 单条重排结果
 */
export interface RerankResult {
  /** 原始文档在 documents 数组中的索引 */
  index: number
  /** 相关性分数（越高越相关） */
  relevance_score: number
}

/**
 * 重排策略接口（策略模式）
 */
export interface RerankStrategy {
  /** 构建请求 URL */
  buildUrl(baseURL: string): string
  /** 构建请求体 */
  buildRequestBody(
    query: string,
    documents: string[],
    topN: number,
    model: string
  ): Record<string, unknown>
  /** 从响应中提取重排结果 */
  extractResults(data: unknown): RerankResult[]
}
