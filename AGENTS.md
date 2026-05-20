<!-- CC-PinDou 拼豆图案生成器 — Agent 指南 -->

> 本文档面向 AI 编程助手。如果你从未接触过本项目，请优先阅读本文件。本文档基于当前项目实际内容编写，所有信息均可通过文件系统验证。

---

## 项目概述

CC-PinDou 是一个将任意图片转换为拼豆（Perler Beads / 融合珠）制作图纸的 Web 工具。支持三种工作模式：

- **普通图片模式**：上传照片 → AI 背景移除 → 颜色简化 → 生成拼豆网格
- **像素图模式**：针对像素风素材优化，支持自动检测像素块大小和对齐偏移
- **自由绘制模式**：空白画板，提供画笔/直线/矩形/圆形/填充/橡皮擦/魔棒替换等工具，支持多图层

项目采用前后端分离架构。前端承担大部分轻量计算（颜色匹配、网格生成），后端负责重型任务（AI 背景移除、高清导出、像素自动检测）。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 + Flask + flask-cors + waitress |
| 图像处理 | Pillow、NumPy、scipy、rembg、onnxruntime |
| 数据库 | SQLite（色号映射，`data/colors.db`） |
| 前端 | Vite 5 + React 18 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui |
| 状态管理 | Zustand（已按领域拆分为 `useEditorStore` / `useUIStore` / `useConfigStore`） |
| UI 设计系统 | NookUI（Animal Crossing 马卡龙风格）+ NES.css（像素光标与复古元素） |
| 路由 | React Router v7（嵌套路由 `/simple/:mode`、`/full/:mode`） |
| 动画 | Framer Motion + CSS View Transitions（NookPhone 风格转场） |
| Toast | Sonner 2.0.7 + NookUI 自定义样式 |
| Tooltip | Radix UI `@radix-ui/react-tooltip` |
| 测试 | Vitest（前端，jsdom）+ pytest（后端） |

---

## 项目结构

