# CC-PinDou 拼豆图案生成器 — Agent 指南

> 本文档面向 AI 编程助手。如果你从未接触过本项目，请优先阅读本文件而非 `README.md`。本文档包含项目结构、技术决策、编码规范及常见陷阱。

---

## 项目概述

CC-PinDou 是一个将任意图片转换为拼豆（Perler Beads / 融合珠）制作图纸的 Web 工具。支持三种工作模式：

- **普通图片模式**：上传照片 → AI 背景移除 → 颜色简化 → 生成拼豆网格
- **像素图模式**：针对像素风素材优化，支持自动检测像素块大小和对齐偏移
- **自由绘制模式**：空白画板，提供画笔/直线/矩形/圆形/填充/橡皮擦等工具

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
| 测试 | Vitest（前端）+ pytest（后端） |
| 构建工具 | Vite（前端）、Python 脚本（后端） |

---

## 项目结构

```
CC-PinDou/
├── run.py                      # 生产启动入口（waitress，端口 5678）
├── build.py                    # 前后端联合构建脚本（含环境检查、依赖安装、测试、构建）
├── requirements.txt            # Python 依赖
│
├── server/                     # Flask 后端
│   ├── app.py                  # 路由入口（背景移除、线条增强、像素检测、导出、SSE 进度）
│   ├── config.py               # 全局配置、参数边界、模型元数据
│   ├── colors.py               # 色号数据库（SQLite + JSON），含最近色匹配（cKDTree 加速）
│   ├── utils.py                # 工具函数（文件校验、日志、图像验证等）
│   ├── image_processing.py     # 图像预处理（背景移除、线条增强、颜色简化）
│   ├── pixel_processing.py     # 像素图处理（自动检测、网格生成、颜色量化）
│   ├── normal_processing.py    # 普通图 → 拼豆图案（保留但当前前端已承担主要计算）
│   ├── export_generator.py     # 高清图纸导出（PNG/JPG，含图例和坐标轴）
│   ├── models_manager.py       # rembg ONNX 模型加载与管理
│   ├── tests/                  # pytest 测试套件
│   │   ├── conftest.py         # 测试 fixtures，确保 server/ 在 sys.path 中
│   │   ├── test_colors.py
│   │   ├── test_image_processing.py
│   │   ├── test_pixel_processing.py
│   │   └── test_utils.py
│   └── uploads/                # 临时上传目录（程序自动清理）
│
├── frontend/                   # 前端（Vite + React + TypeScript）
│   ├── package.json
│   ├── vite.config.ts          # Vite 配置（dev 端口 6789，代理 /api 和 /export 到 localhost:5678）
│   ├── vitest.config.ts        # Vitest 配置（jsdom 环境，setupFiles: src/test/setup.ts）
│   ├── tailwind.config.js      # Tailwind 配置（shadcn/ui 风格）
│   ├── postcss.config.js
│   ├── components.json         # shadcn/ui 配置
│   ├── tsconfig.json           # 项目引用 tsconfig.app.json + tsconfig.node.json
│   └── src/
│       ├── main.tsx            # React 入口（挂载到 #root，添加 .dopamine-skill 类）
│       ├── App.tsx             # 主应用组件（三模式路由/状态协调）
│       ├── Router.tsx          # react-router-dom 路由（/ → EntryPage, /simple, /full）
│       ├── pages/              # 页面组件（EntryPage / SimplePage / FullPage）
│       ├── components/         # React 组件
│       │   ├── CanvasEditor.tsx       # 主画板编辑器（Canvas 渲染 + 交互）
│       │   ├── Toolbar.tsx            # 顶部工具栏
│       │   ├── ParamPanel.tsx         # 普通图参数面板
│       │   ├── PixelPanel.tsx         # 像素图参数面板
│       │   ├── DrawPanel.tsx          # 绘制模式右侧面板
│       │   ├── DrawToolBar.tsx        # 绘制模式左侧工具栏
│       │   ├── ColorLegend.tsx        # 颜色图例
│       │   ├── ExportModal.tsx        # 导出设置弹窗
│       │   ├── RemoveBgButton.tsx     # AI 背景移除按钮（SSE 进度）
│       │   ├── ui/                    # shadcn/ui 基础组件（Button、Slider、Select 等）
│       │   └── ...
│       ├── hooks/              # 自定义 Hooks
│       │   ├── useCanvasRenderer.ts   # Canvas 渲染逻辑（方块/圆形/melted 三模式）
│       │   ├── useDrawingTools.ts     # 绘制工具（Bresenham 直线、FloodFill 填充）
│       │   ├── usePanZoom.ts          # 滚轮缩放 + 空格拖拽平移
│       │   └── useBackendHealth.ts    # 后端健康检测
│       ├── store/              # Zustand 状态管理
│       │   ├── useEditorStore.ts      # 编辑状态（gridData、colorList、historyStack）
│       │   ├── useUIStore.ts          # UI 状态（面板折叠、欢迎弹窗、当前模式）
│       │   ├── useConfigStore.ts      # 配置状态（品牌、网格大小、颜色模式等）
│       │   └── usePerlerStore.ts      # 兼容层（re-export 三个子 Store）
│       ├── engine/             # 前端计算引擎
│       │   ├── PerlerEngine.ts        # OKLab 颜色匹配、网格生成、BFS 连通合并
│       │   ├── PerlerEngine.test.ts   # Vitest 单元测试
│       │   └── frontendAlgorithms.ts  # 前端降级算法（颜色简化、线条增强）
│       ├── utils/              # 工具函数
│       │   ├── soundEngine.ts         # Web Audio 音效
│       │   ├── colorList.ts           # 颜色统计工具
│       │   ├── colorList.test.ts      # Vitest 单元测试
│       │   └── autoSave.ts            # IndexedDB 自动保存
│       ├── api/                # API 客户端
│       │   └── client.ts              # 统一封装 fetch，含类型定义和错误处理
│       ├── types/              # TypeScript 类型定义
│       │   └── perler.ts              # 核心类型（GridCell、ColorInfo、HistoryAction 等）
│       ├── styles/             # 样式文件
│       │   ├── pindou-theme.css       # 拼豆主题 CSS 变量（多巴胺可爱风格）
│       │   └── dopamine-skill.css     # 多巴胺组件工具类
│       ├── workers/            # Web Worker
│       │   └── perler.worker.ts       # 重型计算卸载（generateGrid + bfsMerge）
│       └── test/
│           └── setup.ts               # Vitest 测试初始化（ImageData polyfill）
│
├── data/
│   ├── colors.db               # SQLite 色号数据库（运行时自动生成/读取）
│   └── colorSystemMapping.json # 5 品牌色号映射源数据（JSON）
│
├── models/                     # ONNX 模型文件（rembg 使用）
│   ├── u2net.onnx              # 默认模型
│   ├── isnet-anime.onnx
│   ├── silueta.onnx
│   └── u2net_human_seg.onnx
│
├── NookUI/                     # NookUI 组件库（独立 HTML/CSS/JS，Animal Crossing 风格）
│   ├── nookui.css              # 样式源文件（~75KB，马卡龙配色系统 + 全部组件样式）
│   ├── nookui.js               # 交互逻辑（~23KB，Carousel/Accordion/Drawer/Table/Tree 等）
│   └── nookui.html             # 组件展示页（浏览器直接打开即可预览全部组件）
│
├── NookUI/                     # NookUI 组件库（Animal Crossing 马卡龙风格，项目唯一设计系统）
│   ├── nookui.css              # 样式源文件（~75KB，马卡龙配色系统 + 全部组件样式）
│   ├── nookui.js               # 交互逻辑（~23KB，Vanilla JS）
│   └── nookui.html             # 组件展示页（浏览器直接打开即可预览）
│
├── web_backup/                 # 旧版前端（jQuery + 原生 JS），仅保留参考
│
└── scripts/                    # 调试脚本
    ├── test_api.py
    └── test_remove_bg.py
```

