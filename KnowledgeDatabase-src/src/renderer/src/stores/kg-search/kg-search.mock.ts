/**
 * 知识图谱检索 Mock 数据
 */

import type { KGSearchHit, KGSearchMode, KGSearchModeOption } from './kg-search.types'

/** 检索模式选项 */
export const KG_SEARCH_MODES: KGSearchModeOption[] = [
  {
    value: 'keyword',
    label: '关键词匹配',
    description: '基于关键词在图谱节点属性中进行全文匹配',
    icon: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path>'
  },
  {
    value: 'entity',
    label: '实体关联',
    description: '查找与目标实体直接关联的节点和关系',
    icon: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="m4.93 4.93 2.83 2.83"></path><path d="m16.24 16.24 2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="m4.93 19.07 2.83-2.83"></path><path d="m16.24 7.76 2.83-2.83"></path>'
  },
  {
    value: 'path',
    label: '路径查询',
    description: '查找两个实体之间的最短关系路径',
    icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>'
  }
]

/** 模拟检索延迟 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 生成 mock 检索结果 */
export async function mockKGSearch(query: string, mode: KGSearchMode): Promise<KGSearchHit[]> {
  await delay(600 + Math.random() * 800)

  if (!query.trim()) return []

  const mockHits: KGSearchHit[] = [
    {
      node: {
        id: 'node_001',
        label: `${query} - 核心概念`,
        type: 'concept',
        properties: { definition: `关于 ${query} 的核心定义`, source: '知识库A' }
      },
      edges: [
        {
          id: 'edge_001',
          from: 'node_001',
          to: 'node_002',
          relation: 'related_to',
          properties: {}
        },
        {
          id: 'edge_002',
          from: 'node_001',
          to: 'node_003',
          relation: 'part_of',
          weight: 0.85,
          properties: {}
        }
      ],
      neighbors: [
        { id: 'node_002', label: '相关文档A', type: 'document', properties: { pages: 12 } },
        { id: 'node_003', label: '上位概念', type: 'concept', properties: {} }
      ],
      score: 0.95,
      highlight: `<em>${query}</em> 是该领域的核心概念之一`
    },
    {
      node: {
        id: 'node_004',
        label: `${query} 应用场景`,
        type: 'concept',
        properties: { category: '应用', domain: '工程实践' }
      },
      edges: [
        { id: 'edge_003', from: 'node_004', to: 'node_005', relation: 'used_in', properties: {} }
      ],
      neighbors: [
        { id: 'node_005', label: '实践案例文档', type: 'document', properties: { pages: 8 } }
      ],
      score: 0.82,
      highlight: `${query} 在工程实践中的典型应用`
    },
    {
      node: {
        id: 'node_006',
        label: `${query} 相关人物`,
        type: 'person',
        properties: { role: '研究者', affiliation: '某研究机构' }
      },
      edges: [
        { id: 'edge_004', from: 'node_006', to: 'node_001', relation: 'authored', properties: {} }
      ],
      neighbors: [
        { id: 'node_001', label: `${query} - 核心概念`, type: 'concept', properties: {} }
      ],
      score: 0.71
    }
  ]

  // 根据模式过滤/调整
  if (mode === 'entity') {
    return mockHits.filter((h) => h.edges.length > 0)
  }
  if (mode === 'path') {
    // 路径模式返回较少结果
    return mockHits.slice(0, 2)
  }
  return mockHits
}
