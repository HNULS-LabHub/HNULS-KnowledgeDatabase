/**
 * RAG 数据源适配器
 * 当前阶段指向 mock，后续切换为 IPC
 */

import type { RerankModel, LlmModel, RagStep } from './rag.types'
import { MOCK_RERANK_MODELS, MOCK_LLM_MODELS, mockExecuteSearch } from './rag.mock'

// const isElectron = !!(window as any).electron

export const RagDataSource = {
  /** 获取可用重排模型列表 */
  async getRerankModels(): Promise<RerankModel[]> {
    // TODO: 后续切换为 IPC 调用
    console.debug('[Dev Mode] Using Mock Rerank Models')
    return MOCK_RERANK_MODELS
  },

  /** 获取可用 LLM 模型列表 */
  async getLlmModels(): Promise<LlmModel[]> {
    // TODO: 后续切换为 IPC 调用
    console.debug('[Dev Mode] Using Mock LLM Models')
    return MOCK_LLM_MODELS
  },

  /** 执行检索流程 */
  async executeSearch(
    query: string,
    onStep?: (steps: RagStep[]) => void
  ): Promise<RagStep[]> {
    // TODO: 后续切换为 IPC 调用
    console.debug('[Dev Mode] Using Mock Search')
    return mockExecuteSearch(query, onStep)
  }
}
