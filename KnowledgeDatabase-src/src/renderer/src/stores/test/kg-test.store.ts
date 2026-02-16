/**
 * @file 知识图谱测试 Store
 * @description 管理 KG 模型测试的状态
 */

import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import type { KgTestConfig, KgTestStatus, KgTestResult, LLMMessage, LLMStreamChunk } from './kg-test.types'
import { kgTestDatasource } from './kg-test.datasource'
import {
  entityExtractionSystem,
  entityExtractionUser,
  entityExtractionExamples
} from '../../../../Public/SharedPrompt/knowledge-graph'

// ============================================================================
// 常量
// ============================================================================

const TUPLE_DELIMITER = '<|#|>'
const COMPLETION_DELIMITER = '<|COMPLETE|>'

const DEFAULT_ENTITY_TYPES = ['人物', '组织', '地点', '事件', '概念']

// ============================================================================
// Store
// ============================================================================

export const useKgTestStore = defineStore('kg-test', () => {
  // ============ 状态 ============
  const config = ref<KgTestConfig>({
    entityTypes: [...DEFAULT_ENTITY_TYPES],
    outputLanguage: 'Chinese',
    providerId: '',
    modelId: '',
    inputText: ''
  })

  const status = ref<KgTestStatus>('idle')
  const result = ref<KgTestResult | null>(null)

  // 流式输出的实时内容
  const streamingReasoning = ref('')
  const streamingContent = ref('')

  // 当前会话 ID
  const currentSessionId = ref<string | null>(null)

  // 清理函数
  const cleanupFns: (() => void)[] = []

  // ============ 计算属性 ============
  const entityTypesText = computed(() =>
    config.value.entityTypes.map((t) => JSON.stringify(t)).join(',')
  )

  const systemPrompt = computed(() => {
    let prompt = entityExtractionSystem
    prompt = prompt.replace(/{entity_types}/g, entityTypesText.value)
    prompt = prompt.replace(/{language}/g, config.value.outputLanguage)
    prompt = prompt.replace(/{tuple_delimiter}/g, TUPLE_DELIMITER)
    prompt = prompt.replace(/{completion_delimiter}/g, COMPLETION_DELIMITER)
    prompt = prompt.replace(/{examples}/g, entityExtractionExamples)
    return prompt
  })

  const userPrompt = computed(() => {
    let prompt = entityExtractionUser
    prompt = prompt.replace(/{entity_types}/g, entityTypesText.value)
    prompt = prompt.replace(/{language}/g, config.value.outputLanguage)
    prompt = prompt.replace(/{tuple_delimiter}/g, TUPLE_DELIMITER)
    prompt = prompt.replace(/{completion_delimiter}/g, COMPLETION_DELIMITER)
    prompt = prompt.replace(/{input_text}/g, config.value.inputText || '[请输入文本]')
    return prompt
  })

  const canSend = computed(
    () => config.value.modelId && config.value.inputText.trim() && status.value !== 'loading'
  )

  // ============ 方法 ============

  function setEntityTypes(types: string[]): void {
    config.value.entityTypes = types
  }

  function addEntityTypes(input: string): void {
    const newTypes = input
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter((t) => t && !config.value.entityTypes.includes(t))
    if (newTypes.length > 0) {
      config.value.entityTypes.push(...newTypes)
    }
  }

  function removeEntityType(index: number): void {
    config.value.entityTypes.splice(index, 1)
  }

  function setOutputLanguage(lang: string): void {
    config.value.outputLanguage = lang
  }

  function setModel(providerId: string, modelId: string): void {
    config.value.providerId = providerId
    config.value.modelId = modelId
  }

  function setInputText(text: string): void {
    config.value.inputText = text
  }

  function setupStreamListeners(): void {
    // 清理旧的监听器
    cleanupStreamListeners()

    // 监听 chunk
    cleanupFns.push(
      kgTestDatasource.onLlmStreamChunk((chunk: LLMStreamChunk) => {
        if (chunk.sessionId !== currentSessionId.value) return

        if (chunk.type === 'reasoning' && chunk.content) {
          streamingReasoning.value += chunk.content
        } else if (chunk.type === 'content' && chunk.content) {
          streamingContent.value += chunk.content
        } else if (chunk.type === 'usage' && chunk.usage) {
          result.value = {
            reasoning: streamingReasoning.value,
            content: streamingContent.value,
            usage: chunk.usage,
            timestamp: Date.now()
          }
        }
      })
    )

    // 监听完成
    cleanupFns.push(
      kgTestDatasource.onLlmStreamDone((data) => {
        if (data.sessionId !== currentSessionId.value) return

        result.value = {
          reasoning: streamingReasoning.value,
          content: streamingContent.value,
          usage: result.value?.usage,
          timestamp: Date.now()
        }
        status.value = 'success'
        currentSessionId.value = null
      })
    )

    // 监听错误
    cleanupFns.push(
      kgTestDatasource.onLlmStreamError((data) => {
        if (data.sessionId !== currentSessionId.value) return

        result.value = {
          reasoning: streamingReasoning.value,
          content: streamingContent.value,
          error: data.error,
          timestamp: Date.now()
        }
        status.value = 'error'
        currentSessionId.value = null
      })
    )
  }

  function cleanupStreamListeners(): void {
    for (const cleanup of cleanupFns) {
      cleanup()
    }
    cleanupFns.length = 0
  }

  async function sendTest(): Promise<void> {
    if (!canSend.value) return

    // 生成会话 ID
    const sessionId = `kgtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    currentSessionId.value = sessionId

    status.value = 'loading'
    result.value = null
    streamingReasoning.value = ''
    streamingContent.value = ''

    // 设置监听器
    setupStreamListeners()

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt.value },
      { role: 'user', content: userPrompt.value }
    ]

    try {
      await kgTestDatasource.llmStream({
        sessionId,
        providerId: config.value.providerId,
        modelId: config.value.modelId,
        messages,
        temperature: 0
      })
    } catch (error) {
      result.value = {
        reasoning: '',
        content: '',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      }
      status.value = 'error'
      currentSessionId.value = null
    }
  }

  function reset(): void {
    cleanupStreamListeners()
    config.value = {
      entityTypes: [...DEFAULT_ENTITY_TYPES],
      outputLanguage: 'Chinese',
      providerId: '',
      modelId: '',
      inputText: ''
    }
    status.value = 'idle'
    result.value = null
    streamingReasoning.value = ''
    streamingContent.value = ''
    currentSessionId.value = null
  }

  // 组件卸载时清理
  onUnmounted(() => {
    cleanupStreamListeners()
  })

  return {
    // 状态
    config,
    status,
    result,
    streamingReasoning,
    streamingContent,
    // 计算属性
    systemPrompt,
    userPrompt,
    canSend,
    // 方法
    setEntityTypes,
    addEntityTypes,
    removeEntityType,
    setOutputLanguage,
    setModel,
    setInputText,
    sendTest,
    reset
  }
})
