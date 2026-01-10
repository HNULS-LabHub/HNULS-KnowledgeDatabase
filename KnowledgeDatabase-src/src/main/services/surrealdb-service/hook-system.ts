import { EventEmitter } from 'events'
import { ServerEvent, EventHandler } from './types'
import { logger } from '../logger'

/**
 * 事件钩子系统
 *
 * 提供事件发布/订阅机制，支持：
 * - 多个监听器
 * - 异步事件处理
 * - 错误隔离（监听器错误不影响其他监听器）
 */
export class HookSystem extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(50) // 允许更多监听器
  }

  /**
   * 注册事件监听器
   */
  on(event: ServerEvent, handler: EventHandler): this {
    return super.on(event, handler)
  }

  /**
   * 移除事件监听器
   */
  off(event: ServerEvent, handler: EventHandler): this {
    return super.off(event, handler)
  }

  /**
   * 发出事件
   * 异步调用所有监听器，错误隔离
   */
  emit(event: ServerEvent, data?: unknown): boolean {
    const listeners = this.listeners(event)

    if (listeners.length === 0) {
      return false
    }

    // 异步调用所有监听器
    listeners.forEach(async (listener) => {
      try {
        await (listener as EventHandler)(data)
      } catch (error) {
        // 记录错误但不影响其他监听器
        logger.error(`Error in event handler for ${event}:`, error)
      }
    })

    return true
  }

  /**
   * 一次性监听器
   */
  once(event: ServerEvent, handler: EventHandler): this {
    return super.once(event, handler)
  }
}