```
CC-PinDou/
├── run.py                      # 生产启动入口（waitress，端口 5678，8 线程）
├── build.py                    # 前后端联合构建脚本（含环境检查、依赖安装、测试、构建）
├── requirements.txt            # Python 依赖
│
├── server/                     # Flask 后端
│   ├── app.py                  # 路由入口（背景移除、线条增强、像素检测、导出、SSE 进度、SPA fallback）
│   ├── config.py               # 全局配置、参数边界、rembg 模型元数据
│   ├── colors.py               # 色号数据库（SQLite + JSON），含最近色匹配（cKDTree 加速）
│   ├── utils.py                # 工具函数（文件校验、日志、图像验证、参数解析、安全清理）
│   ├── image_processing.py     # 图像预处理（背景移除、线条增强、颜色简化）
│   ├── pixel_processing.py     # 像素图处理（自动检测、网格生成、颜色量化）
│   ├── normal_processing.py    # 普通图 → 拼豆图案（后端备用路径）
│   ├── export_generator.py     # 高清图纸导出（PNG/JPG，含图例和坐标轴）
│   ├── models_manager.py       # rembg ONNX 模型加载与管理
│   ├── tests/                  # pytest 测试套件
│   │   ├── conftest.py         # 测试 fixtures，确保 server/ 在 sys.path 中
│   │   ├── test_colors.py
│   │   ├── test_image_processing.py
│   │   ├── test_pixel_processing.py
│   │   └── test_utils.py
│   └── uploads/                # 临时上传目录（惰性创建，程序自动清理）
│
├── frontend/                   # 前端（Vite + React + TypeScript）
│   ├── package.json            # npm 依赖与脚本（版本 2.0.0，type: module）
│   ├── vite.config.ts          # Vite 配置（dev 端口 6789，代理 /api 和 /export 到 localhost:5678）
│   ├── vitest.config.ts        # Vitest 配置（jsdom 环境，globals: true，setupFiles: src/test/setup.ts）
│   ├── tailwind.config.js      # Tailwind 配置（NookUI 设计令牌扩展、动画 keyframes、字体）
│   ├── postcss.config.js
│   ├── components.json         # shadcn/ui 初始化配置
│   ├── tsconfig.json           # 项目引用 tsconfig.app.json + tsconfig.node.json
│   └── src/
│       ├── main.tsx            # React 入口（挂载到 #root，添加 .nookui 类，导入 NES.css）
│       ├── App.tsx             # 主应用组件（三模式路由/状态协调）
│       ├── Router.tsx          # react-router-dom 路由（/ → EntryPage, /simple/:mode, /full/:mode）
│       ├── pages/              # 页面组件
│       │   ├── EntryPage.tsx
│       │   ├── SimplePage.tsx
│       │   ├── FullPage.tsx
│       │   └── design-system/  # 设计系统展示页
│       ├── components/         # React 组件
│       │   ├── CanvasEditor.tsx       # 主画板编辑器（Canvas 渲染 + 交互）
│       │   ├── Toolbar.tsx            # 顶部工具栏
│       │   ├── ParamPanel.tsx         # 普通图参数面板
│       │   ├── PixelPanel.tsx         # 像素图参数面板
│       │   ├── EditPanel.tsx          # 绘制模式右侧面板
│       │   ├── DrawToolBar.tsx        # 绘制模式左侧工具栏
│       │   ├── LayerPanel.tsx         # 图层面板（图层列表管理）
│       │   ├── BeadLayerPanel.tsx     # 拼豆图层专属控制面板
│       │   ├── ImageLayerPanel.tsx    # 图片图层上传与管理
│       │   ├── LegendBar.tsx          # 颜色图例（底部用量统计条）
│       │   ├── ExportModal.tsx        # 导出设置弹窗
│       │   ├── SaveModal.tsx          # 保存工程弹窗
│       │   ├── RemoveBgButton.tsx     # AI 背景移除按钮（SSE 进度）
│       │   ├── ModeTabs.tsx           # 模式切换标签
│       │   ├── ImageUploader.tsx      # 图片上传组件
│       │   ├── ImageCropModal.tsx     # 图片裁剪弹窗
│       │   ├── BgRemovePanel.tsx      # 背景移除参数面板
│       │   ├── SettingsPanel.tsx      # 设置面板
│       │   ├── FloatingZoom.tsx       # 悬浮缩放控制器
│       │   ├── ModeBackground.tsx     # 模式切换背景动效
│       │   ├── ColorPickerPopover.tsx # 颜色选择浮层
│       │   ├── ToolPropertiesPopover.tsx # 工具属性浮层
│       │   └── ui/                    # shadcn/ui 基础组件
│       │       ├── alert.tsx
│       │       ├── badge.tsx
│       │       ├── button.tsx
│       │       ├── card.tsx
│       │       ├── checkbox.tsx
│       │       ├── form-field.tsx
│       │       ├── index.ts
│       │       ├── input.tsx
│       │       ├── modal.tsx
│       │       ├── panel-card.tsx
│       │       ├── progress.tsx
│       │       ├── select.tsx
│       │       ├── skeleton.tsx
│       │       ├── slider.tsx
│       │       ├── switch.tsx
│       │       ├── tabs.tsx
│       │       ├── toast.tsx
│       │       ├── tooltip.tsx
│       │       └── uploader.tsx
│       ├── hooks/              # 自定义 Hooks
│       │   ├── useCanvasRenderer.ts      # Canvas 渲染逻辑（方块/圆形/bead 三模式，离屏缓存优化）
│       │   ├── useCanvasInteractions.ts  # 画布交互（点击/拖拽/空格平移）
│       │   ├── useDrawingTools.ts        # 绘制工具（Bresenham 直线、FloodFill 填充）
│       │   ├── usePanZoom.ts             # 滚轮缩放 + 空格拖拽平移
│       │   ├── usePatternGenerator.ts    # 图纸生成逻辑（Web Worker + fallback）
│       │   ├── usePixelProcessor.ts      # 像素图处理逻辑
│       │   ├── usePerlerEngine.ts        # PerlerEngine 封装
│       │   ├── useAutoSave.ts            # IndexedDB 自动保存
│       │   ├── useBackendHealth.ts       # 后端健康检测
│       │   ├── useProjectExport.ts       # 工程导出逻辑
│       │   └── useImageUpload.ts         # 图片上传逻辑
│       ├── store/              # Zustand 状态管理
│       │   ├── useEditorStore.ts      # 编辑状态（gridData、colorList、historyStack、图层系统）
│       │   ├── useUIStore.ts          # UI 状态（mode、drawTool、symmetryMode、面板状态）
│       │   ├── useConfigStore.ts      # 配置状态（brand、gridSize、colorMode 等参数）
│       │   ├── usePerlerStore.ts      # 兼容层（re-export 三个子 Store）
│       │   └── usePerlerStore.test.ts # Vitest 单元测试
│       ├── engine/             # 前端计算引擎
│       │   ├── PerlerEngine.ts        # OKLab 颜色匹配、网格生成、BFS 连通合并
│       │   ├── PerlerEngine.test.ts   # Vitest 单元测试
│       │   └── frontendAlgorithms.ts  # 前端降级算法（颜色简化、线条增强、背景移除、像素检测、导出）
│       ├── workers/            # Web Worker
│       │   └── perler.worker.ts       # 重型计算卸载（generateGrid + bfsMerge）
│       ├── utils/              # 工具函数
│       │   ├── colorList.ts           # 颜色统计工具
│       │   ├── colorList.test.ts      # Vitest 单元测试
│       │   ├── autoSave.ts            # IndexedDB 自动保存底层
│       │   ├── pixelIcon.ts           # 像素图标工具
│       │   ├── theme.ts               # 主题相关工具
│       │   └── viewTransition.ts      # 视图过渡动画
│       ├── api/                # API 客户端
│       │   ├── client.ts              # 统一封装 fetch，含类型定义和错误处理
│       │   └── index.ts
│       ├── types/              # TypeScript 类型定义
│       │   └── perler.ts              # 核心类型（GridCell、ColorInfo、HistoryAction、Layer 等）
│       ├── styles/             # 样式文件
│       │   ├── pindou-theme.css       # 基础全局样式
│       │   └── nookui-theme.css       # NookUI 设计令牌 + 组件类（~1500 行）
│       ├── data/
│       │   └── colorSystemMapping.json # 5 品牌色号映射 JSON 数据
│       ├── lib/
│       │   └── utils.ts               # cn() 等通用工具（shadcn 标准）
│       └── test/
│           └── setup.ts               # Vitest 测试初始化（ImageData polyfill）
│
├── NookUI/                     # NookUI 组件库（独立子项目，被 .gitignore 忽略）
│   ├── package.json            # NookUI 自身为 React + Vite 项目
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/                    # React 组件实现（40+ 组件）
│   ├── public/
│   ├── legacy/                 # 旧版零依赖实现（nookui.css + nookui.js + nookui-docs.html）
│   └── AGENTS.md               # NookUI 子项目专用 Agent 指南
│
├── data/
│   ├── colors.db               # SQLite 色号数据库（运行时自动生成/读取）
│   └── colorSystemMapping.json # 5 品牌色号映射源数据
│
├── models/                     # ONNX 模型文件（rembg 使用，被 .gitignore 忽略）
│   ├── u2net.onnx              # 默认通用模型（~168MB）
│   ├── u2net_human_seg.onnx    # 人像模型（~168MB）
│   ├── isnet-anime.onnx        # 动漫/插画模型（~168MB）
│   ├── silueta.onnx            # 轻量模型（~42MB）
│   ├── isnet-general-use.onnx  # 高精度通用模型（~168MB）
│   └── u2netp.onnx             # 超轻量便携模型（~4MB）
│
├── scripts/                    # 调试与工具脚本
│   ├── test_api.py
│   ├── test_remove_bg.py
│   ├── cleanup_dop_css.py
│   └── replace_dop_to_nook.py
│
└── web_backup/                 # 旧版前端（jQuery + 原生 JS），仅保留参考
```

