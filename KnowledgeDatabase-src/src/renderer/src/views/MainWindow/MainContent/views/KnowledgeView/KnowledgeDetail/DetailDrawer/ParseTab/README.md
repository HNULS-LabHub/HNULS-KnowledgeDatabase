# ParseTab 组件拆分说明

## 📁 目录结构

```
ParseTab/
├── index.vue                    # 主组件（保留所有状态和逻辑）
├── ParseNavBar.vue              # 横向导航条
├── ParseHeader.vue              # 顶部标题区
├── MinerUPanel.vue              # MinerU 解析面板
├── VersionManager.vue           # 版本管理卡片
├── ChunkingPanel.vue            # 分块配置面板
├── PendingFeatureCard.vue       # 占位功能卡片（复用）
├── types.ts                     # 局部类型定义
└── README.md                    # 本文档
```

## 🎯 拆分原则

### 主组件 (index.vue)

**保留内容**：

- ✅ 所有 Store 调用（parsingStore, chunkingStore, taskMonitorStore, knowledgeLibraryStore）
- ✅ 所有响应式状态（ref, computed）
- ✅ 所有 watch 监听
- ✅ 所有生命周期钩子（onMounted, onBeforeUnmount）
- ✅ 所有事件处理函数（handleStartParsing, handleStartChunking, handleShowPreview, handleSwitchVersion）
- ✅ IntersectionObserver 逻辑

### 子组件

**职责**：

- ✅ 只接收 Props（数据向下流）
- ✅ 只发射 Events（事件向上冒泡）
- ❌ 不调用 Store（避免状态分散）
- ❌ 不做复杂计算（避免逻辑重复）
- ❌ 不管理生命周期（避免副作用）

## 📊 组件对比

| 组件                   | 行数 | 职责               | Props | Emits |
| ---------------------- | ---- | ------------------ | ----- | ----- |
| **index.vue**          | ~350 | 状态管理、业务逻辑 | 3     | 0     |
| ParseNavBar.vue        | ~30  | 导航条展示         | 2     | 1     |
| ParseHeader.vue        | ~20  | 标题展示           | 0     | 0     |
| MinerUPanel.vue        | ~120 | 解析面板展示       | 3     | 1     |
| VersionManager.vue     | ~100 | 版本列表展示       | 2     | 1     |
| ChunkingPanel.vue      | ~180 | 分块配置展示       | 6     | 3     |
| PendingFeatureCard.vue | ~50  | 占位卡片展示       | 2     | 0     |

**总计**：从 825 行拆分为 ~850 行（分散在 7 个文件中）

## 🔒 安全保证

### 1. 响应式链路完整

```
props.fileKey (响应式源头)
  ↓
parsingState = computed(() => parsingStore.getState(props.fileKey))
  ↓
isParsing = computed(() => { ... parsingState.value ... })
  ↓
传递给子组件 <MinerUPanel :is-parsing="isParsing" />
  ↓
子组件接收 props.isParsing（自动响应式）
```

### 2. Store 调用集中

所有 store 调用都在 index.vue 中，状态来源唯一，避免多处调用导致不一致。

### 3. Watch 不重复触发

watch 只在 index.vue 中，避免重复监听和多次调用后端。

### 4. 事件处理逻辑集中

业务逻辑在 index.vue，子组件只负责 UI 交互和事件上报。

## 🔄 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        index.vue                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Props: fileKey, knowledgeBaseId, fileData           │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Stores: parsingStore, chunkingStore, ...            │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Computed: isParsing, progress, versions, ...        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 传递给子组件                                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
  ┌──────────┐      ┌──────────────┐    ┌──────────────┐
  │ NavBar   │      │ MinerUPanel  │    │ Chunking     │
  │          │      │              │    │ Panel        │
  │ Props ↓  │      │ Props ↓      │    │ Props ↓      │
  │ Emits ↑  │      │ Emits ↑      │    │ Emits ↑      │
  └──────────┘      └──────────────┘    └──────────────┘
        ↑                   ↑                   ↑
        └───────────────────┼───────────────────┘
                            ↓
                    事件回到 index.vue
                    执行业务逻辑
```

## 📝 使用示例

### 父组件引用

```vue
<script setup>
import ParseTab from './ParseTab/index.vue'
</script>

<template>
  <ParseTab :file-key="fileKey" :knowledge-base-id="knowledgeBaseId" :file-data="fileData" />
</template>
```

### 子组件通信

```vue
<!-- index.vue -->
<MinerUPanel
  :file-key="fileKey"
  :is-parsing="isParsing"
  :progress="progress"
  @start-parsing="handleStartParsing"
/>

<!-- MinerUPanel.vue -->
<button @click="$emit('start-parsing')">
  开始解析
</button>
```

## ⚠️ 注意事项

1. **不要在子组件中调用 Store**：所有 store 调用必须在 index.vue 中
2. **不要在子组件中做复杂计算**：computed 逻辑应该在 index.vue 中
3. **不要在子组件中管理生命周期**：onMounted/onBeforeUnmount 只在 index.vue 中
4. **保持 Props 类型明确**：使用 TypeScript 定义清晰的 Props 类型
5. **事件命名规范**：使用 kebab-case，如 `start-parsing`、`switch-version`

## 🧪 测试验证

### 功能测试

- [ ] 解析功能：点击"开始 MinerU 解析"按钮，能正常启动解析
- [ ] 版本切换：点击版本列表中的版本，能正常切换
- [ ] 分块功能：点击"分块"按钮，能正常执行分块
- [ ] 预览功能：点击"预览"按钮，能正常显示预览对话框
- [ ] 导航功能：点击导航按钮，能正常滚动到对应区域

### 状态测试

- [ ] watch 触发：fileKey 变化时，能正常触发 watch 并更新状态
- [ ] store 更新：解析/分块操作能正常更新 store 状态
- [ ] 响应式更新：store 状态变化能正常反映到 UI

### 交互测试

- [ ] 按钮禁用：在不满足条件时，按钮能正常禁用
- [ ] 加载状态：在执行操作时，能正常显示加载状态
- [ ] 错误处理：在操作失败时，能正常显示错误信息

## 📚 参考文档

- 原组件：`ParseTab.vue.temp`（临时对照文件）
- 项目规范：`_Documents/Base/Temeplate.md`
- 类型定义：`../../../types.ts`
