# 项目信息检索渠道与目录结构指南

## 一、快速了解项目的渠道

### 渠道 1：直接读源码（最准确，永远不会过时）

以下是项目的关键代码入口，需要了解某个模块时直接读对应的源码文件：

| 要了解什么 | 直接读这些文件 |
|-----------|--------------|
| 应用初始化与服务注入 | `KnowledgeDatabase-src/src/main/services/base-service/app-service.ts` |
| SurrealDB 服务管理 | `KnowledgeDatabase-src/src/main/services/surrealdb-service/surrealdb-service.ts` |
| 数据库查询器（主进程代理） | `KnowledgeDatabase-src/src/main/services/surrealdb-service/query-service.ts` |
| 数据库查询器（共享核心实现） | `KnowledgeDatabase-src/src/Public/SharedUtils/surrealdb-query.ts` |
| Schema 定义（所有表结构） | `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema/tables.ts` |
| Schema 导出与分组 | `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema/index.ts` |
| Schema 初始化执行 | `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema-manager.ts` |
| 知识库 CRUD | `KnowledgeDatabase-src/src/main/services/knowledgeBase-library/` 目录 |
| IPC Handler 注册 | `KnowledgeDatabase-src/src/main/ipc/index.ts` |
| 各业务 IPC Handler | `KnowledgeDatabase-src/src/main/ipc/*.ts`（按文件名对应业务域） |
| 跨进程类型定义（权威来源） | `KnowledgeDatabase-src/src/preload/types/` 目录 |
| IPC 消息协议类型 | `KnowledgeDatabase-src/src/Public/ShareTypes/` 目录 |
| 前端状态管理 | `KnowledgeDatabase-src/src/renderer/src/stores/` 目录 |
| 前端页面视图 | `KnowledgeDatabase-src/src/renderer/src/views/` 目录 |
| 模型配置服务 | `KnowledgeDatabase-src/src/main/services/model-config/` 目录 |
| 用户配置服务 | `KnowledgeDatabase-src/src/main/services/user-config-service/` 目录 |

### 渠道 2：README 文档（仅供参考，可能滞后）

项目中有一些 README 文件提供模块说明，但它们**可能落后于代码**，遇到冲突以源码为准：

- `KnowledgeDatabase-src/src/main/README.md`
- `KnowledgeDatabase-src/src/main/services/README.md`
- `KnowledgeDatabase-src/src/main/ipc/README.md`
- `KnowledgeDatabase-src/src/preload/` 下各子目录的 README
- `_Documents/Base/Temeplate.md`（目录职责总体规范）

### 渠道 3：Devin 私有仓库查询（快速概览，必须印证）

```
mcp_devin_ask_question(
  repoName: "HNULS-LabHub/HNULS-KnowledgeDatabase",
  question: "<你的问题>"
)
```

**注意**：Devin 文档有延迟，查询结果**必须对照本地最新源代码印证**，不可盲信。适合快速获取模块概览和设计意图，不适合确认具体实现细节。

### 渠道 4：DeepWiki 公共仓库查询（依赖项目技术细节）

用于查询 SurrealDB 等依赖项目：
- `surrealdb/surrealdb` — SurrealDB 引擎
- `surrealdb/surrealist` — SurrealDB 管理界面
- 使用 `mcp_deepwiki_ask_question` 查询

---

## 二、项目技术栈

| 技术 | 用途 |
|------|------|
| Electron | 桌面应用框架，多进程架构 |
| Vue 3 + TypeScript | 渲染进程 UI |
| Pinia | 状态管理（单一事实来源） |
| SurrealDB（嵌入式） | 数据持久化，支持结构化数据 + 向量 + 图 |
| Tailwind CSS | 样式方案 |
| LangChain | LLM 调用、RAG、Agent |
| Graphology / Sigma.js | 知识图谱可视化 |

---

## 三、目录结构与职责

项目源码根目录：`KnowledgeDatabase-src/src/`

### 3.1 `main/` — Electron 主进程

负责应用生命周期、系统级操作、数据库服务、IPC 消息处理、Utility 进程管理。

关键服务目录（`main/services/`）：