---

## 关键配置文件

| 文件 | 说明 |
|------|------|
| `requirements.txt` | Python 依赖：Flask、flask-cors、Pillow、numpy、scipy、rembg、waitress |
| `frontend/package.json` | 前端依赖与 npm 脚本（版本 2.0.0，type: module） |
| `frontend/vite.config.ts` | Vite 构建配置、dev server 端口 6789、代理规则、manualChunks 拆包策略（vendor-react/vendor-motion/vendor-radix/vendor-icons/vendor-state/vendor-tw/vendor-sonner/vendor-cropper/vendor-xlsx/engine） |
| `frontend/vitest.config.ts` | Vitest 测试配置（jsdom、globals: true、setupFiles: src/test/setup.ts） |
| `frontend/tailwind.config.js` | Tailwind CSS 配置，扩展了 NookUI 设计令牌、动画 keyframes、字体、圆角、阴影 |
| `frontend/tsconfig.json` | TypeScript 项目引用配置（引用 tsconfig.app.json + tsconfig.node.json） |
| `frontend/components.json` | shadcn/ui 初始化配置 |
| `.prettierrc.json` | 代码格式化：前端 2 空格单引号，Python 4 空格双引号，LF 换行，printWidth 120 |
| `.gitignore` | 忽略 node_modules、dist、ONNX 模型、备份目录、IDE 配置、NookUI 子项目、开发环境文件等 |

