/**
 * 知识图谱检索数据源适配器
 * 调用真实 IPC：window.api.knowledgeGraph.retrievalSearch
 */

import type { KGRetrievalParams, KGRetrievalResult } from '@preload/types'

export const KGSearchDataSource = {
  /** 执行知识图谱检索 */
  async search(params: KGRetrievalParams): Promise<KGRetrievalResult> {
    return window.api.knowledgeGraph.retrievalSearch(params)
  }
}