---

## 构建与启动

### 环境要求

- **Python**: >= 3.12
- **Node.js**: >= 18（npm 随同安装）
- **编码**: 全项目强制 UTF-8 无 BOM

### 当前开发环境（参考）

> 以下路径记录自 `DEVELOP_ENV.txt`，供快速定位本地环境：

| 项目 | 路径 |
|------|------|
| Python (Conda 环境) | `D:\ProgramData\Anaconda3\envs\pindou_py312` |
| Node.js | `C:\Program Files\nodejs` |
| 操作系统 | Windows 11 |
| 文件编码 | UTF-8 无 BOM |

### 开发模式

```bash
# 终端 1：启动后端（生产服务器 waitress，端口 5678）
python run.py

# 终端 2：启动前端 dev server（端口 6789，自动代理 /api 到后端）
cd frontend
npm run dev
```

前端 dev server 通过 `vite.config.ts` 中的 `proxy` 配置将 `/api` 和 `/export` 请求转发到 `http://localhost:5678`。开发时只需打开 `http://localhost:6789`。

### 生产构建

```bash
# 方式 1：使用联合构建脚本（推荐）
python build.py

# 方式 2：手动构建
cd frontend
npm run build        # 输出到 frontend/dist/
cd ..
python run.py        # Flask 会自动 serve frontend/dist/
```