---

## 启动与构建

### 环境要求

- **Python**: >= 3.12
- **Node.js**: >= 18（npm 随同安装）
- **编码**: 全项目强制 UTF-8 无 BOM

### 开发环境启动

```bash
# 终端 1：启动后端（生产服务器 waitress，端口 5678，8 线程）
python run.py

# 或者手动进入 server 目录启动
cd server
python -m waitress --listen=127.0.0.1:5678 app:app

# 终端 2：启动前端 dev server（端口 6789，自动代理 /api 和 /export 到后端）
cd frontend
npm run dev
```

前端 dev server 通过 `vite.config.ts` 中的 `proxy` 配置将 `/api` 和 `/export` 请求转发到 `http://localhost:5678`。开发时只需打开 `http://localhost:6789`。

### 生产构建

推荐使用根目录下的联合构建脚本：

```bash
# 完整构建（含环境检查、依赖安装、前后端测试、前端构建）
python build.py

# 跳过测试，快速构建
python build.py --skip-tests

# 仅检查环境
python build.py --check-only
```

手动构建流程：

```bash
# 1. 构建前端
cd frontend
npm run build        # 输出到 frontend/dist/

# 2. 启动后端（Flask 会自动 serve frontend/dist/）
cd ..
python run.py
```

`app.py` 中静态目录配置为 `../frontend/dist`，若不存在则 fallback 到 `../web`。

### 首次运行注意事项

1. `rembg` 首次使用背景移除时会自动下载 ONNX 模型到 `models/` 目录（已通过 `U2NET_HOME` 环境变量配置为项目本地目录，避免下载到用户目录）。
2. `data/colors.db` 若不存在，`colors.py` 会在首次访问时自动从 `data/colorSystemMapping.json` 初始化。
3. `server/uploads/` 为临时上传目录，程序会在处理完成后自动清理。
4. `NookUI/` 是被 `.gitignore` 忽略的独立子项目（含自己的 Git 仓库），修改 NookUI 代码时请参考 `NookUI/AGENTS.md`。

