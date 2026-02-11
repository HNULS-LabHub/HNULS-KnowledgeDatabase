/**
 * 知识图谱构建状态 Store
 * 管理抽屉中知识图谱面板的状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { KgBuildState, KgBuildStatus } from './kg-build.types'

export const useKgBuildStore = defineStore('kg-build', () => {
  const stateByFileKey = ref<Map<string, KgBuildState>>(new Map())

  const getState = computed(() => (fileKey: string): KgBuildState | null => {
    return stateByFileKey.value.get(fileKey) ?? null
  })

  const isRunning = computed(() => (fileKey: string): boolean => {
    return stateByFileKey.value.get(fileKey)?.status === 'running'
  })

  /**
   * 模拟执行知识图谱构建（message 替代真实 IPC）
   */
  async function startBuild(
    fileKey: string,
    kgConfigId: string
  ): Promise<{ success: boolean; error?: string }> {
    stateByFileKey.value.set(fileKey, {
      fileKey,
      kgConfigId,
      status: 'running'
    })

    // 模拟异步操作
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 模拟成功
    stateByFileKey.value.set(fileKey, {
      fileKey,
      kgConfigId,
      status: 'completed'
    })

    return { success: true }
  }

  function setState(fileKey: string, status: KgBuildStatus, error?: string): void {
    const existing = stateByFileKey.value.get(fileKey)
    if (existing) {
      stateByFileKey.value.set(fileKey, { ...existing, status, error })
    }
  }

  return {
    stateByFileKey,
    getState,
    isRunning,
    startBuild,
    setState
  }
})