`build.py` 支持以下参数：
- `--skip-tests`：跳过前后端测试，快速构建
- `--check-only`：仅检查环境（Python/Node/模型文件），不执行构建

### 首次运行注意事项

1. `rembg` 首次使用背景移除时会自动下载 ONNX 模型到 `models/` 目录（已通过 `U2NET_HOME` 环境变量配置为项目本地目录，避免下载到用户目录）。
2. `data/colors.db` 若不存在，`colors.py` 会在首次访问时自动从 `data/colorSystemMapping.json` 初始化。
3. `server/uploads/` 为临时上传目录，程序会在处理完成后自动清理。

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

### 后端测试（pytest）

```bash
cd server
python -m pytest tests/ -v
```

`conftest.py` 会将 `server/` 加入 `sys.path`，确保模块可导入。

---

## 样式指导（NookUI）

本项目**统一使用 NookUI** 作为唯一的设计系统。NookUI 是受《集合啦！动物森友会》启发的马卡龙风格组件库。

**迁移状态**：Dopamine Cute UI 已全部迁移至 NookUI。前端 `dop-*` 类已批量替换为 `nook-*` 类，`dopamine-skill.css` 已删除，由 `frontend/src/styles/nookui-theme.css` 接管。

### NookUI 组件库

NookUI 是位于 `NookUI/` 目录下的独立组件库，浏览器直接打开 `nookui.html` 即可运行。

#### 文件

| 文件 | 说明 |
|------|------|
| `NookUI/nookui.css` | **样式源文件**（~75KB），含完整马卡龙设计系统 + 全部组件样式 |
| `NookUI/nookui.js` | **交互逻辑**（~23KB），所有组件的 Vanilla JS 实现 |
| `NookUI/nookui.html` | 组件展示页，直接浏览器打开即可预览 |

#### 核心设计令牌

```css
/* 马卡龙主色（Animal Crossing 配色） */
--nook-cream:   #FFF8F0;   /* 页面底色 */
--ac-green:     #A8E6CF;   /* 主色（动森绿） */
--ac-pink:      #FFB7C5;   /* 粉色 */
--ac-blue:      #A0D8EF;   /* 天蓝 */
--ac-yellow:    #F7DC6F;   /* 暖黄 */
--ac-coral:     #FFAAA5;   /* 珊瑚 */
--ac-lavender:  #C7B8E6;   /* 薰衣草 */
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
font-family: 'Nunito', sans-serif;   /* Google Fonts，圆角人文感 */
```

#### 组件清单

**基础组件**：Button（6 变体 + 尺寸）、Form（input/select/checkbox/radio/toggle）、Card、Badge、Tag、Alert、Progress、Loader、Modal、Tabs、List、Pagination、Toast、Tooltip

**增强组件**：Upload Zone（拖拽上传）、Number Input（步进器）、Range Slider（双控件联动）、Switch Card / Segment Button、Dropdown（单选/多选）

**新组件**：Carousel（自动轮播）、Steps（步骤条）、Timeline（时间轴）、Accordion（手风琴）、Rate（五星评分）、Search（搜索框）、Skeleton（骨架屏）、BackTop（回到顶部）

