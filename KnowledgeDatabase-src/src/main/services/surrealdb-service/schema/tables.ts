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
  name: string;
  sql: string;
}

/**
 * 用户表定义
 */
export const userTable: TableDefinition = {
  name: 'user',
  sql: `
    DEFINE TABLE user SCHEMAFULL;
    
    DEFINE FIELD username ON user TYPE string
      ASSERT $value != NONE AND string::len($value) >= 3 AND string::len($value) <= 50;
    
    DEFINE FIELD email ON user TYPE string
      ASSERT $value != NONE AND string::is::email($value);
    
    DEFINE FIELD password_hash ON user TYPE string
      ASSERT $value != NONE;
    
    DEFINE FIELD created_at ON user TYPE datetime
      DEFAULT time::now();
    
    DEFINE FIELD updated_at ON user TYPE datetime
      DEFAULT time::now()
      VALUE time::now();
    
    DEFINE FIELD is_active ON user TYPE bool
      DEFAULT true;
    
    DEFINE INDEX unique_username ON user COLUMNS username UNIQUE;
    DEFINE INDEX unique_email ON user COLUMNS email UNIQUE;
    DEFINE INDEX idx_created_at ON user COLUMNS created_at;
  `
};

/**
 * 文档表定义
 */
export const documentTable: TableDefinition = {
  name: 'document',
  sql: `
    DEFINE TABLE document SCHEMAFULL;
    
    DEFINE FIELD title ON document TYPE string
      ASSERT $value != NONE AND string::len($value) >= 1 AND string::len($value) <= 200;
    
    DEFINE FIELD content ON document TYPE string
      DEFAULT '';
    
    DEFINE FIELD author ON document TYPE option<record<user>>;
    
    DEFINE FIELD tags ON document TYPE array
      DEFAULT [];
    
    DEFINE FIELD created_at ON document TYPE datetime
      DEFAULT time::now();
    
    DEFINE FIELD updated_at ON document TYPE datetime
      DEFAULT time::now()
      VALUE time::now();
    
    DEFINE FIELD is_deleted ON document TYPE bool
      DEFAULT false;
    
    DEFINE INDEX idx_author ON document COLUMNS author;
    DEFINE INDEX idx_created_at ON document COLUMNS created_at;
  `
};