---

## 测试

### 前端测试（Vitest）

```bash
cd frontend
npm test              # 运行一次
npm run test:watch    # 监听模式
```

配置见 `vitest.config.ts`：
- 环境：`jsdom`
- `globals: true`
- setup 文件：`src/test/setup.ts`（含 `ImageData` polyfill）

测试文件：
- `src/engine/PerlerEngine.test.ts`
- `src/utils/colorList.test.ts`
- `src/store/usePerlerStore.test.ts`

### 后端测试（pytest）

```bash
cd server
python -m pytest tests/ -v
```

`conftest.py` 会将 `server/` 加入 `sys.path`，确保模块可导入。

测试覆盖：
- `test_colors.py` — 最近色匹配、full/221 模式、批量一致性
- `test_image_processing.py` — 颜色简化、线条增强、RGBA 透明处理、大图缩放
- `test_pixel_processing.py` — 网格生成、颜色量化、自动检测、背景移除
- `test_utils.py` — Hex/RGB 转换、参数解析、文件清理

**未覆盖**：`app.py` 路由/集成测试、`export_generator.py`、`models_manager.py`、`normal_processing.py`。

---

## 代码风格规范

### 通用

- **编码**：UTF-8 无 BOM
- **缩进**：前端 2 空格，Python 4 空格（`.prettierrc.json` 已配置）
- **换行符**：LF（`.prettierrc.json` 配置 `endOfLine: lf`）
- **printWidth**: 120（前端）

### TypeScript / React

- 使用 **单引号**（`singleQuote: true`，`jsxSingleQuote: true`）
- 函数组件使用箭头函数或普通函数均可，但同一文件保持一致
- 自定义 Hooks 以 `use` 开头
- Store 选择器优先使用精确字段订阅，避免解构整个 Store（防止不必要的重渲染）
- Canvas 渲染逻辑集中在 `useCanvasRenderer.ts`，避免在组件中直接操作 Canvas context
- 路径别名 `@/` 指向 `frontend/src/`
- `noUnusedLocals` / `noUnusedParameters` 已启用，未使用变量会报错

### Python

- 模块级常量使用全大写 + 下划线
- 图像处理函数优先接收 `PIL.Image` 对象而非文件路径，便于测试
- 避免在模块导入时执行副作用（`colors.py` 的数据库初始化、`models_manager.py` 的 session 缓存、`uploads/` 目录创建均采用惰性加载）
- 所有后端 API 错误响应使用 `_error_response()` 统一包装，禁止将内部异常详情（如文件路径）暴露给客户端

---

## 样式指导（NookUI）

本项目**统一使用 NookUI** 作为唯一的设计系统。NookUI 是受《集合啦！动物森友会》启发的马卡龙风格组件库。

### NookUI 双版本说明

NookUI 在 `NookUI/` 目录下包含两个版本：

1. **当前活跃版本**：React + TypeScript + Vite 项目（`NookUI/src/`），含 40+ 组件，支持 Day/Night 双主题
2. **Legacy 版本**：零依赖 Vanilla JS 实现（`NookUI/legacy/nookui.css` + `nookui.js` + `nookui-docs.html`）

> **注意**：`NookUI/` 被主项目 `.gitignore` 忽略，因为它是一个含独立 Git 仓库的子项目。修改 NookUI 时请在其内部操作，并参考 `NookUI/AGENTS.md`。

### 前端 React 项目中的使用

**重要**：主前端**未以 npm 包形式引入 NookUI**。NookUI 的 React 组件在前端中**零引用**。前端通过以下方式使用 NookUI 的设计系统：

