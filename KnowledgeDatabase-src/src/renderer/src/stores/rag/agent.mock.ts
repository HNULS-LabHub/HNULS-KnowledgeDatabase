/**
 * Agent Mock 数据
 * 模拟完整的 Agent 运行流程事件流
 */

import type { AgentEvent, AgentDoc } from './agent.types'

/** 模拟检索文档 */
const mockDocs: AgentDoc[] = [
  {
    id: 'doc_1',
    title: '深度学习基础',
    content:
      '深度学习是机器学习的一个分支，它使用人工神经网络来模拟人脑的学习过程。深度学习模型通常包含多个隐藏层，能够自动学习数据的层次化特征表示。',
    file_key: 'kb_1_file_101',
    file_name: 'deep_learning_intro.pdf',
    table: 'emb_cfg_1_1024_chunks',
    distance: 0.23,
    rerank_score: 0.87
  },
  {
    id: 'doc_2',
    title: '神经网络架构',
    content:
      '常见的神经网络架构包括卷积神经网络（CNN）、循环神经网络（RNN）和Transformer。CNN主要用于图像处理，RNN用于序列数据，Transformer则在NLP领域取得了突破性进展。',
    file_key: 'kb_1_file_102',
    file_name: 'neural_networks.pdf',
    table: 'emb_cfg_1_1024_chunks',
    distance: 0.31,
    rerank_score: 0.79
  },
  {
    id: 'doc_3',
    title: '训练技巧',
    content:
      '深度学习模型的训练需要注意学习率调整、批量归一化、Dropout正则化等技巧。合理的超参数设置可以大幅提升模型性能并防止过拟合。',
    file_key: 'kb_1_file_103',
    file_name: 'training_tips.pdf',
    table: 'emb_cfg_2_768_chunks',
    distance: 0.38,
    rerank_score: 0.72
  }
]

/** 模拟答案文本（用于流式 token） */
const mockAnswerText = `根据检索到的知识库内容，我来回答您关于深度学习的问题。

深度学习是机器学习的一个重要分支，它通过构建多层人工神经网络来模拟人脑的学习过程。深度学习的核心优势在于能够自动学习数据的层次化特征表示，而无需人工进行特征工程。

在架构方面，深度学习发展出了多种专门化的网络结构：
- **卷积神经网络（CNN）**：主要应用于计算机视觉和图像处理任务
- **循环神经网络（RNN）**：擅长处理序列数据，如时间序列和自然语言
- **Transformer**：在自然语言处理领域带来了革命性突破，现已扩展到多模态领域

训练深度学习模型需要注意以下关键技巧：
1. 学习率调整策略（如学习率衰减、warmup等）
2. 批量归一化（Batch Normalization）加速训练并提升稳定性
3. Dropout等正则化技术防止过拟合
4. 合理的超参数调优

这些技术的综合应用能够显著提升模型的性能和泛化能力。`

/**
 * 模拟完整的 Agent 运行流程
 * @param runId 运行 ID
 * @param eventCallback 事件回调（用于推送到 store）
 */
export async function mockAgentRun(
  runId: string,
  eventCallback: (event: AgentEvent) => void
): Promise<void> {
  const baseTime = Date.now()

  // 辅助函数：等待一段时间
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  // 1. retrieve 节点开始
  await delay(100)
  eventCallback({
    type: 'node_started',
    runId,
    node: 'retrieve',
    at: Date.now(),
    data: { query: '什么是深度学习？' }
  })

  // 2. 工具调用：vectorRetrieval.search
  await delay(200)
  eventCallback({
    type: 'tool_called',
    runId,
    node: 'retrieve',
    tool: 'vector_retrieval',
    at: Date.now(),
    input: {
      query: '什么是深度学习？',
      kbId: 1,
      tables: ['emb_cfg_1_1024_chunks', 'emb_cfg_2_768_chunks'],
      k: 10,
      rerankModelId: 'bge-reranker-v2-m3'
    }
  })

  // 3. 工具结果：检索到的文档
  await delay(800)
  eventCallback({
    type: 'tool_result',
    runId,
    node: 'retrieve',
    tool: 'vector_retrieval',
    at: Date.now(),
    output: { docCount: mockDocs.length }
  })

  // 4. 检索结果事件
  eventCallback({
    type: 'retrieval_results',
    runId,
    at: Date.now(),
    docs: mockDocs
  })

  // 5. retrieve 节点完成
  await delay(100)
  eventCallback({
    type: 'node_completed',
    runId,
    node: 'retrieve',
    at: Date.now(),
    data: { docCount: mockDocs.length }
  })

  // 6. grade 节点开始（评估文档充分性）
  await delay(200)
  eventCallback({
    type: 'node_started',
    runId,
    node: 'grade',
    at: Date.now()
  })

  // 7. grade 节点完成（文档充分，无需重检）
  await delay(600)
  eventCallback({
    type: 'node_completed',
    runId,
    node: 'grade',
    at: Date.now(),
    data: { needMore: false, rationale: '检索到的文档覆盖了深度学习的核心概念、架构和训练技巧，足以回答问题' }
  })

  // 8. generate 节点开始（生成答案）
  await delay(150)
  eventCallback({
    type: 'node_started',
    runId,
    node: 'generate',
    at: Date.now()
  })

  // 9. 流式输出 token（模拟打字机效果）
  const tokens = mockAnswerText.split('')
  for (let i = 0; i < tokens.length; i++) {
    // 每次推送 1-3 个字符
    const chunkSize = Math.floor(Math.random() * 3) + 1
    const chunk = tokens.slice(i, i + chunkSize).join('')
    if (chunk) {
      eventCallback({
        type: 'token',
        runId,
        at: Date.now(),
        text: chunk
      })
    }
    i += chunkSize - 1
    // 随机延迟 10-30ms
    await delay(Math.random() * 20 + 10)
  }

  // 10. generate 节点完成
  await delay(100)
  eventCallback({
    type: 'node_completed',
    runId,
    node: 'generate',
    at: Date.now()
  })

  // 11. ground_citations 节点开始（生成引用）
  await delay(200)
  eventCallback({
    type: 'node_started',
    runId,
    node: 'ground_citations',
    at: Date.now()
  })

  // 12. ground_citations 节点完成
  await delay(500)
  eventCallback({
    type: 'node_completed',
    runId,
    node: 'ground_citations',
    at: Date.now(),
    data: { citationCount: 3 }
  })

  // 13. 运行完成
  await delay(100)
  eventCallback({
    type: 'run_completed',
    runId,
    at: Date.now(),
    citations: [
      { docId: 'doc_1', rationale: '深度学习定义与核心概念' },
      { docId: 'doc_2', rationale: '神经网络架构类型' },
      { docId: 'doc_3', rationale: '训练技巧与正则化方法' }
    ]
  })
}

