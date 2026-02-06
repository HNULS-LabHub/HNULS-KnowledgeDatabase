/**
 * @file RAG Agent 图定义
 * @description 使用 LangGraph.js 定义 State、节点、条件路由并编译图
 *
 * 图结构：
 *   START → retrieve → grade ─(needMore=true)─→ retrieve（循环，最多 N 次）
 *                            └─(needMore=false)→ generate → END
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import type { ChatOpenAI } from '@langchain/openai'
import type { VectorRetrievalService } from '../vector-retrieval/vector-retrieval-service'
import type { AgentEvent } from '../../../renderer/src/stores/rag/agent.types'
import { logger } from '../logger'
import {
  GRADE_SYSTEM_PROMPT,
  GENERATE_SYSTEM_PROMPT,
  buildGradeUserMessage,
  buildGenerateUserMessage,
  summarizeDocs,
  buildDocContext
} from './prompts'

// ============================================================================
// 类型
// ============================================================================

/** 检索到的文档 */
export interface RetrievedDoc {
  id: string
  content: string
  chunk_index?: number
  file_key?: string
  file_name?: string
  table: string
  distance?: number
  rerank_score?: number
}

/** 文档相关性评估结果 */
export interface GradeResult {
  needMore: boolean
  rationale: string
}

/** 运行时参数（透传，不由节点修改） */
export interface AgentMeta {
  kbId: number
  tables: string[]
  rerankModelId?: string
  llmModelId: string
  k?: number
  ef?: number
  rerankTopN?: number
}

// ============================================================================
// State 定义（LangGraph Annotation）
// ============================================================================

export const RAGAgentState = Annotation.Root({
  /** 用户问题 */
  question: Annotation<string>,

  /** 检索到的文档（多次检索时追加） */
  documents: Annotation<RetrievedDoc[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),

  /** 最终答案 */
  answer: Annotation<string>,

  /** 文档评估结果 */
  gradeResult: Annotation<GradeResult | null>,

  /** 当前迭代次数 */
  iteration: Annotation<number>,

  /** 运行参数 */
  meta: Annotation<AgentMeta>
})

/** State 类型快捷引用 */
export type RAGAgentStateType = typeof RAGAgentState.State

// ============================================================================
// 最大迭代次数
// ============================================================================

const MAX_ITERATIONS = 3

// ============================================================================
// 节点工厂（闭包注入依赖）
// ============================================================================

export interface GraphDeps {
  vectorRetrievalService: VectorRetrievalService
  chatModel: ChatOpenAI
  emitEvent: (event: AgentEvent) => void
  runId: string
}

/**
 * 创建 retrieve 节点
 * 调用 VectorRetrievalService 执行向量检索
 */
function createRetrieveNode(deps: GraphDeps) {
  return async (state: RAGAgentStateType) => {
    const { meta, question } = state
    const now = Date.now()

    deps.emitEvent({ type: 'node_started', runId: deps.runId, node: 'retrieve', at: now })

    const allDocs: RetrievedDoc[] = []

    for (const table of meta.tables) {
      try {
        const params = {
          knowledgeBaseId: meta.kbId,
          tableName: table,
          queryText: question,
          k: meta.k ?? 10,
          ef: meta.ef ?? 100,
          rerankModelId: meta.rerankModelId,
          rerankTopN: meta.rerankTopN
        }

        const { results } = meta.rerankModelId
          ? await deps.vectorRetrievalService.searchWithRerank(params)
          : await deps.vectorRetrievalService.search(params)

        const docs: RetrievedDoc[] = results.map((hit) => ({
          id: typeof hit.id === 'object' ? String(hit.id) : hit.id,
          content: hit.content,
          chunk_index: hit.chunk_index,
          file_key: hit.file_key,
          file_name: hit.file_name,
          table,
          distance: hit.distance,
          rerank_score: hit.rerank_score
        }))

        allDocs.push(...docs)
      } catch (err) {
        logger.warn('[RAGAgent] Retrieve failed for table', { table, error: String(err) })
      }
    }

    logger.info('[RAGAgent] Retrieve completed', {
      docCount: allDocs.length,
      iteration: state.iteration + 1
    })

    // 推送检索结果事件
    deps.emitEvent({
      type: 'retrieval_results',
      runId: deps.runId,
      at: Date.now(),
      docs: allDocs.map((d) => ({
        id: d.id,
        content: d.content,
        file_key: d.file_key,
        file_name: d.file_name,
        table: d.table,
        rerank_score: d.rerank_score,
        distance: d.distance
      }))
    })

    deps.emitEvent({
      type: 'node_completed',
      runId: deps.runId,
      node: 'retrieve',
      at: Date.now(),
      data: { docCount: allDocs.length }
    })

    return {
      documents: allDocs,
      iteration: state.iteration + 1
    }
  }
}