1. **`frontend/src/styles/nookui-theme.css`**（~1500 行）：从 NookUI `globals.css` 复制/移植的设计令牌和组件类
2. **`frontend/src/main.tsx`** 在 `#root` 元素上挂载 `.nookui` 类以激活全局基础样式
3. 前端实际 UI 组件基于 **shadcn/ui + Radix UI 基础组件** 自行封装，视觉风格通过 `nook-*` 类名和 Tailwind 工具类实现
4. **`nes.css`** 被导入用于像素光标和复古元素，但在 `index.css` 中通过 `cursor: revert !important` 覆盖了 NES.css 的默认像素光标

**组件类名规范**：前端所有 UI 组件使用 `nook-*` 前缀类名（如 `.nook-btn`、`.nook-panel`、`.nook-card`）。这些类定义在 `nookui-theme.css` 中，与 Tailwind 工具类可混用。

**典型用法**：
```tsx
// 按钮
<button className="nook-btn nook-btn-primary">保存</button>

// 面板（与 Tailwind flex 混用）
<div className="nook-panel flex flex-col gap-3">
  <h3>标题</h3>
  <p className="text-[var(--text-secondary)]">内容</p>
</div>
```

### 核心设计令牌

```css
/* 马卡龙主色（Animal Crossing 配色） */
--nook-cream:   #f8f8f0;   /* 页面底色 */
--ac-green:     #2BB4AB;   /* 主色（动森绿） */
--ac-pink:      #FFB7C5;   /* 粉色 */
--ac-blue:      #5783F7;   /* 天蓝 */
--ac-yellow:    #FFCF01;   /* 暖黄 */
--ac-coral:     #FC4D50;   /* 珊瑚 */
--nook-brown:   #5D4037;   /* 文字主色 */

/* 圆角 */
--radius-sm:  12px;
--radius-md:  20px;
--radius-lg:  28px;
--radius-xl:  36px;
--radius-full: 9999px;

/* 动效 */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

/* 字体 */
font-family: 'Nunito', 'WenYuanRounded', 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

### 样式变更原则

- **前端权威样式源**：`frontend/src/styles/nookui-theme.css` 是 React 前端使用的权威版本
- **NookUI 子项目同步**：如需将样式反向同步到 NookUI React 组件库，需同时修改 `NookUI/src/styles/globals.css`
- **Legacy 版本**：仅在维护旧版零依赖实现时操作 `NookUI/legacy/` 内的文件
- **UTF-8 编码**：所有文件必须保存为 UTF-8 无 BOM
- **组件类前缀**：新组件统一使用 `nook-*` 前缀

---

## 架构决策与关键约定

### 前后端职责划分

| 职责 | 前端 | 后端 |
|------|------|------|
| 颜色匹配（OKLab） | ✅ `PerlerEngine.ts` | ❌ |
| 普通图网格生成 | ✅ `PerlerEngine.generateGrid()` + Web Worker | ❌ |
| 像素图网格生成 | ✅ `PerlerEngine.generatePixelGrid()` | ❌ |
| BFS 连通区域合并 | ✅ `PerlerEngine.bfsMerge()` | ❌ |
| AI 背景移除 | ❌ | ✅ `image_processing.remove_background()` |
| 线条增强 | 前端有降级实现 | ✅ 后端精度更高 |
| 高清导出（PNG/JPG） | 前端有降级（Canvas toBlob） | ✅ `export_generator.py` |
| 像素大小自动检测 | ❌ | ✅ `pixel_processing.py` |

### 后端 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/remove-bg` | POST | AI 背景移除。支持 `task_id` SSE 进度、`edge_threshold` alpha matting、`model` 模型选择 |
| `/api/progress/<task_id>` | GET | SSE 进度流，200ms 轮询，最长 60 秒（300 轮），最大 16 并发 |
| `/api/enhance-lines` | POST | 线条增强，MinFilter 形态学操作 |
| `/api/generate` | POST | 普通图 → 拼豆网格（后端备用路径）|
| `/api/detect-pixel` | POST | 像素图自动检测像素大小和偏移 |
| `/api/models` | GET | 返回可用 rembg 模型列表（含元数据：label、desc、size_mb、tags） |
| `/export` | POST | 高清导出 PNG/JPG，限制 200×200 网格 |
| `/` / `/<path:path>` | GET | SPA 静态文件服务与 fallback（排除 api/、export、static/） |

