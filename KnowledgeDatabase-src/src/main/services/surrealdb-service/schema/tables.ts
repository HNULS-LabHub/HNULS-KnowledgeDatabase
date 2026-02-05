/**
 * Schema 表定义
 *
 * 使用 TypeScript 定义 SurrealQL schema，便于：
 * - 类型检查和 IDE 支持
 * - 模块化组织
 * - 版本控制
 */

/**
 * 表定义接口
 */
export interface TableDefinition {
  name: string
  sql: string
}

/**
 * 用户表定义
 */
export const userTable: TableDefinition = {
  name: 'user',
  sql: `DEFINE TABLE user SCHEMAFULL;
DEFINE FIELD username ON user TYPE string ASSERT $value != NONE AND string::len($value) >= 3 AND string::len($value) <= 50;
DEFINE FIELD email ON user TYPE string ASSERT $value != NONE AND string::is::email($value);
DEFINE FIELD password_hash ON user TYPE string ASSERT $value != NONE;
DEFINE FIELD created_at ON user TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON user TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE FIELD is_active ON user TYPE bool DEFAULT true;
DEFINE INDEX unique_username ON user COLUMNS username UNIQUE;
DEFINE INDEX unique_email ON user COLUMNS email UNIQUE;
DEFINE INDEX idx_created_at ON user COLUMNS created_at;`
}

/**
 * 文档表定义
 */
export const documentTable: TableDefinition = {
  name: 'document',
  sql: `DEFINE TABLE document SCHEMAFULL;
DEFINE FIELD title ON document TYPE string ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 200;
DEFINE FIELD content ON document TYPE string DEFAULT '';
DEFINE FIELD author ON document TYPE option<record<user>>;
DEFINE FIELD tags ON document TYPE array DEFAULT [];
DEFINE FIELD created_at ON document TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON document TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE FIELD is_deleted ON document TYPE bool DEFAULT false;
DEFINE INDEX idx_author ON document COLUMNS author;
DEFINE INDEX idx_created_at ON document COLUMNS created_at;`
}

/**
 * 操作日志表定义
 */
export const operationLogTable: TableDefinition = {
  name: 'operation_log',
  sql: `DEFINE TABLE operation_log SCHEMAFULL;
DEFINE FIELD action ON operation_log TYPE string ASSERT $value IN ['CREATE', 'UPDATE', 'DELETE', 'SELECT', 'QUERY'];
DEFINE FIELD table_name ON operation_log TYPE string;
DEFINE FIELD query ON operation_log TYPE string;
DEFINE FIELD params ON operation_log TYPE option<object>;
DEFINE FIELD result_count ON operation_log TYPE option<number>;
DEFINE FIELD timestamp ON operation_log TYPE datetime DEFAULT time::now();
DEFINE FIELD source ON operation_log TYPE string DEFAULT 'electron_backend';
DEFINE INDEX idx_action ON operation_log COLUMNS action;
DEFINE INDEX idx_table ON operation_log COLUMNS table_name;
DEFINE INDEX idx_timestamp ON operation_log COLUMNS timestamp;`
}

/**
 * 知识库文档表定义
 * 嵌入相关信息已迁移至 kb_document_embedding 表
 */
export const kbDocumentTable: TableDefinition = {
  name: 'kb_document',
  sql: `DEFINE TABLE kb_document SCHEMAFULL;
DEFINE FIELD file_key ON kb_document TYPE string ASSERT $value != NONE;
DEFINE FIELD file_name ON kb_document TYPE string;
DEFINE FIELD file_path ON kb_document TYPE string;
DEFINE FIELD file_type ON kb_document TYPE string;
DEFINE FIELD created_at ON kb_document TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON kb_document TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX idx_file_key ON kb_document COLUMNS file_key UNIQUE;`
}

/**
 * 文档嵌入状态关联表（一对多）
 * 支持同一文档对应多个嵌入配置
 * 唯一索引：(file_key, embedding_config_id, dimensions)
 */
export const kbDocumentEmbeddingTable: TableDefinition = {
  name: 'kb_document_embedding',
  sql: `DEFINE TABLE kb_document_embedding SCHEMAFULL;
DEFINE FIELD file_key ON kb_document_embedding TYPE string ASSERT $value != NONE;
DEFINE FIELD embedding_config_id ON kb_document_embedding TYPE string ASSERT $value != NONE;
DEFINE FIELD embedding_config_name ON kb_document_embedding TYPE option<string>;
DEFINE FIELD dimensions ON kb_document_embedding TYPE int ASSERT $value != NONE;
DEFINE FIELD status ON kb_document_embedding TYPE string DEFAULT 'pending';
DEFINE FIELD chunk_count ON kb_document_embedding TYPE int DEFAULT 0;
DEFINE FIELD task_id ON kb_document_embedding TYPE option<string>;
DEFINE FIELD created_at ON kb_document_embedding TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON kb_document_embedding TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX uniq_doc_embed ON kb_document_embedding COLUMNS file_key, embedding_config_id, dimensions UNIQUE;
DEFINE INDEX idx_file_key ON kb_document_embedding COLUMNS file_key;`
}

/**
 * 向量暂存表定义
 * 位于 system 数据库，用于流式写入嵌入向量，待后台进程搬运到目标向量表
 * 这是普通表（非向量表），不需要 HNSW 索引
 */
export const vectorStagingTable: TableDefinition = {
  name: 'vector_staging',
  sql: `DEFINE TABLE IF NOT EXISTS vector_staging SCHEMALESS;
DEFINE INDEX IF NOT EXISTS idx_staging_processed ON vector_staging FIELDS processed;`
}
