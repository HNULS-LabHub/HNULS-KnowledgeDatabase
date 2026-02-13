/**
 * @file LLM 返回解析器
 * @description 纯函数：解析 LLM 原始输出为 entity/relation 结构
 */

export const TUPLE_DELIMITER = '<|#|>'
export const COMPLETION_DELIMITER = '<|COMPLETE|>'

export interface ParsedEntity {
  name: string
  sanitizedName: string
  type: string
  description: string
}

export interface ParsedRelation {
  srcName: string
  srcSanitized: string
  tgtName: string
  tgtSanitized: string
  keywords: string
  description: string
}

export interface ParseResult {
  entities: ParsedEntity[]
  relations: ParsedRelation[]
}

/**
 * 实体名消毒：用于 Record ID
 * 规则：空格→下划线，只保留字母数字下划线中文，截断到 100 字符
 */
export function sanitizeEntityName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '')
    .slice(0, 100)
}

/**
 * 关系确定性 ID：sorted([src, tgt]).join('_') 保证无向去重
 */
export function makeRelationId(src: string, tgt: string): string {
  const sorted = [src, tgt].sort()
  return `${sorted[0]}_${sorted[1]}`
}

/**
 * 解析 LLM raw_response 为实体和关系
 */
export function parseRawResponse(raw: string): ParseResult {
  const entities: ParsedEntity[] = []
  const relations: ParsedRelation[] = []

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  for (const line of lines) {
    if (line.includes(COMPLETION_DELIMITER)) break

    const parts = line.split(TUPLE_DELIMITER)

    if (parts[0]?.trim().toLowerCase() === 'entity' && parts.length >= 4) {
      const name = parts[1]?.trim()
      if (!name) continue
      const sanitized = sanitizeEntityName(name)
      if (!sanitized) continue
      entities.push({
        name,
        sanitizedName: sanitized,
        type: parts[2]?.trim() || 'Other',
        description: parts[3]?.trim() || ''
      })
    } else if (parts[0]?.trim().toLowerCase() === 'relation' && parts.length >= 5) {
      const srcName = parts[1]?.trim()
      const tgtName = parts[2]?.trim()
      if (!srcName || !tgtName) continue
      const srcSanitized = sanitizeEntityName(srcName)
      const tgtSanitized = sanitizeEntityName(tgtName)
      if (!srcSanitized || !tgtSanitized) continue
      relations.push({
        srcName,
        srcSanitized,
        tgtName,
        tgtSanitized,
        keywords: parts[3]?.trim() || '',
        description: parts[4]?.trim() || ''
      })
    }
  }

  return { entities, relations }
}
