/**
 * 任务监控数据源适配器
 * 根据环境切换 Mock 数据或真实 IPC 调用
 */

import type { Task } from './task-monitor.types'
import * as mock from './task-monitor.mock'

// 判断是否在 Electron 环境中运行
const isElectron = !!(window as any).electron

export const TaskMonitorDataSource = {
  /**
   * 获取所有任务
   */
  async getTasks(): Promise<Task[]> {
    if (isElectron) {
      // 生产环境：调用 IPC
      // return await window.api.taskMonitor.getTasks()
      console.warn('[TaskMonitor] IPC not implemented yet, using mock data')
      return await mock.mockGetTasks()
    } else {
      // 开发环境：调用 Mock 数据
      console.debug('[Dev Mode] Using Mock Data for getTasks')
      return await mock.mockGetTasks()
    }
  },

  /**
   * 批量停止任务
   */
  async batchStopTasks(taskIds: string[]): Promise<boolean> {
    if (isElectron) {
      // 生产环境：调用 IPC
      // return await window.api.taskMonitor.batchStopTasks(taskIds)
      console.warn('[TaskMonitor] IPC not implemented yet, using mock')
      return await mock.mockBatchStopTasks(taskIds)
    } else {
      // 开发环境：调用 Mock
      console.debug('[Dev Mode] Using Mock Data for batchStopTasks')
      return await mock.mockBatchStopTasks(taskIds)
    }
  },

  /**
   * 批量重新运行任务
   */
  async batchRestartTasks(taskIds: string[]): Promise<boolean> {
    if (isElectron) {
      // 生产环境：调用 IPC
      // return await window.api.taskMonitor.batchRestartTasks(taskIds)
      console.warn('[TaskMonitor] IPC not implemented yet, using mock')
      return await mock.mockBatchRestartTasks(taskIds)
    } else {
      // 开发环境：调用 Mock
      console.debug('[Dev Mode] Using Mock Data for batchRestartTasks')
      return await mock.mockBatchRestartTasks(taskIds)
    }
  },

  /**
   * 导出报表
   */
  async exportReport(): Promise<boolean> {
    if (isElectron) {
      // 生产环境：调用 IPC
      // return await window.api.taskMonitor.exportReport()
      console.warn('[TaskMonitor] IPC not implemented yet, using mock')
      return await mock.mockExportReport()
    } else {
      // 开发环境：调用 Mock
      console.debug('[Dev Mode] Using Mock Data for exportReport')
      return await mock.mockExportReport()
    }
  }
}