### 颜色匹配算法

项目使用 **OKLab 感知均匀颜色空间** 进行最近色匹配，位于 `frontend/src/engine/PerlerEngine.ts`。OKLab 比 RGB 欧氏距离更符合人眼感知，对近似色的区分更精确。

后端 `colors.py` 也保留了一套基于 `scipy.spatial.cKDTree` 的最近邻搜索，供历史接口使用，但当前主要计算已迁移到前端。

### 状态管理拆分

原 `usePerlerStore` 为 70+ 字段的巨型单体 Store，已拆分为三个独立 Store：

- `useEditorStore`：`gridData`、`colorList`、`historyStack`、`redoStack`、图层操作（`layers`、`activeLayerId`）、质量检查、魔法棒选区
- `useUIStore`：`mode`（normal/pixel/draw）、`drawTool`、`symmetryMode`、面板折叠状态
- `useConfigStore`：`brand`、`gridSize`、`colorMode`（full/221）、`colorSimplify` 等参数

新代码应直接导入对应的子 Store，不要使用旧的 `usePerlerStore` 兼容层。

### 图层系统

自由绘制模式支持 Photoshop 风格的多图层系统：
- **BeadLayer**：拼豆格子图层，含 `gridData` 和 `colorList`
- **ImageLayer**：背景图片图层，含 `imageUrl` 和 `transform`（位移/缩放/旋转）
- 支持图层可见性、锁定、不透明度、层级调整、合并图层

### Web Worker

`frontend/src/workers/perler.worker.ts` 已实现基本的计算卸载。`usePatternGenerator.ts` 中生成图案时会优先尝试 Worker，失败后降级到主线程同步计算。Worker 内部复用 `PerlerEngine` 的纯计算逻辑。

### SSE 进度推送

后端 `app.py` 使用内存中的全局字典 `progress_store` + 线程锁实现 SSE 进度推送（`/api/progress/<task_id>`）。当前仅用于 AI 背景移除任务的进度反馈。后台守护线程每 60 秒清理一次过期记录（TTL 5 分钟）。

### 路由结构

```
/                  → EntryPage（入口欢迎页）
/simple            → SimplePage（简化布局外壳）
/simple/normal     → App variant="simple" mode="normal"
/simple/pixel      → App variant="simple" mode="pixel"
/simple/draw       → App variant="simple" mode="draw"
/full              → FullPage（完整布局外壳）
/full/normal       → App variant="full" mode="normal"
/full/pixel        → App variant="full" mode="pixel"
/full/draw         → App variant="full" mode="draw"
```

### 模式切换规则

- **normal/pixel → draw**：生成后可带着内容直接进入 draw 模式编辑，无需确认
- **draw → normal/pixel**：切换时弹出二次确认，确认后清空图纸并跳转
- **normal ↔ pixel**：有图纸时切换需确认清空；无图纸时直接跳转并自动清空图片缓存

---

## 安全注意事项

1. **上传文件校验**：所有接收图片的接口均经过 `validate_image_file()` 和 `verify_image_bytes()` 双重校验，白名单扩展名为 `.jpg/.jpeg/.png/.gif/.bmp/.webp`。
2. **文件大小限制**：`MAX_UPLOAD_SIZE_MB = 20`，通过 Flask `MAX_CONTENT_LENGTH` 生效。
3. **导出尺寸限制**：`MAX_EXPORT_GRID_SIZE = 200`，超大 `grid_data` 会被拒绝（防止 DoS）。
4. **错误信息脱敏**：生产环境禁止将 `str(e)` 直接返回客户端，统一使用 `_error_response()` 包装为通用提示，异常详情记入服务器日志。
5. **临时文件清理**：使用 `tempfile.mkstemp()` + `safe_remove()` 确保异常时也能清理上传文件。
6. **生产服务器**：`run.py` 使用 `waitress`（多线程 WSGI，8 线程），不再使用 Flask 开发服务器。
7. **SSE 连接限制**：最大并发 SSE 连接数限制为 16，防止连接耗尽。

