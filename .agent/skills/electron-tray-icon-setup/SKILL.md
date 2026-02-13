---
name: electron-tray-icon-setup
description: 在 Electron 应用中正确配置系统托盘图标，涵盖路径处理、资源打包、平台差异、用户体验最佳实践。基于 KnowledgeDatabase 项目实战总结，解决"托盘图标不显示"、"打包后路径错误"、"资源未包含"三大常见问题。
---

## Skill 正文

### 1. 核心原则

#### 1.1 路径处理：开发环境 vs 打包环境
**必须**根据 `app.isPackaged` 区分路径：

```typescript
const getIconPath = () => {
  if (app.isPackaged) {
    // 打包后：从 process.resourcesPath 读取
    return process.platform === 'win32'
      ? path.join(process.resourcesPath, 'build', 'icon.ico')
      : path.join(process.resourcesPath, 'resources', 'icon.png')
  } else {
    // 开发环境：从项目目录读取
    return process.platform === 'win32'
      ? path.join(__dirname, '../../../build/icon.ico')
      : path.join(__dirname, '../../../resources/icon.png')
  }
}
```

**禁止**：
- 直接使用相对路径（如 `'./icon.png'`）
- 假设 `__dirname` 在打包后路径不变
- 使用 `process.cwd()`（会随启动目录变化）

---

### 2. 图标文件要求

#### 2.1 Windows (.ico)
- **推荐尺寸**：16x16, 32x32, 48x48, 64x64, 128x128, 256x256（多尺寸容器）
- **格式**：ICO 文件包含多个尺寸，系统自动选择合适的
- **位深度**：32-bit PNG with alpha channel

#### 2.2 macOS (.png)
- **必须使用 Template Image**：
  - 文件名包含 `Template` 关键字（如 `iconTemplate.png`）
  - 纯黑色 + 透明背景（系统会根据深色/浅色模式反转）
  - 尺寸：16x16 和 32x32（@2x 用于 Retina）
- **禁止**：彩色图标（会在深色模式下不可见）

#### 2.3 Linux (.png)
- 尺寸：16x16, 24x24, 32x32
- 自动使用 StatusNotifierItem

---

### 3. Electron Builder 打包配置

#### 3.1 extraResources（将文件复制到 resources 目录）
```yaml
# electron-builder.yml
extraResources:
  - from: 'build'
    to: 'build'
    filter:
      - 'icon.ico'
      - 'icon.png'
```

#### 3.2 asarUnpack（解压 asar 包中的资源）
```yaml
asarUnpack:
  - resources/**
```

**说明**：
- `extraResources` 复制到打包后的 `app.asar.unpacked/` 或 `resources/` 目录
- `asarUnpack` 将 asar 包中的文件解压（用于需要文件系统访问的资源）

#### 3.3 常见错误
```yaml
# ❌ 错误：files 配置排除了 build 目录
files:
  - '!build/*'  # 这会导致 icon.ico 无法打包

# ✅ 正确：通过 extraResources 显式包含
extraResources:
  - from: 'build'
    to: 'build'
    filter: ['icon.ico', 'icon.png']
```

---

### 4. Tray 实例化标准流程

#### 4.1 创建托盘（在 app.whenReady() 后）
```typescript
import { app, Tray, Menu, nativeImage } from 'electron'
import path from 'path'

class AppService {
  private tray: Tray | null = null

  async initialize(): Promise<void> {
    await app.whenReady()
    
    // 创建窗口...
    this.createMainWindow()
    
    // 创建托盘（必须在 app ready 之后）
    this.createTray()
  }

  private createTray(): void {
    try {
      const iconPath = this.getIconPath()
      const icon = nativeImage.createFromPath(iconPath)
      
      // 检查图标是否加载成功
      if (icon.isEmpty()) {
        logger.error('Failed to load tray icon', { iconPath })
        // 创建空托盘（至少保证托盘功能可用）
        this.tray = new Tray(nativeImage.createEmpty())
      } else {
        this.tray = new Tray(icon)
      }

      // 设置托盘提示
      this.tray.setToolTip('应用名称')

      // 创建右键菜单
      const contextMenu = Menu.buildFromTemplate([
        { label: '显示主窗口', click: () => this.showMainWindow() },
        { type: 'separator' },
        { label: '退出应用', click: () => app.quit() }
      ])
      this.tray.setContextMenu(contextMenu)

      // 可选：单击托盘显示/隐藏窗口
      this.tray.on('click', () => {
        const mainWindow = this.windowService.getMainWindow()
        if (mainWindow?.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow?.show()
        }
      })

    } catch (error) {
      logger.error('Failed to create tray', error)
    }
  }

  private getIconPath(): string {
    if (app.isPackaged) {
      return process.platform === 'win32'
        ? path.join(process.resourcesPath, 'build', 'icon.ico')
        : path.join(process.resourcesPath, 'resources', 'icon.png')
    } else {
      return process.platform === 'win32'
        ? path.join(__dirname, '../../../build/icon.ico')
        : path.join(__dirname, '../../../resources/icon.png')
    }
  }
}
```

