# AGENTS.md

本文件为 WARP (warp.dev) 在此仓库中工作时提供指导。

## 项目概览

HNULS 知识库是一个基于 Electron 的桌面应用程序，使用 Vue 3、TypeScript 和 SurrealDB 构建。它管理知识库，具备文档处理、向量嵌入和 RAG（检索增强生成）能力。

**技术栈**: Electron 39.x, Vue 3, Pinia, TypeScript, SurrealDB, Tailwind CSS 4.x

## 基本命令

### 开发
```bash
# 安装依赖（使用 pnpm，不要用 npm）
pnpm install

# 启动开发服务器（带 HMR，会先自动生成类型）
pnpm dev

# 使用不同日志级别开发
pnpm dev:debug    # 详细日志
pnpm dev:trace    # 数据库查询追踪
pnpm dev:warn     # 仅警告

# 生成 preload 类型（在 dev/build 时自动运行）
pnpm generate:types
```

### 代码质量
```bash
# 类型检查（检查 Node 和 Vue 代码）
pnpm typecheck
pnpm typecheck:node  # 仅主进程
pnpm typecheck:web   # 仅渲染进程

# 代码检查和格式化
pnpm lint
pnpm format
```

### 构建
```bash
# 构建应用（先运行类型检查）
pnpm build

# 平台特定构建
pnpm build:win
pnpm build:mac
pnpm build:linux
pnpm build:unpack  # 构建但不打包
```

## 关键架构模式

### 多进程 Electron 架构

这**不是**典型的 Electron 应用。它使用 **4 种不同的进程类型**：

1. **主进程** (`src/main/`) - 应用生命周期、服务编排
2. **渲染进程** (`src/renderer/`) - Vue 3 UI，运行在浏览器上下文
3. **Preload 层** (`src/preload/`) - 安全边界，暴露 IPC API
4. **工具进程** (`src/utility/`) - 隔离的 Node.js 工作进程，用于重计算

**关键点**：工具进程运行在完全隔离的 Node.js 环境中：
- **必须**仅通过 `MessagePort` 或 IPC 通信
- **禁止**导入 `electron` 主进程模块（`BrowserWindow`、`app` 等）
- **必须**有 `entry.ts` 作为进程入口点
- 当前包括：`embedding-engine`（向量生成）和 `global-monitor`（任务追踪）

### 服务依赖注入模式

**关键反模式**：永远不要多次创建服务实例。这会导致 "QueryService not available" 错误。

```typescript
// ❌ 错误：在 IPC 处理器中创建新实例
const service = new KnowledgeLibraryService()  // 缺少依赖！

// ✅ 正确：使用 AppService 单例
// 在 main/index.ts 中：
await appService.initialize()
const service = appService.getKnowledgeLibraryService()
ipcManager.initialize(surrealDBService, service)
```

**初始化顺序**（必须遵循此顺序）：
1. 启动 `SurrealDBService` → 连接数据库
2. 从 SurrealDB 服务获取 `QueryService`
3. 将 `QueryService` 注入到依赖服务
4. 用服务实例初始化 `IPCManager`

**关键规则**：所有服务在 `AppService.constructor()` 中创建一次，依赖在 `AppService.initialize()` 中注入。

### 类型系统权威

**单一事实来源**：所有跨进程类型**必须**存放在 `src/preload/types/`。

```typescript
// ✅ 渲染进程导入
import type { KnowledgeBase } from '@preload/types'

// ✅ Preload 实现导入
import type { KnowledgeBase } from './types'

// ✅ 主进程导入
import type { KnowledgeBase } from '../preload/types'
```

**自动生成**：`pnpm generate:types` 从类型定义创建 `src/preload/index.d.ts`。这在 dev/build 前自动运行。

**类型提升规则**：如果一个类型被多个不相关的域使用，将其从局部作用域提升到 `src/preload/types/`。

## 目录结构规则

### 渲染进程 (`src/renderer/src/`)

**关键点**：`views/` 目录结构**必须**镜像实际的 UI/DOM 布局。这使得通过观察界面就能找到代码。

```
views/
├── MainWindow/              # 顶层窗口
│   ├── TopBar/             # 面包屑导航
│   ├── NavBar/             # 主导航
│   └── MainContent/        # 内容路由
├── Knowledge/
│   ├── KnowledgeView.vue   # 知识库列表视图
│   └── KnowledgeDetail/
│       ├── FileTreeView/
│       ├── FileListView/
│       └── DetailDrawer/
```

**目录职责**：
- `components/` - 全局可复用组件（PascalCase 目录，`index.vue` 入口）
- `views/` - 页面级组件（结构镜像 DOM）
- `stores/` - Pinia 状态（每个域的单一事实来源）
- `service/` - 纯函数、有状态的底层服务（很少使用）
- `composables/` - 复杂/共享的响应式逻辑（很少使用）
- `types/` - 跨域类型（局部类型保留在其域内）

