/**
 * 分块策略接口（插件接口）
 */
import type { ChunkingConfig, Chunk } from '../types'

/**
 * 分块策略接口
 *
 * 所有分块策略必须实现此接口，以实现插件化扩展
 */
export interface IChunkingStrategy {
  /** 策略名称（唯一标识） */
  readonly name: string

  /** 策略描述 */
  readonly description: string

  /**
   * 执行分块
   * @param content 文档内容（纯文本）
   * @param config 分块配置
   * @returns 分块列表
   */
  chunk(content: string, config: ChunkingConfig): Promise<Chunk[]>

  /**
   * 验证配置是否有效
   * @param config 分块配置
   * @returns 配置是否有效
   */
  validateConfig(config: ChunkingConfig): boolean
}