#### 4.2 必须保持全局引用
```typescript
// ✅ 正确：tray 是类成员变量
private tray: Tray | null = null

// ❌ 错误：局部变量会被 GC 回收导致托盘消失
createTray() {
  const tray = new Tray(icon)  // 函数结束后被回收
}
```

---

### 5. 窗口关闭行为（保持托盘运行）

#### 5.1 阻止 window-all-closed 退出应用
```typescript
app.on('window-all-closed', () => {
  // 默认行为：Windows/Linux 下关闭所有窗口会退出应用
  // macOS 下会保持应用在 Dock 中运行
  
  // 修改后：所有平台都保持应用在托盘中运行
  logger.info('All windows closed, app continues running in tray')
  // 不调用 app.quit()
})
```

#### 5.2 退出应用的正确方式
```typescript
// 必须通过托盘菜单或其他 UI 明确调用 app.quit()
const contextMenu = Menu.buildFromTemplate([
  {
    label: '退出应用',
    click: () => {
      logger.info('User quit from tray menu')
      app.quit()  // 唯一的退出方式
    }
  }
])
```

#### 5.3 Graceful Shutdown
```typescript
app.on('before-quit', async (event) => {
  event.preventDefault()
  
  // 清理资源
  await this.surrealDBService.shutdown()
  apiServerBridge.kill()
  // ...
  
  app.exit(0)
})
```

---

### 6. 用户体验最佳实践

#### 6.1 托盘菜单建议
```typescript
// 最小菜单（仅退出）
Menu.buildFromTemplate([
  { label: '退出应用', click: () => app.quit() }
])

// 推荐菜单（显示 + 退出）
Menu.buildFromTemplate([
  { label: '显示主窗口', click: () => mainWindow.show() },
  { type: 'separator' },
  { label: '退出应用', click: () => app.quit() }
])

// 完整菜单（带状态/快捷操作）
Menu.buildFromTemplate([
  { label: '显示主窗口', click: () => mainWindow.show() },
  { type: 'separator' },
  { label: '新建文档', click: () => createDocument() },
  { label: '打开最近', submenu: recentFiles },
  { type: 'separator' },
  { label: '状态：运行中', enabled: false },
  { type: 'separator' },
  { label: '退出应用', click: () => app.quit() }
])
```

#### 6.2 托盘交互
- **单击**：显示/隐藏主窗口（最常用）
- **右键**：显示上下文菜单（标准）
- **双击**：macOS 上可绑定特殊操作
- **中键点击**：很少使用，避免依赖

#### 6.3 图标状态
```typescript
// 动态更新图标（表示状态变化）
const idleIcon = nativeImage.createFromPath(idleIconPath)
const busyIcon = nativeImage.createFromPath(busyIconPath)

tray.setImage(busyIcon)  // 任务进行中
// ... 任务完成 ...
tray.setImage(idleIcon)   // 恢复空闲状态
```

---

### 7. 调试与排查

#### 7.1 图标不显示的常见原因
1. **路径错误**：
   - 检查 `app.isPackaged` 分支
   - 打印实际路径：`logger.debug('Icon path:', iconPath)`
   - 验证文件存在：`fs.existsSync(iconPath)`

2. **图标格式问题**：
   - Windows：使用 ICO 而非 PNG
   - macOS：忘记使用 Template Image
   - 图标尺寸不标准（太小或太大）

3. **资源未打包**：
   - 检查 `electron-builder.yml` 的 `extraResources` 配置
   - 构建后检查 `dist/win-unpacked/resources/` 目录

4. **图标为空**：
   ```typescript
   const icon = nativeImage.createFromPath(iconPath)
   if (icon.isEmpty()) {
     logger.error('Icon is empty', {
       iconPath,
       exists: fs.existsSync(iconPath),
       size: icon.getSize()
     })
   }
   ```

#### 7.2 调试日志
```typescript
logger.debug('Creating tray icon', {
  platform: process.platform,
  isPackaged: app.isPackaged,
  iconPath,
  __dirname,
  resourcesPath: process.resourcesPath
})

const icon = nativeImage.createFromPath(iconPath)
logger.debug('Icon loaded', {
  isEmpty: icon.isEmpty(),
  size: icon.getSize()
})
```

#### 7.3 图片位深度检查
```bash
# 使用 ImageMagick 检查 PNG 格式
magick identify -verbose icon.png | grep -E "Colorspace|Depth|Alpha"

# 应该输出：
# Colorspace: sRGB
# Depth: 8-bit
# Alpha: On
```

---

### 8. 平台特定注意事项

#### 8.1 Windows
- 使用 `.ico` 格式获得最佳效果
- 图标会显示在任务栏右下角（系统托盘）
- 隐藏的图标需要点击 ^ 箭头展开
- 建议尺寸：16x16, 32x32, 256x256

