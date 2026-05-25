# CC-PinDou 拼豆图案生成器

> 版本：v1.0.0（完整版，前后端分离）

将任意图片转换为拼豆（Perler Beads）制作图纸的 Web 工具，支持普通照片转换、像素图识别、自由绘制三种模式。内置 5 个国内拼豆品牌色号映射，采用 OKLab 颜色空间匹配，可导出高清图纸和材料清单。

**本分支为完整前后端分离版本**，Python 后端提供 AI 背景移除（rembg）、线条增强、高清导出等重型任务。

---

## 三种工作模式

| 模式 | 适用场景 | 核心能力 |
|------|----------|----------|
| **普通图片** | 照片、插画 | AI 背景移除（rembg）→ 颜色简化 → OKLab 色号匹配 → 拼豆网格 |
| **像素图** | 游戏素材、像素插画 | 自动像素块检测 + 对齐偏移微调 → 精确像素网格（上限 128×128） |
| **自由绘制** | 从零原创 | 多图层画板 + 8 种工具 + 6 种对称 + 批量颜色替换 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.13 + Flask + waitress |
| 图像处理 | Pillow、NumPy、scipy、rembg、onnxruntime |
| 前端 | Vite 5 + React 18 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui |
| 状态管理 | Zustand（Editor / UI / Config 三 Store）|
| 颜色匹配 | OKLab 感知均匀空间 |
| UI 设计 | NookUI（Animal Crossing 马卡龙风格）|
| Toast | Sonner + NookUI 自定义样式 |
| 测试 | Vitest（前端）+ pytest（后端）|

---

## 项目结构

```
CC-PinDou/
├── server/                     # Flask 后端
│   ├── app.py                  # 路由入口
│   ├── image_processing.py     # AI 背景移除、线条增强
│   ├── pixel_processing.py     # 像素图自动检测
│   ├── export_generator.py     # 高清图纸导出
│   ├── colors.py               # 色号数据库（SQLite + cKDTree）
│   ├── models_manager.py       # rembg ONNX 模型管理
│   ├── tests/                  # pytest 测试套件
│   └── uploads/                # 临时上传目录
│
├── frontend/
│   ├── public/                 # 静态资源
│   ├── src/
│   │   ├── components/         # React 组件
│   │   │   ├── CanvasEditor.tsx, Toolbar.tsx, ParamPanel.tsx, PixelPanel.tsx
│   │   │   ├── DrawToolBar.tsx, EditPanel.tsx, LayerPanel.tsx, BeadLayerPanel.tsx
│   │   │   ├── ImageLayerPanel.tsx, LegendBar.tsx, FloatingZoom.tsx
│   │   │   ├── ExportModal.tsx, SaveModal.tsx, ImageCropModal.tsx, PixelAlignModal.tsx
│   │   │   ├── RemoveBgButton.tsx, ModeTabs.tsx, ImageUploader.tsx
│   │   │   ├── BgRemovePanel.tsx, SettingsPanel.tsx, ModeBackground.tsx
│   │   │   ├── ColorPickerPopover.tsx, GridLineColorPicker.tsx, ToolPropertiesPopover.tsx
│   │   │   └── ui/             # shadcn/ui 基础组件
│   │   ├── api/                # API 客户端（fetch 封装）
│   │   ├── engine/             # OKLab 颜色匹配 + 网格生成 + BFS 连通合并
│   │   ├── hooks/              # 自定义 Hooks（含后端健康检测 useBackendHealth）
│   │   ├── pages/              # 页面组件（EntryPage）
│   │   ├── store/              # Zustand 状态管理
│   │   ├── styles/             # 全局样式 + NookUI 设计令牌
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── utils/              # 工具函数（含 pixelPreview.ts）
│   │   ├── workers/            # Web Worker
│   │   └── App.tsx, Router.tsx, main.tsx
│   ├── package.json            # npm 依赖（版本 1.0.0）
│   ├── vite.config.ts          # Vite 配置（代理 /api 和 /export 到后端）
│   └── vitest.config.ts        # Vitest 配置
│
├── data/
│   ├── colors.db               # SQLite 色号数据库（运行时自动生成）
│   └── colorSystemMapping.json # 5 品牌色号映射源数据
│
├── models/                     # ONNX 模型文件（rembg 使用，首次运行自动下载）
├── scripts/                    # 调试脚本
├── NookUI/                     # NookUI 组件库（独立子项目，.gitignore 忽略）
├── run.py                      # 生产启动入口（waitress，端口 5678）
├── build.py                    # 前后端联合构建脚本
└── requirements.txt            # Python 依赖
```

---

## 安装与启动

### 后端

```bash
# 环境要求：Python >= 3.13
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python run.py                  # 端口 5678
```

> `rembg` 首次使用会自动下载 ONNX 模型到 `models/` 目录。

### 前端

```bash
# 环境要求：Node.js >= 18
cd frontend
npm install
npm run dev                    # 端口 6789，自动代理 /api 到 localhost:5678
```

### 生产构建

```bash
python build.py                # 联合构建（含环境检查、测试、前端构建）
# 或
python build.py --skip-tests   # 跳过测试快速构建
```

---

## 测试

```bash
# 前端
cd frontend
npm test

# 后端
cd server
python -m pytest tests/ -v
```

---

## 分支说明

| 分支 | 说明 |
|------|------|
| **`full-stack`**（默认） | 完整前后端分离版本，Python 后端提供 AI 背景移除、高清导出 |
| **`frontend-only`** | 纯前端静态部署版本，无后端依赖 |

---

## License

MIT License
