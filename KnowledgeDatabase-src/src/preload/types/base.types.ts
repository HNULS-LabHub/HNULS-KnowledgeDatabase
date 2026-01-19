/**
 * Preload 通用类型定义
 *
 * 注意：这里放跨业务域复用的基础类型（例如统一响应结构），供各业务域 *.types.ts 引用。
 */

/**
 * IPC 调用统一响应结构
 *
 * - `success: true` 时，`data` 通常存在
 * - `success: false` 时，`error` 通常存在
 */
export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 工具类 API（Electron webUtils 等）
 *
 * 注意：这不是业务域 API，而是 Electron 提供的底层工具能力。
 */
export interface UtilsAPI {
  /**
   * 获取 File 对象在本机上的真实路径（Electron webUtils）
   *
   * 注意：仅在 Electron 环境有效
   */
  getPathForFile: (file: File) => string
}