| 目录 | 职责 |
|------|------|
| `base-service/` | AppService — 应用初始化总管，管理所有服务实例的创建和依赖注入 |
| `surrealdb-service/` | SurrealDB 生命周期、Schema 管理、QueryService |
| `knowledgeBase-library/` | 知识库 CRUD、文档管理、文件系统同步 |
| `model-config/` | 模型配置管理（LLM/Embedding 模型） |
| `user-config-service/` | 用户配置管理 |
| `embedding-engine-bridge/` | 主进程 ↔ embedding-engine 子进程通信桥 |
| `vector-indexer-bridge/` | 主进程 ↔ vector-indexer 子进程通信桥 |
| `knowledge-graph-bridge/` | 主进程 ↔ Knowledge-graph 子进程通信桥 |
| `knowledge-graph-monitor/` | KG 构建任务监控 |
| `global-monitor-bridge/` | 主进程 ↔ global-monitor 子进程通信桥 |
| `api-server-bridge/` | 主进程 ↔ api-server 子进程通信桥 |
| `vector-staging/` | 向量暂存服务（写入 vector_staging 表） |
| `vector-retrieval/` | 向量检索服务 |
| `chunking/` | 文档分块服务 |
| `mineru-parser/` | MinerU 文档解析 |
| `agent/` | Agent 服务 |
| `logger/` | 日志服务 |

IPC Handler 目录（`main/ipc/`）：

| 文件 | 对应业务 |
|------|---------|
| `knowledge-library-handler.ts` | 知识库管理 |
| `knowledge-graph-handler.ts` | 知识图谱操作 |
| `knowledge-config-handler.ts` | 知识库配置 |
| `embedding-handler.ts` | 嵌入操作 |
| `vector-indexer-handler.ts` | 向量索引 |
| `vector-retrieval-handler.ts` | 向量检索 |
| `file-handler.ts` | 文件操作 |
| `file-import-handler.ts` | 文件导入 |
| `database-handler.ts` | 数据库操作 |
| `model-config-handler.ts` | 模型配置 |
| `user-config-handler.ts` | 用户配置 |
| `agent-handler.ts` | Agent |
| `chunking-handler.ts` | 分块 |
| `kg-monitor-handler.ts` | KG 监控 |
| `task-monitor-handler.ts` | 任务监控 |
| `mineru-handler.ts` | MinerU 解析 |

### 3.2 `preload/` — Preload 安全层

通过 `contextBridge` 安全暴露 API 给渲染进程。

| 关键内容 | 说明 |
|----------|------|
| `api/` 目录 | 按业务域拆分的 API 文件 |
| `types/` 目录 | **跨进程类型的唯一权威来源**，前端通过 `@preload/types` 引用 |

### 3.3 `renderer/src/` — 渲染进程（Vue 3）

| 目录 | 职责 |
|------|------|
| `components/` | 公共组件（PascalCase 目录，入口 `index.vue`） |
| `views/` | 页面视图（目录结构映射 UI/DOM 布局） |
| `stores/` | Pinia 状态管理（按业务域拆分） |
| `services/` | 服务层 |
| `composables/` | 组合式函数 |
| `types/` | 跨业务域的公共类型 |

### 3.4 `utility/` — Utility 子进程

通过 `utilityProcess.fork()` 启动的独立 Node 进程，执行计算密集型任务。

| 子进程目录 | 职责 |
|-----------|------|
| `embedding-engine/` | 文档分块的向量嵌入生成 |
| `vector-indexer/` | 向量数据从 staging 表转移到 HNSW 索引表 |
| `Knowledge-graph/` | 知识图谱构建（实体/关系提取） |
| `global-monitor/` | 全局任务监控 |
| `api-server/` | API 服务 |

每个子进程有独立的 `entry.ts` 入口，通过 `MessagePort` 与主进程通信。

### 3.5 `Public/` — 跨进程共享

| 目录 | 职责 |
|------|------|
| `ShareTypes/` | IPC 消息协议类型（如 `knowledge-graph-ipc.types.ts`） |
| `SharedUtils/` | 共享工具（如 `surrealdb-query.ts` — 封装的 SurrealDB 查询器） |
| `SharedPrompt/` | 共享的 LLM Prompt 模板 |

---

## 四、IPC 通信架构

```
渲染进程 (Vue)
    ↕ ipcRenderer.invoke / ipcMain.handle
Preload 层 (contextBridge)
    ↕
主进程 (Main)
    ↕ utilityProcess.fork + MessagePort
Utility 进程 (独立 Node 环境)
```

### Bridge 模式

主进程中的 Bridge 类（如 `EmbeddingEngineBridge`、`VectorIndexerBridge`、`KnowledgeGraphBridge`）：
- 管理 Utility 进程的生命周期
- 使用 `pendingRequests` Map 实现请求-响应的 Promise 化
- 通过类型安全的消息协议（`MainToXXMessage` / `XXToMainMessage`）通信

### 关键注意

- Utility 进程**严禁**直接引用 `electron` 主进程模块
- 跨 IPC 传递的数据会被序列化为 JSON，SurrealDB 的 `RecordId` 对象会丢失方法（参见经验教训规则）
- 所有 ID 使用纯字符串格式，通过 `type::thing()` 语法创建记录
