/**
 * @file 知识图谱测试 - 数据源
 * @description 封装 IPC 调用，支持 mock 切换
 */

import type { LLMChatRequest, LLMChatResponse } from './kg-test.types'

const USE_MOCK = false // 开发时可切换为 true

// ============================================================================
// Mock 实现
// ============================================================================

async function mockLLMChat(request: LLMChatRequest): Promise<LLMChatResponse> {
  // 模拟延迟
  await new Promise((r) => setTimeout(r, 1500))

  // 模拟响应
  return {
    content: `entity<|#|>张三<|#|>人物<|#|>一个测试人物
entity<|#|>北京<|#|>地点<|#|>中国首都
relation<|#|>张三<|#|>北京<|#|>居住<|#|>张三居住在北京
<|COMPLETE|>`,
    usage: {
      promptTokens: 500,
      completionTokens: 100,
      totalTokens: 600
    }
  }
}

// ============================================================================
// 真实实现
// ============================================================================

async function realLLMChat(request: LLMChatRequest): Promise<LLMChatResponse> {
  return window.api.test.llmChat(request)
}

// ============================================================================
// 导出
// ============================================================================

export const kgTestDatasource = {
  llmChat: USE_MOCK ? mockLLMChat : realLLMChat
}
