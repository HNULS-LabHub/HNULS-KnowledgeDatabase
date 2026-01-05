# 页面视图 (Views)

页面级组件，目录结构应严格映射 UI 布局 (DOM 结构)。

## 规范

- 通过观察界面可快速定位代码
- 每个窗口/主页面一个目录
- 子组件按布局区域划分

## 示例结构

```
views/
└── MainWindow/            # 对应主窗口
    ├── index.vue          # 布局入口 (Grid/Flex 容器)
    ├── TopBar/            # 顶部栏区域
    │   └── index.vue
    ├── SideBar/           # 侧边栏区域
    │   ├── index.vue
    │   └── FileTree/      # 侧边栏内的子模块
    │       └── index.vue
    └── MainContent/       # 主内容区域
        └── index.vue
```
