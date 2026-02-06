/**
 * RAG Mock 数据生成器
 */

import type { RerankModel, LlmModel, RagStep } from './rag.types'

/** 可用重排模型 */
export const MOCK_RERANK_MODELS: RerankModel[] = [
  { id: 'cohere-rerank-v3', name: 'Cohere Rerank V3', provider: 'Cohere' },
  { id: 'bge-reranker-v2-m3', name: 'BGE Reranker V2 M3', provider: 'BAAI' },
  { id: 'bge-reranker-large', name: 'BGE Reranker Large', provider: 'BAAI' },
  { id: 'jina-reranker-v1', name: 'Jina Reranker V1', provider: 'Jina' }
]

/** 可用 LLM 模型 */
export const MOCK_LLM_MODELS: LlmModel[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'qwen-max', name: 'Qwen Max', provider: 'Alibaba' }
]

/** 模拟检索流水线 */
export async function mockExecuteSearch(
  _query: string,
  onStep?: (steps: RagStep[]) => void
): Promise<RagStep[]> {
  const timeline: RagStep[] = [
    {
      id: 1,
      text: '正在向量化查询语句...',
      iconPath:
        '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect>',
      colorClass: 'blue'
    },
    {
      id: 2,
      text: '在 128 维空间中检索相似块...',
      iconPath:
        '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>',
      colorClass: 'purple'
    },
    {
      id: 3,
      text: '重排序 (Re-ranking) Top-K 结果...',
      iconPath:
        '<path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
      colorClass: 'amber'
    },
    {
      id: 4,
      text: '上下文组装完成',
      iconPath:
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline>',
      colorClass: 'emerald'
    }
  ]

  const accumulated: RagStep[] = []
  for (let i = 0; i < timeline.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    accumulated.push(timeline[i])
    onStep?.([...accumulated])
  }

  return accumulated
}
