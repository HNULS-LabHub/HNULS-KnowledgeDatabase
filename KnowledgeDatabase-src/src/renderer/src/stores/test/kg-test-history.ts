/**
 * @file 知识图谱测试历史 - IndexedDB 存储
 * @description 只保存配置快照，不保存测试结果
 */

import type { KgTestConfig, SelectedModel } from './kg-test.types'

// ============================================================================
// 类型定义
// ============================================================================

export interface TestHistoryRecord {
  id: string
  timestamp: number
  config: KgTestConfig
  models: SelectedModel[]
}

// ============================================================================
// IndexedDB 操作
// ============================================================================

const DB_NAME = 'kg-test-history'
const DB_VERSION = 1
const STORE_NAME = 'history'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })

  return dbPromise
}

/**
 * 保存配置快照
 */
export async function saveTestHistory(record: TestHistoryRecord): Promise<void> {
  const db = await openDB()
  // 深拷贝以移除 Vue 响应式代理
  const plainRecord: TestHistoryRecord = {
    id: record.id,
    timestamp: record.timestamp,
    config: {
      entityTypes: [...record.config.entityTypes],
      outputLanguage: record.config.outputLanguage,
      inputText: record.config.inputText
    },
    models: record.models.map((m) => ({ providerId: m.providerId, modelId: m.modelId }))
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(plainRecord)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * 获取所有历史记录（按时间倒序）
 */
export async function getAllHistory(): Promise<TestHistoryRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('timestamp')
    const request = index.openCursor(null, 'prev')

    const results: TestHistoryRecord[] = []
    request.onerror = () => reject(request.error)
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        results.push(cursor.value)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
  })
}

/**
 * 删除单条记录
 */
export async function deleteHistory(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * 清空所有历史
 */
export async function clearAllHistory(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.clear()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * 获取历史记录数量
 */
export async function getHistoryCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.count()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}
