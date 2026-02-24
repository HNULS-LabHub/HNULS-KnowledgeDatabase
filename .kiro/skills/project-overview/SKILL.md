---
name: project-overview
description: 当 AI 需要了解本项目的整体架构、目录结构、技术栈、业务模块、数据库结构，或者需要快速构建项目上下文时激活此技能。适用于：(1) 首次接触本项目需要快速了解全貌；(2) 需要定位某个功能模块的代码位置；(3) 涉及数据库表结构、动态表名、Schema 设计等需要了解当前数据库状态；(4) 需要查询项目最新文档或代码变更。
---

# HNULS-KnowledgeDatabase 项目概况与上下文构建指南

## 本 Skill 的用途

帮助 AI 快速理解本项目的架构、定位代码、了解数据库结构，避免因缺乏上下文而产生严重偏差。

## 模块索引

| 模块文件 | 内容 | 何时阅读 |
|----------|------|----------|
| `modules/info-channels.md` | 项目信息检索渠道与目录结构指南 | 首次接触项目、需要定位代码时 |
| `modules/database-snapshot.md` | 数据库结构快照（命名空间、库、表、字段） | 涉及数据库操作、Schema 设计时 |
| `modules/database-codebase-map.md` | 数据库相关代码模块地图与查询指引 | 需要修改数据库逻辑、理解动态表名机制时 |

## 核心行为准则

### 1. 信息来源优先级

1. **本地代码**：直接读取 `KnowledgeDatabase-src/src/` 下的源码和 README，这是最准确的
2. **本 Skill 模块**：提供结构化的概览和快照，但可能滞后于最新代码
3. **Devin 私有仓库查询**：查询 `HNULS-LabHub/HNULS-KnowledgeDatabase` 获取文档级概览
4. **DeepWiki 公共查询**：查询依赖项目（如 `surrealdb/surrealdb`）的技术细节

### 2. 数据库快照可能过时

`modules/database-snapshot.md` 是某个时间点的快照。如果怀疑数据库结构已变更：
- 优先使用 SurrealDB MCP 工具直接查询 `INFO FOR DB` / `INFO FOR TABLE`
- 或读取 `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema/tables.ts` 获取最新 Schema 定义
- 查询后如有变更，应提醒用户更新快照

### 3. Devin 查询注意事项

- Devin 是私有仓库 MCP，可以访问 `HNULS-LabHub/HNULS-KnowledgeDatabase`
- 查询时使用 `HNULS-LabHub/HNULS-KnowledgeDatabase` 作为 repoName
- Devin 的文档可能有一定延迟，**必须结合本地最新源代码印证**
- 不要盲信 Devin 返回的信息，以本地代码为准
