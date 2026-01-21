/**
 * 任务监控 Mock 数据生成器
 */

import type { Task, TaskStatus, TaskType } from './task-monitor.types'

/**
 * Mock 任务数据
 */
export const MOCK_TASKS: Task[] = [
  {
    id: 'T-1024',
    name: '数据同步: 用户中心 -> 营销库',
    type: 'ETL Sync',
    status: 'running',
    progress: 45,
    owner: 'System',
    started: '2 mins ago'
  },
  {
    id: 'T-1023',
    name: '每日报表生成: 销售域',
    type: 'Report',
    status: 'completed',
    progress: 100,
    owner: 'Alice',
    started: '1 hour ago'
  },
  {
    id: 'T-1022',
    name: '图像压缩处理: 批次 #882',
    type: 'Processing',
    status: 'running',
    progress: 78,
    owner: 'Bob',
    started: '15 mins ago'
  },
  {
    id: 'T-1021',
    name: 'API 网关日志分析',
    type: 'Analytics',
    status: 'failed',
    progress: 12,
    owner: 'System',
    started: '2 hours ago'
  },
  {
    id: 'T-1020',
    name: '数据库备份: 节点 A',
    type: 'Backup',
    status: 'queued',
    progress: 0,
    owner: 'Admin',
    started: 'Pending'
  },
  {
    id: 'T-1019',
    name: '缓存预热: 商品详情页',
    type: 'Cache',
    status: 'completed',
    progress: 100,
    owner: 'System',
    started: '3 hours ago'
  },
  {
    id: 'T-1018',
    name: '用户行为日志归档',
    type: 'Archiving',
    status: 'running',
    progress: 23,
    owner: 'System',
    started: '5 mins ago'
  },
  {
    id: 'T-1017',
    name: '邮件营销推送: Q3活动',
    type: 'Marketing',
    status: 'paused',
    progress: 60,
    owner: 'Sarah',
    started: '4 hours ago'
  },
  {
    id: 'T-1016',
    name: '安全审计扫描: 核心库',
    type: 'Security',
    status: 'completed',
    progress: 100,
    owner: 'SecTeam',
    started: 'Yesterday'
  }
]

/**
 * 任务类型列表
 */
export const TASK_TYPES: Array<TaskType | 'All Types'> = [
  'All Types',
  'ETL Sync',
  'Report',
  'Processing',
  'Analytics',
  'Backup',
  'Cache',
  'Security',
  'File Import',
  'Document Parsing',
  'Chunking'
]

/**
 * 任务状态列表
 */
export const TASK_STATUSES: Array<TaskStatus | 'All Status'> = [
  'All Status',
  'running',
  'completed',
  'failed',
  'queued',
  'paused'
]

/**
 * 获取所有任务（模拟异步）
 */
export const mockGetTasks = async (): Promise<Task[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_TASKS])
    }, 300)
  })
}

/**
 * 批量停止任务（模拟）
 */
export const mockBatchStopTasks = async (taskIds: string[]): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('[Mock] Stopping tasks:', taskIds)
      resolve(true)
    }, 500)
  })
}

/**
 * 批量重新运行任务（模拟）
 */
export const mockBatchRestartTasks = async (taskIds: string[]): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('[Mock] Restarting tasks:', taskIds)
      resolve(true)
    }, 500)
  })
}

/**
 * 导出报表（模拟）
 */
export const mockExportReport = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('[Mock] Exporting report...')
      resolve(true)
    }, 800)
  })
}