---

## 部署模型

本项目采用**单节点自托管部署**，无 CI/CD、无容器化、无云平台配置：

1. 在目标机器运行 `python build.py`（或手动 `npm run build` + `pip install`）
2. 运行 `python run.py` 启动 waitress，监听 `0.0.0.0:5678`
3. 进程同时提供 API 和 React SPA 静态文件服务

如需部署在 nginx 等反向代理之后，需手动编写代理配置。静态文件由 Flask 直接 serve，无需额外 Web 服务器。

---

## 已知陷阱与注意事项

1. **Canvas 渲染性能**：当前为单层全量重绘，修改一个 cell 会重绘整个画布。`melted`（3D 热熔）模式下每 cell 都创建 `createRadialGradient`，大图帧率很低。如需优化，考虑分层渲染或脏矩形策略。
2. **inline style 泛滥**：大量组件使用内联 `style` 而非 Tailwind class，修改主题时需注意 CSS 变量和内联样式的优先级。
3. **字体跨平台**：`export_generator.py` 优先搜索 `WenYuanRoundedSC-VF.otf`，次选 `arial.ttf`，在 Linux/macOS 下可能缺失，会自动 fallback 到默认字体，但中文显示效果不佳。
4. **ImageData polyfill**：`src/test/setup.ts` 为 jsdom 环境提供了 `ImageData` polyfill，但在 Worker 中使用时需确认环境支持。
5. **Blob URL 泄漏**：`RemoveBgButton.tsx` 等组件在使用 `URL.createObjectURL()` 后，需在组件卸载或重新上传时调用 `URL.revokeObjectURL()`。
6. **自动保存限制**：IndexedDB 自动保存不恢复图片文件状态（blob URL 无法持久化），仅保存 gridData、colorList 和图层结构。
7. **大图片处理**：超过 2000px 的图片会被后端自动缩放处理，避免内存溢出。
8. **ONNX 模型**：`models/*.onnx` 文件被 `.gitignore` 忽略，新克隆的仓库需要首次运行时自动下载或手动放置模型文件。
9. **NookUI 子项目隔离**：`NookUI/` 被主项目 `.gitignore` 忽略，修改其代码不会影响主项目 Git 状态，需单独在其内部提交。
10. **前端/后端双实现**：每个主要后端功能（颜色简化、线条增强、背景移除、像素检测、导出）在前端都有降级实现（`frontendAlgorithms.ts`），`generateAlgorithm` 配置可在前后端算法间切换。

---

## 相关文档索引

| 文档 | 说明 |
|------|------|
| `README.md` | 面向用户的功能说明、安装指南、使用教程 |
| `NookUI/AGENTS.md` | NookUI 子项目专用 Agent 指南（React 版本架构、组件规范、构建命令） |
| `NookUI/legacy/nookui.css` | NookUI Legacy 样式源文件（Animal Crossing 马卡龙风格） |
| `NookUI/legacy/nookui.js` | NookUI Legacy 交互逻辑（Vanilla JS，独立可复用） |
| `NookUI/legacy/nookui-docs.html` | NookUI Legacy 组件展示页，浏览器直接打开 |
| `NookUI/legacy/project.md` | NookUI Legacy 独立项目说明 |
| `DEVELOP_ENV.txt` | 开发环境路径记录（Conda + Node.js），被 `.gitignore` 忽略 |
| `data/colorSystemMapping.json` | 5 品牌色号源数据（MARD / COCO / 漫漫 / 盼盼 / 咪小窝） |
