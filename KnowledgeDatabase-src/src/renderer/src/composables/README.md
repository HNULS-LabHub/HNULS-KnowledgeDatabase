# Composables 目录

本目录存放 Vue 组合式函数（Composables），用于封装和复用复杂的业务逻辑。

## 使用原则

根据项目规范（参见 `_Documents/Base/Temeplate.md` 和 `.cursor/rules/project-base.mdc`）：

- **默认不使用**：render 层的 composables 在开发中使用较少，除非开发者明确声明需要使用
- **适用场景**：
  - 复杂/共享逻辑（生命周期管理、跨组件复用、窗口事件监听等）
  - 跨多个组件复用的业务逻辑
  - 需要独立测试的复杂逻辑单元
- **不适用场景**：
  - 简单且强 UI 相关的逻辑（应直接写在 `.vue` 内）
  - 过度抽象的简单逻辑（避免过度设计）

## 现有 Composables

### useBatchOperations

**位置**：`composables/useBatchOperations/`

**用途**：批量文档解析和分块操作的并发控制与任务管理

**功能**：
- 批量解析文档（带并发控制）
- 批量分块（带并发控制）
- 自动任务监控集成
- 智能文件过滤

**使用示例**：

```typescript
import { useBatchOperations } from '@renderer/composables/useBatchOperations'

// 在组件中使用
const { 
  isBatchParsing, 
  isBatchChunking, 
  batchParseDocuments, 
  batchChunkDocuments 
} = useBatchOperations()

// 批量解析文档
const result = await batchParseDocuments(selectedFiles, knowledgeBaseId)
console.log(`成功: ${result.success}, 失败: ${result.failed}`)

// 批量分块
const result = await batchChunkDocuments(selectedFiles, knowledgeBaseId)
console.log(`成功: ${result.success}, 失败: ${result.failed}`)
```

**详细文档**：参见 `composables/useBatchOperations/README.md`

## 命名规范

- Composable 文件名：`use[功能名].ts`（如 `useBatchOperations.ts`）
- 导出函数名：`use[功能名]`（如 `useBatchOperations`）
- 返回值：对象形式，包含状态和方法

## 目录结构

```
composables/
├── README.md                         # 本文档
└── useBatchOperations/               # 批量操作 Composable
    ├── index.ts                      # 主实现文件
    └── README.md                     # 详细文档
```

## 开发指南

### 何时创建新的 Composable

1. **跨组件复用**：逻辑需要在多个组件中使用
2. **复杂度高**：逻辑超过 50 行或涉及多个状态管理
3. **独立测试**：需要单独测试的业务逻辑单元
4. **生命周期管理**：涉及复杂的生命周期钩子

### 何时不应该创建 Composable

1. **简单逻辑**：少于 20 行且仅在一个组件中使用
2. **强 UI 相关**：与特定组件的 UI 强耦合
3. **一次性使用**：不会被复用的逻辑
4. **过度抽象**：为了"看起来高级"而抽象简单逻辑

### 最佳实践

1. **单一职责**：每个 Composable 只负责一个明确的功能
2. **清晰命名**：函数名和返回值命名要清晰表达用途
3. **类型安全**：使用 TypeScript 类型定义
4. **文档完善**：添加 JSDoc 注释说明用途和参数
5. **错误处理**：妥善处理异常情况
6. **状态隔离**：避免全局状态污染

## 参考资料

- [Vue 3 Composables 官方文档](https://vuejs.org/guide/reusability/composables.html)
- 项目规范：`_Documents/Base/Temeplate.md`
- 项目规则：`.cursor/rules/project-base.mdc`
