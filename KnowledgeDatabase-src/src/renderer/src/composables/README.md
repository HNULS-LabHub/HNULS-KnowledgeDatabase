# 组合式函数 (Composables)

复杂的业务逻辑复用，按业务域分目录。

## 使用场景

- 页面切换、生命周期管理
- 被多个组件复用的逻辑
- 如"当前选中的文件管理"、"窗口缩放监听"

## 规范

- 小型逻辑直接写在 `.vue` 文件中
- 复杂/共享逻辑在此目录下建立业务目录
- 函数命名使用 `use` 前缀，如 `useFileSystem`

## 示例结构

```
composables/
├── fileSystem/
│   └── useFileTree.ts
├── window/
│   └── useWindowResize.ts
└── ...
```
