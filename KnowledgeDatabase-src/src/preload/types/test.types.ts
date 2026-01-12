/**
 * 测试业务域类型定义
 */

/**
 * 测试 API 接口定义
 */
export interface TestAPI {
  ping(): Promise<{ success: boolean; message: string; timestamp: number }>
  echo(message: string): Promise<{ success: boolean; echo: string }>
}
