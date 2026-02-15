/**
 * @file 知识图谱测试 Store
 * @description 管理 KG 模型测试的状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { KgTestConfig, KgTestStatus, KgTestResult, LLMMessage } from './kg-test.types'
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

  async function sendTest(): Promise<void> {
    if (!canSend.value) return

    status.value = 'loading'
    result.value = null

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt.value },
      { role: 'user', content: userPrompt.value }
    ]

    try {
      const response = await kgTestDatasource.llmChat({
        providerId: config.value.providerId,
        modelId: config.value.modelId,
        messages,
        temperature: 0
      })

      result.value = {
        content: response.content,
        usage: response.usage,
        timestamp: Date.now()
      }
      status.value = 'success'
    } catch (error) {
      result.value = {
        content: '',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      }
      status.value = 'error'
    }
  }

  function reset(): void {
    config.value = {
      entityTypes: [...DEFAULT_ENTITY_TYPES],
      outputLanguage: 'Chinese',
      providerId: '',
      modelId: '',
      inputText: ''
    }
    status.value = 'idle'
    result.value = null
  }

  return {
    // 状态
    config,
    status,
    result,
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