**查漏补缺组件**：Popconfirm（气泡确认）、Notification（通知提醒）、Spin（加载中）、Table（可排序表格）、Tree（树形控件）、Virtual List（虚拟列表）、Watermark（水印）、Drawer（左右抽屉）、Empty（空状态）、Result（结果页）、Image Preview（图片预览）、Countdown（倒计时）

#### 使用方式

1. **直接使用**：复制 `nookui.css` + `nookui.js` 到新项目，引入 HTML 即可
2. **不依赖构建工具**：纯 Vanilla JS，无需 npm/webpack/vite
3. **与 Tailwind 共存**：NookUI 使用独立命名空间（`.nook-*` / `.ac-*`），不会冲突

### 前端 React 项目中的使用

React 前端通过 `frontend/src/styles/nookui-theme.css` 引入 NookUI 设计令牌和组件类。`main.tsx` 在 `#root` 元素上挂载 `.nookui` 类以激活全局基础样式。

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

### 样式变更原则

- **权威源文件**：`NookUI/nookui.css` 和 `NookUI/nookui.js` 是权威版本
- **前端副本**：`frontend/src/styles/nookui-theme.css` 是 React 前端使用的适配版本，如需修改组件样式，先改 `nookui-theme.css`，再同步回 `NookUI/nookui.css`
- **UTF-8 编码**：所有文件必须保存为 UTF-8 无 BOM
- **组件类前缀**：新组件统一使用 `nook-*` 前缀

### 新组件创建流程（NookUI ↔ React 双向同步）

在 React 前端中创建新 UI 组件时，按以下流程操作：

1. **设计阶段**：使用 NookUI 设计令牌（`--ac-*`、`--nook-*`、`--radius-*` 等）
2. **React 实现**：在 `frontend/src/components/ui/` 或 `frontend/src/components/` 中创建组件，使用 `nook-*` 类名
3. **提取通用样式**：如果组件是通用 UI 组件（非业务专用），将其核心 `nook-*` CSS 添加到 `frontend/src/styles/nookui-theme.css`
4. **同步到 NookUI**：将同样的样式添加到 `NookUI/nookui.css`，并在 `NookUI/nookui.html` 中添加演示区域
5. **文档更新**：在 `AGENTS.md` 的组件清单中记录新组件

---

### 历史遗留：Dopamine Cute UI

`dopamine/` 目录下的 Dopamine Cute UI 是项目早期使用的设计系统（多巴胺可爱风格）。**现已废弃，不再维护。** 所有新开发和样式迭代统一使用 NookUI。`dopamine/` 目录仅保留作为历史参考，未来将逐步清理替换。

---

## 代码风格规范

### 通用

- **编码**：UTF-8 无 BOM（`.vscode/settings.json` 已配置）
- **缩进**：前端 2 空格，Python 4 空格（`.prettierrc.json` 已配置）
- **换行符**：LF（`.prettierrc.json` 配置 `endOfLine: lf`）

### TypeScript / React

- 使用 **单引号**（`singleQuote: true`，`jsxSingleQuote: true`）
- 函数组件使用箭头函数或普通函数均可，但同一文件保持一致
- 自定义 Hooks 以 `use` 开头
- Store 选择器优先使用精确字段订阅，避免解构整个 Store（防止不必要的重渲染）
- Canvas 渲染逻辑集中在 `useCanvasRenderer.ts`，避免在组件中直接操作 Canvas context

### Python

- 模块级常量使用全大写 + 下划线
- 图像处理函数优先接收 `PIL.Image` 对象而非文件路径，便于测试
- 避免在模块导入时执行副作用（如 `colors.py` 的数据库初始化已改为惰性加载）
- 所有后端 API 错误响应使用 `_error_response()` 统一包装，禁止将内部异常详情（如文件路径）暴露给客户端

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

### 颜色匹配算法

项目使用 **OKLab 感知均匀颜色空间** 进行最近色匹配，位于 `frontend/src/engine/PerlerEngine.ts`。OKLab 比 RGB 欧氏距离更符合人眼感知，对近似色的区分更精确。

后端 `colors.py` 也保留了一套基于 `scipy.spatial.cKDTree` 的最近邻搜索，供历史接口使用，但当前主要计算已迁移到前端。

### 状态管理拆分

原 `usePerlerStore` 为 70+ 字段的巨型单体 Store，已拆分为三个独立 Store：