#### 8.2 macOS
- **必须**使用 Template Image（黑色 + 透明）
- 图标显示在菜单栏右侧
- 系统会根据深色/浅色模式自动调整颜色
- 推荐尺寸：16x16 (@1x), 32x32 (@2x)

#### 8.3 Linux
- 使用 StatusNotifierItem / AppIndicator
- 不同桌面环境行为不一致（GNOME / KDE / XFCE）
- 某些环境需要安装 `libappindicator` 库

---

### 9. 新项目检查清单

添加托盘功能时必须完成：

1. **准备图标文件**
   - [ ] Windows: `build/icon.ico`（多尺寸容器）
   - [ ] macOS: `resources/iconTemplate.png`（黑色 + 透明）
   - [ ] Linux: `resources/icon.png`

2. **配置打包**
   - [ ] `electron-builder.yml` 添加 `extraResources`
   - [ ] 测试打包后文件是否存在：`dist/win-unpacked/resources/build/`

3. **实现托盘逻辑**
   - [ ] 创建 `createTray()` 方法（在 `app.whenReady()` 后调用）
   - [ ] 使用 `app.isPackaged` 处理路径
   - [ ] 检查 `icon.isEmpty()`
   - [ ] 设置托盘菜单
   - [ ] 将 `tray` 保存为类成员变量（避免 GC）

4. **修改窗口行为**
   - [ ] 修改 `window-all-closed` 事件（不调用 `app.quit()`）
   - [ ] 托盘菜单提供"退出应用"选项

5. **测试验证**
   - [ ] 开发环境：`pnpm dev` 托盘图标显示
   - [ ] 打包环境：`pnpm build:win` 安装后托盘图标显示
   - [ ] 关闭主窗口后应用继续运行
   - [ ] 右键托盘可退出应用

---

### 10. 常见陷阱

#### 10.1 路径拼接错误
```typescript
// ❌ 错误：硬编码相对路径
const icon = nativeImage.createFromPath('./icon.png')

// ❌ 错误：使用 process.cwd()（会变化）
const icon = nativeImage.createFromPath(path.join(process.cwd(), 'icon.png'))

// ✅ 正确：根据打包状态选择
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'build', 'icon.ico')
  : path.join(__dirname, '../../../build/icon.ico')
```

#### 10.2 忘记配置 extraResources
```yaml
# ❌ 错误：只配置了 files（图标会被排除）
files:
  - 'out/**/*'

# ✅ 正确：显式包含图标
extraResources:
  - from: 'build'
    to: 'build'
    filter: ['icon.ico']
```

#### 10.3 macOS 彩色图标不可见
```typescript
// ❌ 错误：使用彩色 PNG
const icon = nativeImage.createFromPath('icon-color.png')

// ✅ 正确：使用 Template Image
const icon = nativeImage.createFromPath('iconTemplate.png')
tray.setImage(icon)
```

---

### 11. 参考实现

完整的 AppService 托盘实现：

```typescript
import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron'
import path from 'path'
import { logger } from './logger'

export class AppService {
  private tray: Tray | null = null
  private windowService: WindowService

  async initialize(): Promise<void> {
    await app.whenReady()
    
    this.windowService.createMainWindow()
    this.createTray()
    this.setupAppEvents()
  }

  private createTray(): void {
    try {
      const iconPath = this.getIconPath()
      const icon = nativeImage.createFromPath(iconPath)
      
      if (icon.isEmpty()) {
        logger.error('Failed to load tray icon', { iconPath, isPackaged: app.isPackaged })
        this.tray = new Tray(nativeImage.createEmpty())
      } else {
        this.tray = new Tray(icon)
      }

      this.tray.setToolTip('应用名称')

      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示主窗口',
          click: () => {
            const mainWindow = this.windowService.getMainWindow()
            mainWindow?.show()
          }
        },
        { type: 'separator' },
        {
          label: '退出应用',
          click: () => {
            logger.info('User quit from tray menu')
            app.quit()
          }
        }
      ])
      this.tray.setContextMenu(contextMenu)

      this.tray.on('click', () => {
        const mainWindow = this.windowService.getMainWindow()
        if (mainWindow?.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow?.show()
        }
      })

      logger.info('Tray icon created successfully')
    } catch (error) {
      logger.error('Failed to create tray', error)
    }
  }

  private getIconPath(): string {
    if (app.isPackaged) {
      return process.platform === 'win32'
        ? path.join(process.resourcesPath, 'build', 'icon.ico')
        : path.join(process.resourcesPath, 'resources', 'icon.png')
    } else {
      return process.platform === 'win32'
        ? path.join(__dirname, '../../../build/icon.ico')
        : path.join(__dirname, '../../../resources/icon.png')
    }
  }

  private setupAppEvents(): void {
    app.on('window-all-closed', () => {
      logger.info('All windows closed, app continues running in tray')
      // 不调用 app.quit()
    })

    app.on('before-quit', async (event) => {
      event.preventDefault()
      logger.info('App is quitting, cleaning up...')
      
      // 清理资源
      await this.cleanup()
      
      app.exit(0)
    })
  }
}
```