### Store 模式（4 文件结构）

```
stores/knowledge-library/
├── knowledge-library.store.ts      # Pinia store 定义
├── knowledge-library.datasource.ts # IPC/Mock 适配器
├── knowledge-library.types.ts      # Store 特定类型
└── knowledge-library.mock.ts       # 离线开发的 Mock 数据
```

**Datasource 模式**通过环境检测实现无后端的前端开发：
```typescript
const isElectron = typeof window !== 'undefined' && window.api
return isElectron ? window.api.someMethod() : mock.mockData()
```

## 组件开发

### 定位类（强制）

每个 Vue 组件根元素**必须**包含一个"定位类"用于 DevTools 导航：

```vue
<!-- ✅ 正确：kb = knowledge base 页面前缀 -->
<template>
  <div class="kb-doc-list flex flex-col">
    <!-- content -->
  </div>
</template>

<!-- ❌ 错误：缺少定位类 -->
<div class="flex flex-col">...</div>

<!-- ❌ 错误：定位类有样式含义 -->
<div class="kb-blue-card">...</div>
```

**命名规范**：`{页面前缀}-{功能区域}` (例如：`kb-doc-list`、`us-model-config`)
- 定位类**没有**样式含义 - 仅用于代码定位
- 与 Tailwind 工具类一起使用：`class="kb-doc-list flex flex-col"`

### Tailwind CSS 使用

- 在模板中直接使用 Tailwind 工具类
- 除定位类外不使用自定义 CSS 类
- 响应式变体内联应用：`md:flex-row lg:gap-4`

## IPC 通信

### Preload API 结构

每个业务域有一个 API 文件 (`xxx-api.ts`)：
- `knowledge-library-api.ts` - 知识库 CRUD 操作
- `file-api.ts` - 文件操作
- `task-monitor-api.ts` - 后台任务追踪
- `model-config-api.ts` - AI 提供商管理
- 等等

**API 职责**（仅限这些）：
- 参数验证
- 类型转换
- IPC 通信

**禁止**在 API 层做业务逻辑或吞掉错误。

## SurrealDB 集成

**连接**：嵌入式 SurrealDB 在 `http://127.0.0.1:8000`
- 命名空间：`knowledge`
- 数据库：每个知识库实例（每个知识库有自己的数据库）
- 认证：Root（开发环境）

**服务生命周期**：
```typescript
// 1. 初始化并启动
await surrealDBService.initialize()
await surrealDBService.start()

// 2. 获取 QueryService
const queryService = surrealDBService.getQueryService()

// 3. 注入到依赖服务
knowledgeLibraryService.setQueryService(queryService)
```

## 调试与日志

**日志文件**：
- Windows: `%APPDATA%\knowledgedatabase-src\logs\main.log`
- macOS: `~/Library/Logs/knowledgedatabase-src/main.log`
- Linux: `~/.config/knowledgedatabase-src/logs/main.log`

**常见问题**：

1. **"QueryService not available"**：
   - 检查服务实例来自 `AppService`，而非新创建
   - 验证初始化顺序（SurrealDB → QueryService → 注入）
   - 检查日志中的 "QueryService injected" 消息

2. **修改后的类型错误**：
   - 运行 `pnpm generate:types` 重新生成 preload 类型
   - 重启 TypeScript 服务器
   - 运行 `pnpm typecheck` 验证

3. **工具进程未启动**：
   - 检查 `electron.vite.config.ts` 有正确的入口点
   - 验证每个工具进程存在 `entry.ts`
   - 在日志中查找 "Process initialized"

## Agent 协作协议

在开发功能时：

1. **先澄清需求**：在执行前陈述你的理解 + 关键假设
2. **适当范围**：补充逻辑缺口，但避免过度设计或 PRD 级别的扩展
3. **批准后执行**：一旦计划达成一致，执行完整范围而不频繁中断
4. **例外情况**：如果发现阻塞性问题、安全风险或需要大规模重构，停下来确认

## 关键约束

**禁止**：
- 在 `AppService` 外创建服务实例
- 将跨进程类型放在 `src/preload/types/` 之外的任何地方
- 在工具进程中导入 Electron 主模块
- 创建没有定位类的组件/视图
- 将业务状态放在服务层（应该在 Pinia stores 中）
- 随意散布文件 - 遵循目录结构规则

**必须**：
- 所有包操作使用 `pnpm`
- 类型更改前后运行 `pnpm generate:types`
- 遵循 stores 的 4 文件模式（store/datasource/types/mock）
- 在 `views/` 目录布局中镜像 DOM 结构
- 添加依赖数据库的服务时检查服务初始化顺序
- 使用 datasource 模式实现前后端解耦