- `useEditorStore`：`gridData`、`colorList`、`historyStack`、`redoStack`、图层操作
- `useUIStore`：`mode`（normal/pixel/draw）、`showWelcome`、`leftPanelCollapsed`
- `useConfigStore`：`brand`、`gridSize`、`colorMode`（full/221）、`colorSimplify` 等参数

新代码应直接导入对应的子 Store，不要使用旧的 `usePerlerStore` 兼容层。

### Web Worker

`frontend/src/workers/perler.worker.ts` 已实现基本的计算卸载。`App.tsx` 中生成图案时会优先尝试 Worker，失败后降级到主线程同步计算。Worker 内部复用 `PerlerEngine` 的纯计算逻辑。

### SSE 进度推送

后端 `app.py` 使用内存中的全局字典 `progress_store` + 线程锁实现 SSE 进度推送（`/api/progress/<task_id>`）。当前仅用于 AI 背景移除任务的进度反馈。

---

## 安全注意事项

1. **上传文件校验**：所有接收图片的接口均经过 `validate_image_file()` 和 `verify_image_bytes()` 双重校验，白名单扩展名为 `.jpg/.jpeg/.png/.gif/.bmp/.webp`。
2. **文件大小限制**：`MAX_UPLOAD_SIZE_MB = 20`，通过 Flask `MAX_CONTENT_LENGTH` 生效。
3. **导出尺寸限制**：`MAX_EXPORT_GRID_SIZE = 200`，超大 `grid_data` 会被拒绝（防止 DoS）。
4. **错误信息脱敏**：生产环境禁止将 `str(e)` 直接返回客户端，统一使用 `_error_response()` 包装为通用提示，异常详情记入服务器日志。
5. **临时文件清理**：使用 `tempfile.mkstemp()` + `safe_remove()` 确保异常时也能清理上传文件。
6. **生产服务器**：`run.py` 使用 `waitress`（多线程 WSGI），不再使用 Flask 开发服务器。

---

## 已知陷阱

1. **Canvas 渲染性能**：当前为单层全量重绘，修改一个 cell 会重绘整个画布。`melted`（3D 热熔）模式下每 cell 都创建 `createRadialGradient`，大图帧率很低。性能优化在 `ROADMAP.md` 中有详细计划。
2. **inline style 泛滥**：大量组件使用内联 `style` 而非 Tailwind class，修改主题时需注意 CSS 变量和内联样式的优先级。
3. **字体跨平台**：`export_generator.py` 使用 `arial.ttf`，在 Linux/macOS 下可能缺失，会自动 fallback 到默认字体，但中文显示效果不佳。
4. **ImageData polyfill**：`src/test/setup.ts` 为 jsdom 环境提供了 `ImageData` polyfill，但在 Worker 中使用时需确认环境支持。
5. **Blob URL 泄漏**：`RemoveBgButton.tsx` 等组件在使用 `URL.createObjectURL()` 后，需在组件卸载或重新上传时调用 `URL.revokeObjectURL()`。

---

## 相关文档索引

| 文档 | 说明 |
|------|------|
| `README.md` | 面向用户的功能说明、安装指南、使用教程 |
| `ROADMAP.md` | 综合发展计划，含 P0 Bug 清单、性能优化方案、技术债务追踪 |
| `NookUI/nookui.css` | NookUI 样式源文件（Animal Crossing 马卡龙风格，权威版本） |
| `NookUI/nookui.js` | NookUI 交互逻辑（Vanilla JS，独立可复用） |
| `NookUI/nookui.html` | NookUI 组件展示页，浏览器直接打开 |
| `NookUI/nookui.css` | NookUI 样式源文件（Animal Crossing 马卡龙风格） |
| `NookUI/nookui.js` | NookUI 交互逻辑（Vanilla JS，独立可复用） |
| `NookUI/nookui.html` | NookUI 组件展示页，浏览器直接打开 |
| `frontend/.plan-slider-track-fix.md` | Slider Track 不可见问题的修复方案 |
| `DEVELOP_ENV.txt` | 开发环境路径记录（Conda + Node.js） |
| `data/colorSystemMapping.json` | 5 品牌色号源数据（MARD / COCO / 漫漫 / 盼盼 / 咪小窝） |
