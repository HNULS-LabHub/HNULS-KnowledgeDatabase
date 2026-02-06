/**
 * RAG 数据源适配器
 * 通过 IPC 调用后端向量召回服务
 */

import type { RerankModel, LlmModel, RagStep, VectorRecallHit, RagSearchConfig } from './rag.types'
import { MOCK_RERANK_MODELS, MOCK_LLM_MODELS } from './rag.mock'

// ---- Pipeline Step 模板 ----

const STEP_VECTORIZE: RagStep = {
  id: 1,
  text: '正在向量化查询语句...',
  iconPath:
    '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect>',
  colorClass: 'blue',
  status: 'loading'
}

const makeStepSearch = (tableCount: number): RagStep => ({
  id: 2,
  text: `在 ${tableCount} 个向量表中并发检索相似块...`,
  iconPath: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>',
  colorClass: 'purple',
  status: 'loading'
})

const makeStepRecalled = (hitCount: number): RagStep => ({
  id: 3,
  text: `召回 ${hitCount} 个相似块`,
  iconPath:
    '<path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>',
  colorClass: 'amber',
  status: 'completed'
})

const makeStepReranking = (hitCount: number): RagStep => ({
  id: 4,
  text: `正在重排 ${hitCount} 个结果...`,
  iconPath: '<path d="M3 6h18"></path><path d="M7 12h10"></path><path d="M10 18h4"></path>',
  colorClass: 'purple',
  status: 'loading'
})

const makeStepReranked = (hitCount: number): RagStep => ({
  id: 5,
  text: `重排完成，返回 ${hitCount} 个结果`,
  iconPath: '<path d="M3 6h18"></path><path d="M7 12h10"></path><path d="M10 18h4"></path>',
  colorClass: 'amber',
  status: 'completed'
})

const STEP_DONE: RagStep = {
  id: 6,
  text: '检索完成',
  iconPath:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline>',
  colorClass: 'emerald',
  status: 'completed'
}

const STEP_ERROR = (msg: string): RagStep => ({
  id: 99,
  text: `检索失败: ${msg}`,
  iconPath:
    '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
  colorClass: 'amber',
  status: 'error'
})

// ---- 数据源 ----

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

  /**
   * 执行向量召回检索
   * 对选中的每个向量表并发调用 vector-retrieval:search IPC
   * @param tablesMeta - 表元数据 (tableName -> { configName, dimensions })
   */
  async executeSearch(
    query: string,
    config: RagSearchConfig,
    tablesMeta: Map<string, { configName?: string; dimensions?: number }>,
    onStep?: (steps: RagStep[]) => void
  ): Promise<{ steps: RagStep[]; hits: VectorRecallHit[] }> {
    const steps: RagStep[] = []
    const push = (s: RagStep) => {
      // 推新步骤时，将前一步骤标为 completed
      if (steps.length > 0 && steps[steps.length - 1].status === 'loading') {
        steps[steps.length - 1] = { ...steps[steps.length - 1], status: 'completed' }
      }
      steps.push(s)
      onStep?.([...steps])
    }

    // 校验：筛选出已启用的向量表
    const enabledTables = Object.entries(config.embeddingTableConfigs).filter(
      ([_, cfg]) => cfg.enabled
    )

    if (!config.knowledgeBaseId || enabledTables.length === 0) {
      push(STEP_ERROR('请先选择知识库和向量表'))
      return { steps, hits: [] }
    }

    // Step 1: 向量化 + 检索
    push(STEP_VECTORIZE)
    push(makeStepSearch(enabledTables.length))

    const allHits: VectorRecallHit[] = []
    const errors: string[] = []

    // 并发调用所有已启用的表，使用各自的 k 值
    const hasRerank = !!config.rerankModelId
    const results = await Promise.allSettled(
      enabledTables.map(async ([tableName, tableConfig]) => {
        const res = await window.api.vectorRetrieval.search({
          knowledgeBaseId: config.knowledgeBaseId,
          tableName,
          queryText: query,
          k: tableConfig.k,
          ef: config.ef ?? 100,
          // 若启用重排，传递 rerankModelId——后端会在 KNN 召回后自动重排
          ...(hasRerank ? { rerankModelId: config.rerankModelId } : {})
        })
        return { tableName, res }
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { tableName, res } = r.value
        if (res.success && res.data) {
          const meta = tablesMeta.get(tableName)
          for (const hit of res.data) {
            allHits.push({
              ...hit,
              tableName,
              configName: meta?.configName,
              dimensions: meta?.dimensions
            })
          }
        } else if (res.error) {
          errors.push(`[${tableName}] ${res.error}`)
        }
      } else {
        errors.push(r.reason?.message || 'Unknown error')
      }
    }

    if (allHits.length > 0) {
      push(makeStepRecalled(allHits.length))

      if (hasRerank) {
        // 重排已由后端完成，这里只是添加 Pipeline 可视化步骤
        push(makeStepReranking(allHits.length))
        // 按 rerank_score 降序排序
        allHits.sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0))
        push(makeStepReranked(allHits.length))
      } else {
        // 无重排：按 distance 升序排序
        allHits.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      }

      push(STEP_DONE)
    } else {
      const errMsg = errors.length > 0 ? errors.join('; ') : '未找到匹配结果'
      push(STEP_ERROR(errMsg))
    }

    return { steps, hits: allHits }
  }
}
