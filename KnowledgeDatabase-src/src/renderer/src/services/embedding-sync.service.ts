/**
 * @file 嵌入配置同步服务
 * @description 在应用启动时同步并行数和 Channel 配置到后端
 */

import { useUserConfigStore } from '@renderer/stores/user-config/user-config.store'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'

// 判断是否在 Electron 环境中运行
const isElectron = !!(window as any).electron

/**
 * 等待嵌入引擎就绪
 * @param maxRetries 最大重试次数
 * @param retryDelay 重试间隔（毫秒）
 */
async function waitForEngineReady(maxRetries = 10, retryDelay = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 尝试调用一个简单的 API 来检查引擎是否就绪
      await window.api.embedding.getChannels()
      return true
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg.includes('not started')) {
        console.log(`[EmbeddingSyncService] Waiting for engine... (${i + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      } else {
        // 其他错误，直接返回
        return true
      }
    }
  }
  return false
}

/**
 * 初始化嵌入服务配置
 * 在应用启动时调用，同步用户配置到后端
 */
export async function initEmbeddingConfig(): Promise<void> {
  if (!isElectron) {
    console.log('[EmbeddingSyncService] Not in Electron environment, skip init')
    return
  }

  // 等待嵌入引擎就绪
  const ready = await waitForEngineReady()
  if (!ready) {
    console.warn('[EmbeddingSyncService] Embedding engine not ready after max retries')
    return
  }

  try {
    // 同步并行数配置
    await syncConcurrency()

    // 同步 Channel 配置
    await syncChannels()

    console.log('[EmbeddingSyncService] Embedding config initialized')
  } catch (error) {
    console.error('[EmbeddingSyncService] Failed to init embedding config:', error)
  }
}

/**
 * 同步并行数配置到后端
 */
export async function syncConcurrency(): Promise<void> {
  if (!isElectron) return

  const userConfigStore = useUserConfigStore()

  // 确保配置已加载
  if (!userConfigStore.config) {
    await userConfigStore.fetch()
  }

  const concurrency = userConfigStore.config?.embedding?.concurrency ?? 5

  try {
    await window.api.embedding.setConcurrency(concurrency)
    console.log('[EmbeddingSyncService] Concurrency synced:', concurrency)
  } catch (error) {
    console.error('[EmbeddingSyncService] Failed to sync concurrency:', error)
  }
}

import type { EmbeddingChannelConfig } from '@preload/types/embedding.types'

/**
 * 同步 Channel 配置到后端
 * 从用户的模型配置中提取嵌入模型并转换为 Channel 格式
 */
export async function syncChannels(): Promise<void> {
  if (!isElectron) return

  const modelConfigStore = useUserModelConfigStore()

  // 确保 Provider 列表已加载
  if (modelConfigStore.providers.length === 0) {
    await modelConfigStore.fetchProviders()
  }

  // 构建 Channel 配置
  const channels: EmbeddingChannelConfig[] = []
  let priority = 0

  for (const provider of modelConfigStore.providers) {
    // 只处理已启用且有 API Key 和 Base URL 的 Provider
    if (!provider.enabled || !provider.apiKey || !provider.baseUrl) {
      continue
    }

    // 筛选嵌入模型（通常包含 "embedding" 关键字）
    const embeddingModels = provider.models.filter(
      (m) =>
        m.id.toLowerCase().includes('embedding') ||
        m.name.toLowerCase().includes('embedding') ||
        m.id.toLowerCase().includes('embed')
    )

    for (const model of embeddingModels) {
      channels.push({
        id: `${provider.id}:${model.id}`,
        providerId: provider.id,
        providerName: provider.name,
        priority: priority++,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: model.id
      })
    }
  }

  if (channels.length === 0) {
    console.log('[EmbeddingSyncService] No embedding channels found')
    return
  }

  try {
    await window.api.embedding.updateChannels(channels)
    console.log('[EmbeddingSyncService] Channels synced:', channels.length)
  } catch (error) {
    console.error('[EmbeddingSyncService] Failed to sync channels:', error)
  }
}
