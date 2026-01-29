/**
 * @file 通道管理器
 * @description 多源级联 + 熔断机制
 */

import type {
  ChannelConfig,
  ChannelStatusType,
  EmbeddingChannelInfo
} from '@shared/embedding.types'
import { OpenAIClient, OpenAIClientError } from './openai-client'
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from '@shared/embedding.types'

// ============================================================================
// ChannelManager
// ============================================================================

export class ChannelManager {
  private channels: ChannelConfig[] = []
  private openaiClient = new OpenAIClient()
  private failureThreshold = DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold
  private blacklistDuration = DEFAULT_CIRCUIT_BREAKER_CONFIG.blacklistDuration

  // ==========================================================================
  // 配置管理
  // ==========================================================================

  /**
   * 更新通道配置
   */
  updateChannels(channels: ChannelConfig[]): void {
    this.channels = channels.map((ch) => ({
      ...ch,
      status: ch.status || 'active',
      failureCount: ch.failureCount || 0
    }))
  }

  /**
   * 获取通道信息列表（用于 UI 展示）
   */
  getChannelInfos(): EmbeddingChannelInfo[] {
    return this.channels.map((ch) => ({
      id: ch.id,
      providerId: ch.providerId,
      providerName: ch.providerName,
      priority: ch.priority,
      status: ch.status,
      failureCount: ch.failureCount
    }))
  }

  /**
   * 设置熔断参数
   */
  setCircuitBreakerConfig(config: { failureThreshold?: number; blacklistDuration?: number }): void {
    if (config.failureThreshold !== undefined) {
      this.failureThreshold = config.failureThreshold
    }
    if (config.blacklistDuration !== undefined) {
      this.blacklistDuration = config.blacklistDuration
    }
  }

  // ==========================================================================
  // 嵌入请求
  // ==========================================================================

  /**
   * 带降级的嵌入请求
   * @param text 输入文本
   * @param modelId 模型 ID（用于匹配 channel）
   * @param dimensions 可选的向量维度
   */
  async embedWithFallback(text: string, modelId: string, dimensions?: number): Promise<number[]> {
    // 获取可用通道，按优先级排序
    const activeChannels = this.getActiveChannels(modelId)

    if (activeChannels.length === 0) {
      throw new Error('No active channels available')
    }

    let lastError: Error | null = null

    for (const channel of activeChannels) {
      try {
        const embedding = await this.openaiClient.createEmbedding({
          baseUrl: channel.baseUrl,
          apiKey: channel.apiKey,
          model: channel.model,
          input: text,
          dimensions
        })

        // 成功：重置失败计数
        this.resetChannelFailure(channel.id)
        return embedding
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error')
        this.handleChannelError(channel.id, err)

        // 如果是客户端错误（如 400），不切换到下一个 channel
        if (err instanceof OpenAIClientError && err.isClientError() && !err.isRateLimitError()) {
          throw err
        }

        // 继续尝试下一个 channel
        continue
      }
    }

    // 所有 channel 都失败
    throw lastError || new Error('All channels failed')
  }

  // ==========================================================================
  // 通道状态管理
  // ==========================================================================

  /**
   * 获取可用通道（排除黑名单）
   */
  private getActiveChannels(modelId: string): ChannelConfig[] {
    const now = Date.now()

    return this.channels
      .filter((ch) => {
        // 模型匹配（简单的包含匹配）
        if (!ch.model.includes(modelId) && !modelId.includes(ch.model)) {
          // 如果没有精确匹配，尝试基本匹配
          const normalizedModelId = modelId.toLowerCase()
          const normalizedChannelModel = ch.model.toLowerCase()
          if (
            !normalizedModelId.includes(normalizedChannelModel) &&
            !normalizedChannelModel.includes(normalizedModelId)
          ) {
            return false
          }
        }

        // 检查黑名单状态
        if (ch.status === 'blacklisted') {
          if (ch.blacklistedUntil && now > ch.blacklistedUntil) {
            // 黑名单已过期，恢复为活跃
            ch.status = 'active'
            ch.failureCount = 0
            return true
          }
          return false
        }

        return true
      })
      .sort((a, b) => a.priority - b.priority)
  }

  /**
   * 处理通道错误
   */
  private handleChannelError(channelId: string, error: unknown): void {
    const channel = this.channels.find((ch) => ch.id === channelId)
    if (!channel) return

    channel.failureCount++
    channel.lastFailedAt = Date.now()

    // 检查是否需要熔断
    if (channel.failureCount >= this.failureThreshold) {
      channel.status = 'blacklisted'
      channel.blacklistedUntil = Date.now() + this.blacklistDuration

      console.log(
        `[ChannelManager] Channel ${channelId} blacklisted for ${this.blacklistDuration / 1000}s`
      )
    } else {
      channel.status = 'degraded'
    }
  }

  /**
   * 重置通道失败状态
   */
  private resetChannelFailure(channelId: string): void {
    const channel = this.channels.find((ch) => ch.id === channelId)
    if (!channel) return

    if (channel.status !== 'active' || channel.failureCount > 0) {
      channel.status = 'active'
      channel.failureCount = 0
      console.log(`[ChannelManager] Channel ${channelId} recovered`)
    }
  }

  /**
   * 手动重置通道状态
   */
  resetChannel(channelId: string): void {
    this.resetChannelFailure(channelId)
  }

  /**
   * 获取通道状态
   */
  getChannelStatus(channelId: string): ChannelStatusType | undefined {
    const channel = this.channels.find((ch) => ch.id === channelId)
    return channel?.status
  }
}
