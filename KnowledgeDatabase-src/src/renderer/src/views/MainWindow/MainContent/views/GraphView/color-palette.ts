/**
 * @file 实体类型颜色自动分配
 */

const PALETTE = [
  '#5B8FF9', // 蓝
  '#5AD8A6', // 绿
  '#F6BD16', // 黄
  '#E86452', // 红
  '#6DC8EC', // 浅蓝
  '#945FB9', // 紫
  '#FF9845', // 橙
  '#1E9493', // 青
  '#FF99C3', // 粉
  '#269A99', // 深青
  '#BDD2FD', // 淡蓝
  '#A0DC2C', // 黄绿
] as const

const FALLBACK_COLOR = '#94a3b8'

/**
 * 根据实体类型列表生成颜色映射
 */
export function buildColorMap(types: string[]): Map<string, string> {
  const map = new Map<string, string>()
  const sorted = [...types].sort()
  for (let i = 0; i < sorted.length; i++) {
    map.set(sorted[i], PALETTE[i % PALETTE.length])
  }
  return map
}

/**
 * 获取类型对应颜色
 */
export function getTypeColor(colorMap: Map<string, string>, type: string): string {
  return colorMap.get(type) ?? FALLBACK_COLOR
}

/**
 * 将颜色映射转为图例数组
 */
export function colorMapToLegend(colorMap: Map<string, string>): Array<{ type: string; color: string }> {
  return Array.from(colorMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, color]) => ({ type, color }))
}
