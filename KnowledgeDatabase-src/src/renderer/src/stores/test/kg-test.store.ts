/**
 * @file 知识图谱测试 Store
 * @description 管理多模型并行测试的状态
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import type {
  KgTestConfig,
  SelectedModel,
  ModelTestResult,
  ModelMetrics,
  LLMMessage,
  LLMStreamChunk
} from './kg-test.types'
import { kgTestDatasource } from './kg-test.datasource'
import {
  saveTestHistory,
  getAllHistory,
  deleteHistory,
  clearAllHistory,
  getHistoryCount,
  type TestHistoryRecord
} from './kg-test-history'
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
  // ============ 配置状态 ============
  const config = ref<KgTestConfig>({
    entityTypes: [...DEFAULT_ENTITY_TYPES],
    outputLanguage: 'Chinese',
    inputText: ''
  })

  // 选中的模型列表
  const selectedModels = ref<SelectedModel[]>([])

  // 每个模型的测试结果（按 sessionId 索引）
  const testResults = reactive<Map<string, ModelTestResult>>(new Map())

  // 历史记录
  const historyRecords = ref<TestHistoryRecord[]>([])
  const historyCount = ref(0)
  const historyLoading = ref(false)

  // 清理函数
  let cleanupChunk: (() => void) | null = null
  let cleanupDone: (() => void) | null = null
  let cleanupError: (() => void) | null = null

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

  const canSend = computed(() => selectedModels.value.length > 0 && config.value.inputText.trim())

  const isAnyLoading = computed(() =>
    Array.from(testResults.values()).some((r) => r.status === 'loading')
  )

  // 获取结果列表（按添加顺序）
  const resultsList = computed(() => Array.from(testResults.values()))

  // ============ 方法 ============

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

  function setInputText(text: string): void {
    config.value.inputText = text
  }

  function addModel(providerId: string, modelId: string): void {
    if (!selectedModels.value.some((m) => m.modelId === modelId)) {
      selectedModels.value.push({ providerId, modelId })
    }
  }

  function removeModel(modelId: string): void {
    const idx = selectedModels.value.findIndex((m) => m.modelId === modelId)
    if (idx !== -1) {
      selectedModels.value.splice(idx, 1)
    }
  }

  function clearModels(): void {
    selectedModels.value = []
  }

  /** 计算性能指标 */
  function getMetrics(result: ModelTestResult): ModelMetrics {
    const totalTime = result.endTime ? result.endTime - result.startTime : null
    const firstTokenTime = result.firstTokenTime ? result.firstTokenTime - result.startTime : null

    let tokensPerSecond: number | null = null
    if (totalTime && result.usage?.completionTokens) {
      tokensPerSecond = Math.round((result.usage.completionTokens / totalTime) * 1000)
    }

    return { totalTime, firstTokenTime, tokensPerSecond }
  }

  function setupStreamListeners(): void {
    cleanupStreamListeners()

    // 监听 chunk
    cleanupChunk = kgTestDatasource.onLlmStreamChunk((chunk: LLMStreamChunk) => {
      const result = testResults.get(chunk.sessionId)
      if (!result) return

      // 记录首字时间
      if (result.firstTokenTime === null && (chunk.content || chunk.type === 'content')) {
        result.firstTokenTime = Date.now()
      }

      if (chunk.type === 'reasoning' && chunk.content) {
        result.reasoning += chunk.content
      } else if (chunk.type === 'content' && chunk.content) {
        result.content += chunk.content
      } else if (chunk.type === 'usage' && chunk.usage) {
        result.usage = chunk.usage
      }
    })

    // 监听完成
    cleanupDone = kgTestDatasource.onLlmStreamDone((data) => {
      const result = testResults.get(data.sessionId)
      if (!result) return

      result.endTime = Date.now()
      result.status = 'success'
    })

    // 监听错误
    cleanupError = kgTestDatasource.onLlmStreamError((data) => {
      const result = testResults.get(data.sessionId)
      if (!result) return

      result.endTime = Date.now()
      result.status = 'error'
      result.error = data.error
    })
  }

  function cleanupStreamListeners(): void {
    cleanupChunk?.()
    cleanupDone?.()
    cleanupError?.()
    cleanupChunk = null
    cleanupDone = null
    cleanupError = null
  }

  /** 保存当前配置快照到历史 */
  async function saveConfigSnapshot(): Promise<void> {
    const id = `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const record: TestHistoryRecord = {
      id,
      timestamp: Date.now(),
      config: { ...config.value },
      models: [...selectedModels.value]
    }

    try {
      await saveTestHistory(record)
      await loadHistoryCount()
    } catch (err) {
      console.error('Failed to save config snapshot:', err)
    }
  }

  /** 并行发送所有模型的测试 */
  async function sendAllTests(): Promise<void> {
    if (!canSend.value) return

    // 保存配置快照
    await saveConfigSnapshot()

    // 清空之前的结果
    testResults.clear()

    // 设置监听器
    setupStreamListeners()

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt.value },
      { role: 'user', content: userPrompt.value }
    ]

    // 并行发起所有请求
    const promises = selectedModels.value.map(async (model) => {
      const sessionId = `kgtest_${model.modelId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

      // 初始化结果
      testResults.set(sessionId, {
        sessionId,
        modelId: model.modelId,
        providerId: model.providerId,
        status: 'loading',
        reasoning: '',
        content: '',
        startTime: Date.now(),
        firstTokenTime: null,
        endTime: null
      })

      try {
        await kgTestDatasource.llmStream({
          sessionId,
          providerId: model.providerId,
          modelId: model.modelId,
          messages,
          temperature: 0
        })
      } catch (error) {
        const result = testResults.get(sessionId)
        if (result) {
          result.status = 'error'
          result.endTime = Date.now()
          result.error = error instanceof Error ? error.message : String(error)
        }
      }
    })

    await Promise.allSettled(promises)
  }

  function clearResults(): void {
    testResults.clear()
  }

  // ============ 历史相关方法 ============

  async function loadHistory(): Promise<void> {
    historyLoading.value = true
    try {
      historyRecords.value = await getAllHistory()
      historyCount.value = historyRecords.value.length
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      historyLoading.value = false
    }
  }

  async function loadHistoryCount(): Promise<void> {
    try {
      historyCount.value = await getHistoryCount()
    } catch (err) {
      console.error('Failed to load history count:', err)
    }
  }

  async function removeHistory(id: string): Promise<void> {
    try {
      await deleteHistory(id)
      historyRecords.value = historyRecords.value.filter((r) => r.id !== id)
      historyCount.value = historyRecords.value.length
    } catch (err) {
      console.error('Failed to delete history:', err)
    }
  }

  async function clearHistory(): Promise<void> {
    try {
      await clearAllHistory()
      historyRecords.value = []
      historyCount.value = 0
    } catch (err) {
      console.error('Failed to clear history:', err)
    }
  }

  /** 从历史记录恢复配置 */
  function restoreFromHistory(record: TestHistoryRecord): void {
    config.value = { ...record.config }
    selectedModels.value = [...record.models]
    testResults.clear()
  }

  function reset(): void {
    cleanupStreamListeners()
    config.value = {
      entityTypes: [...DEFAULT_ENTITY_TYPES],
      outputLanguage: 'Chinese',
      inputText: ''
    }
    selectedModels.value = []
    testResults.clear()
  }

  return {
    // 状态
    config,
    selectedModels,
    testResults,
    historyRecords,
    historyCount,
    historyLoading,
    // 计算属性
    systemPrompt,
    userPrompt,
    canSend,
    isAnyLoading,
    resultsList,
    // 方法
    addEntityTypes,
    removeEntityType,
    setOutputLanguage,
    setInputText,
    addModel,
    removeModel,
    clearModels,
    getMetrics,
    sendAllTests,
    clearResults,
    reset,
    cleanupStreamListeners,
    // 历史方法
    loadHistory,
    loadHistoryCount,
    removeHistory,
    clearHistory,
    restoreFromHistory
  }
})