/**
 * 模拟带重检的 Agent 运行流程
 */
export async function mockAgentRunWithRetrieve(
  runId: string,
  eventCallback: (event: AgentEvent) => void
): Promise<void> {
  // 第一次检索
  eventCallback({ type: 'node_started', runId, node: 'retrieve', at: Date.now() })
  await new Promise((resolve) => setTimeout(resolve, 500))
  eventCallback({
    type: 'retrieval_results',
    runId,
    at: Date.now(),
    docs: [mockDocs[0]] // 只返回 1 个文档
  })
  eventCallback({ type: 'node_completed', runId, node: 'retrieve', at: Date.now() })

  // grade 判断需要更多文档
  await new Promise((resolve) => setTimeout(resolve, 300))
  eventCallback({ type: 'node_started', runId, node: 'grade', at: Date.now() })
  await new Promise((resolve) => setTimeout(resolve, 400))
  eventCallback({
    type: 'node_completed',
    runId,
    node: 'grade',
    at: Date.now(),
    data: { needMore: true, rationale: '文档数量不足，需要更多关于神经网络架构和训练技巧的内容' }
  })

  // 第二次检索（重检）
  await new Promise((resolve) => setTimeout(resolve, 200))
  eventCallback({ type: 'node_started', runId, node: 'retrieve', at: Date.now() })
  await new Promise((resolve) => setTimeout(resolve, 600))
  eventCallback({
    type: 'retrieval_results',
    runId,
    at: Date.now(),
    docs: mockDocs // 返回所有文档
  })
  eventCallback({ type: 'node_completed', runId, node: 'retrieve', at: Date.now() })

  // 继续后续流程...
  await new Promise((resolve) => setTimeout(resolve, 200))
  eventCallback({ type: 'node_started', runId, node: 'generate', at: Date.now() })

  // 流式输出
  const tokens = mockAnswerText.split('')
  for (let i = 0; i < tokens.length; i += 3) {
    const chunk = tokens.slice(i, i + 3).join('')
    if (chunk) {
      eventCallback({ type: 'token', runId, at: Date.now(), text: chunk })
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  eventCallback({ type: 'node_completed', runId, node: 'generate', at: Date.now() })
  eventCallback({
    type: 'run_completed',
    runId,
    at: Date.now(),
    citations: [
      { docId: 'doc_1', rationale: '深度学习基础概念' },
      { docId: 'doc_2', rationale: '神经网络架构' },
      { docId: 'doc_3', rationale: '训练技巧' }
    ]
  })
}

/**
 * 模拟失败的 Agent 运行
 */
export async function mockAgentRunWithError(
  runId: string,
  eventCallback: (event: AgentEvent) => void
): Promise<void> {
  eventCallback({ type: 'node_started', runId, node: 'retrieve', at: Date.now() })
  await new Promise((resolve) => setTimeout(resolve, 300))

  // 模拟检索失败
  eventCallback({
    type: 'error',
    runId,
    at: Date.now(),
    message: '检索服务超时：无法连接到向量数据库',
    node: 'retrieve',
    stack: 'Error: Connection timeout at VectorRetrieval.search()'
  })
}
