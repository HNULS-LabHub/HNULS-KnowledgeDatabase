/**
 * Schema 导出模块
 *
 * 所有表定义按顺序导出，SchemaManager 会按此顺序执行
 */

import {
  userTable,
  documentTable,
  operationLogTable,
  kbDocumentTable,
  TableDefinition
} from './tables'

/**
 * 所有 schema 定义（按顺序）
 */
export const schemas: string[] = [userTable.sql, documentTable.sql, operationLogTable.sql]

/**
 * 知识库专用 schema 定义
 */
export const knowledgeBaseSchemas: string[] = [kbDocumentTable.sql]

export default schemas

// 导出表定义供其他地方使用
export { userTable, documentTable, operationLogTable, kbDocumentTable }
export type { TableDefinition }
