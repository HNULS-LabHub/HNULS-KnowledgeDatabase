/**
 * 知识图谱检索数据源适配器
 * 当前使用 Mock，后续切换为 IPC 调用
 */

import type { KGSearchMode, KGSearchHit } from './kg-search.types'
import { mockKGSearch } from './kg-search.mock'

export const KGSearchDataSource = {
  /** 执行知识图谱检索 */
  async search(query: string, mode: KGSearchMode): Promise<KGSearchHit[]> {
    // TODO: 后续切换为 IPC 调用 window.api.kgSearch.search(...)
    console.debug('[Dev Mode] Using Mock KG Search')
    return mockKGSearch(query, mode)
  }
}