/**
 * 创建 grade 节点
 * 调用 LLM 评估文档相关性
 */
function createGradeNode(deps: GraphDeps) {
  return async (state: RAGAgentStateType) => {
    const now = Date.now()
    deps.emitEvent({ type: 'node_started', runId: deps.runId, node: 'grade', at: now })

    // 如果没有文档，直接标记 needMore
    if (state.documents.length === 0) {
      const result: GradeResult = { needMore: true, rationale: '没有检索到任何文档' }

      deps.emitEvent({
        type: 'node_completed',
        runId: deps.runId,
        node: 'grade',
        at: Date.now(),
        data: result
      })

      return { gradeResult: result }
    }

    try {
      const docSummary = summarizeDocs(state.documents)
      const userMsg = buildGradeUserMessage(state.question, docSummary)

      const response = await deps.chatModel.invoke([
        { role: 'system', content: GRADE_SYSTEM_PROMPT },
        { role: 'user', content: userMsg }
      ])

      const text = typeof response.content === 'string' ? response.content : ''

      // 提取 JSON（处理 LLM 可能包裹 markdown code block 的情况）
      const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(jsonStr) as GradeResult

      const result: GradeResult = {
        needMore: Boolean(parsed.needMore),
        rationale: String(parsed.rationale || '')
      }

      logger.info('[RAGAgent] Grade completed', result)

      deps.emitEvent({
        type: 'node_completed',
        runId: deps.runId,
        node: 'grade',
        at: Date.now(),
        data: result
      })

      return { gradeResult: result }
    } catch (err) {
      logger.warn('[RAGAgent] Grade LLM call failed, defaulting to generate', {
        error: String(err)
      })

      // 解析失败时默认不再检索，直接生成
      const fallback: GradeResult = {
        needMore: false,
        rationale: 'Grade 解析失败，默认进入生成'
      }

      deps.emitEvent({
        type: 'node_completed',
        runId: deps.runId,
        node: 'grade',
        at: Date.now(),
        data: fallback
      })

      return { gradeResult: fallback }
    }
  }
}

/**
 * 创建 generate 节点
 * 调用 LLM 流式生成答案，逐 token 推送
 */
function createGenerateNode(deps: GraphDeps) {
  return async (state: RAGAgentStateType) => {
    const now = Date.now()
    deps.emitEvent({ type: 'node_started', runId: deps.runId, node: 'generate', at: now })

    const docContext = buildDocContext(state.documents)
    const userMsg = buildGenerateUserMessage(state.question, docContext)

    let answer = ''

    try {
      const stream = await deps.chatModel.stream([
        { role: 'system', content: GENERATE_SYSTEM_PROMPT },
        { role: 'user', content: userMsg }
      ])

      for await (const chunk of stream) {
        const text = typeof chunk.content === 'string' ? chunk.content : ''
        if (text) {
          answer += text
          deps.emitEvent({
            type: 'token',
            runId: deps.runId,
            at: Date.now(),
            text
          })
        }
      }
    } catch (err) {
      logger.error('[RAGAgent] Generate failed', { error: String(err) })
      deps.emitEvent({
        type: 'error',
        runId: deps.runId,
        at: Date.now(),
        message: `生成答案失败: ${err instanceof Error ? err.message : String(err)}`,
        node: 'generate'
      })
      throw err
    }

    logger.info('[RAGAgent] Generate completed', { answerLength: answer.length })

    deps.emitEvent({
      type: 'node_completed',
      runId: deps.runId,
      node: 'generate',
      at: Date.now(),
      data: { answerLength: answer.length }
    })

    return { answer }
  }
}

/**
 * 条件路由函数
 * 根据 gradeResult 决定下一步走 retrieve 还是 generate
 */
function gradeRouter(state: RAGAgentStateType): string {
  if (state.gradeResult?.needMore && state.iteration < MAX_ITERATIONS) {
    logger.info('[RAGAgent] Grade router → retrieve (iteration %d)', state.iteration)
    return 'retrieve'
  }
  logger.info('[RAGAgent] Grade router → generate')
  return 'generate'
}

// ============================================================================
// 图构建
// ============================================================================

/**
 * 构建并编译 RAG Agent 图
 * 每次运行创建新图实例（因为节点通过闭包绑定了运行时依赖）
 */
export function buildRAGAgentGraph(deps: GraphDeps) {
  const graph = new StateGraph(RAGAgentState)
    .addNode('retrieve', createRetrieveNode(deps))
    .addNode('grade', createGradeNode(deps))
    .addNode('generate', createGenerateNode(deps))
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'grade')
    .addConditionalEdges('grade', gradeRouter, {
      retrieve: 'retrieve',
      generate: 'generate'
    })
    .addEdge('generate', END)

  return graph.compile()
}
