# EmbeddingSection 组件

## 功能说明

嵌入配置组件，用于配置知识库的向量嵌入模型和参数。

## 组件结构

```
EmbeddingSection/
├── index.vue                # 主组件（配置界面）
├── ModelSelectDialog.vue    # 模型选择对话框
├── types.ts                 # 局部类型定义
└── README.md               # 本文档
```

## 功能特性

### 1. 嵌入模型选择

- 从已配置的模型提供商中选择嵌入模型
- 按提供商分组展示模型列表
- 支持搜索和筛选功能
- 模型选择对话框从下到上浮出动画

### 2. 嵌入维度配置

- 可选配置嵌入向量的维度大小
- 留空则使用模型默认维度
- 自动验证输入（必须为正整数）

### 3. 配置保存

- 实时检测配置变化
- 支持保存和重置操作
- 配置保存到 `KnowledgeConfig.json`

## 数据流

```
用户操作
  ↓
EmbeddingSection (本地状态)
  ↓
knowledgeConfigStore.updateGlobalConfig()
  ↓
KnowledgeConfigDataSource
  ↓
IPC (window.api.knowledgeConfig)
  ↓
KnowledgeConfigService
  ↓
KnowledgeConfig.json
```

## 配置存储格式

配置保存在 `{知识库路径}/.config/KnowledgeConfig.json` 中：

```json
{
  "version": "1.0.0",
  "global": {
    "chunking": {
      "mode": "recursive",
      "maxChars": 1000
    },
    "embedding": {
      "providerId": "provider-1234567890",
      "modelId": "text-embedding-3-small",
      "dimensions": 1536
    }
  },
  "documents": {}
}
```

## 使用示例

```vue
<template>
  <EmbeddingSection :knowledge-base-id="knowledgeBaseId" />
</template>

<script setup lang="ts">
import EmbeddingSection from './EmbeddingSection'

const knowledgeBaseId = 1
</script>
```

## 依赖

### Stores

- `useKnowledgeConfigStore`: 知识库配置管理
- `useUserModelConfigStore`: 模型配置管理

### Types

- `@preload/types/knowledge-config.types`: 跨进程类型定义
  - `EmbeddingConfig`: 嵌入配置类型
  - `KnowledgeGlobalConfig`: 全局配置类型

## 注意事项

1. **模型提供商配置**：使用前需要在"用户设置 > 模型管理"中配置模型提供商
2. **嵌入模型筛选**：目前显示所有已配置的模型，未来可以根据模型能力进行筛选
3. **维度验证**：维度必须为正整数，否则会被清空
4. **配置持久化**：配置自动保存到知识库的配置文件中

## 定位类

- `kb-embedding-section`: 主容器
- `kb-embedding-model-dialog`: 模型选择对话框
- `kb-embedding-header`: 标题区域
- `kb-embedding-content`: 内容区域
- `kb-embedding-model-select`: 模型选择按钮
- `kb-embedding-dimension`: 维度输入
- `kb-embedding-actions`: 操作按钮区域

## 未来扩展

1. **模型能力检测**：根据模型 ID 自动识别是否支持嵌入功能
2. **默认维度推荐**：根据选中的模型自动填充推荐的维度值
3. **批量配置**：支持为多个知识库批量配置相同的嵌入模型
4. **配置预设**：保存常用的嵌入配置为预设，快速应用
