# CC-PinDou 拼豆图案生成器

将任意图片转换为拼豆（Perler Beads / 融合珠）制作图纸的 Web 工具。支持普通照片智能转换、像素风图片精确识别和自由绘制三种工作模式，内置多品牌色号映射，可导出带图例的高清制作图纸。

---

## 功能特性

### 普通图片模式
- **上传图片** — 支持 JPG、PNG、GIF、BMP、WebP 格式，支持拖拽上传
- **Cropper.js 裁剪** — 上传后可选择裁剪区域，或直接使用原图
- **AI 背景移除** — 基于 rembg（U2-Net / ISNet / Silueta 等多模型），自动分离主体
- **颜色简化** — 0~100 可调，控制最终使用的颜色数量
- **线条增强** — 优化黑色轮廓连续性
- **多品牌色号映射** — 自动将图片颜色匹配到最接近的拼豆色号

### 像素图模式
- **像素风图片专用** — 针对游戏素材、像素插画优化
- **自动像素大小检测** — 基于边缘间隔直方图 + 块内一致性算法，自动识别像素块尺寸
- **对齐预览** — 方向键微调偏移，滚轮缩放，实时红色网格叠加预览
- **长宽独立设置** — 支持非正方形像素块（如 16×20）
- **多种采样方式** — 中心点 / 众数 / 平均值
- **背景移除** — 检测边框主色并去除

### 自由绘制模式
- **空白画板** — 自定义尺寸，从零开始创作
- **多种绘制工具** — 画笔、直线、矩形、圆形、填充、橡皮擦
- **笔刷大小调节** — 1×1 到 11×11
- **6 种对称模式** — 水平/垂直/四象限/对角线镜像
- **实时预览** — 普通方块 / 圆形珠子 / 3D 热熔三种渲染模式

### 编辑与导出
- **交互式画板** — 点击格子换色、空格拖拽平移、滚轮缩放
- **色号显示** — 格子内显示当前品牌色号（A01、B12 等）
- **颜色图例** — 统计各颜色用量，支持排序筛选
- **撤销 / 重做** — 支持操作历史栈
- **批量替换颜色** — 一键替换整个图案中的某个颜色
- **图纸变换** — 水平/垂直翻转、顺时针/逆时针旋转
- **质量检查** — 自动标记孤立像素和细长不稳定结构
- **3D 热熔预览** — 模拟烫拼豆后的融合效果
- **声音反馈** — Web Audio API 实时音效（可关闭）
- **IndexedDB 自动保存** — 刷新页面不丢失工作进度
- **导出设置** — 图片名称、PNG/JPG 格式、色号/图例/标识线开关
- **材料清单导出** — CSV / Excel（xlsx）格式，含各颜色用量统计

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Python 3.12 + Flask |
| 图像处理 | Pillow、NumPy、scipy、rembg、onnxruntime |
| 数据库 | SQLite（色号映射） |
| 前端 | Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui |
| 状态管理 | Zustand |
| 颜色匹配 | OKLab 感知均匀空间（前端计算） |
| UI 组件 | pindou-theme（多巴胺可爱风格） |
| 测试 | Vitest（前端）+ pytest（后端） |

---

## 项目结构

```
CC-PinDou/
├── run.py                      # 后端启动入口（Flask）
├── build.py                    # 前后端联合构建脚本
├── requirements.txt            # Python 依赖
│
├── server/                     # Flask 后端
│   ├── app.py                  # 路由入口
│   ├── config.py               # 全局配置、参数边界
│   ├── colors.py               # 色号数据库（SQLite + JSON）
│   ├── utils.py                # 工具函数
│   ├── image_processing.py     # 图像预处理（背景移除、线条增强）
│   ├── normal_processing.py    # 普通图 → 拼豆图案
│   ├── pixel_processing.py     # 像素图 → 拼豆图案（含自动检测）
│   ├── export_generator.py     # 高清图纸导出（PNG/JPG）
│   ├── models_manager.py       # rembg 模型加载
│   ├── tests/                  # pytest 测试套件
│   └── uploads/                # 临时上传目录
│
├── frontend/                     # 前端（Vite + React 18 + TS）
│   ├── src/
│   │   ├── components/         # React 组件
│   │   │   ├── CanvasEditor.tsx       # 主画板编辑器
│   │   │   ├── PixelPanel.tsx         # 像素图参数面板
│   │   │   ├── NormalPanel.tsx        # 普通图参数面板
│   │   │   ├── Toolbar.tsx            # 顶部工具栏
│   │   │   ├── DrawToolbar.tsx        # 绘制模式工具栏
│   │   │   ├── ColorLegend.tsx        # 颜色图例
│   │   │   ├── RemoveBgButton.tsx     # AI 背景移除按钮（SSE 进度）
│   │   │   └── ...
│   │   ├── hooks/              # 自定义 Hooks
│   │   │   ├── useCanvasRenderer.ts   # Canvas 渲染逻辑
│   │   │   ├── useDrawingTools.ts     # 绘制工具（Bresenham/FloodFill）
│   │   │   └── usePanZoom.ts          # 滚轮缩放 + 空格拖拽
│   │   ├── store/
│   │   │   └── usePerlerStore.ts      # Zustand 全局状态
│   │   ├── engine/
│   │   │   └── PerlerEngine.ts        # OKLab 颜色匹配 + 网格生成
│   │   ├── utils/
│   │   │   ├── soundEngine.ts         # Web Audio 音效
│   │   │   ├── colorUtils.ts          # 颜色统计工具
│   │   │   └── colorList.test.ts      # Vitest 单元测试
│   │   ├── types/
│   │   │   └── perler.ts              # TypeScript 类型定义
│   │   ├── styles/
│   │   │   └── pindou-theme.css       # 拼豆主题样式（多巴胺可爱风格）
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   └── tailwind.config.js
│
├── web/                        # 旧版前端（废弃，保留参考）
│
├── data/
│   ├── colors.db               # SQLite 色号数据库
│   └── colorSystemMapping.json # 多品牌色号映射表
│
└── models/                     # ONNX 模型文件
    ├── u2net.onnx
    ├── isnet-anime.onnx
    ├── silueta.onnx
    └── u2net_human_seg.onnx
```

---

## 安装

### 1. 克隆仓库

```bash
git clone <仓库地址>
cd CC-PinDou
```

### 2. 后端环境

```bash
# 创建 Python 虚拟环境（推荐）
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

> **注意**：`rembg` 首次运行时会自动下载 AI 模型（约 168MB）到 `~/.u2net/` 目录。如果下载缓慢，可手动将模型文件放入该目录。

### 3. 前端环境

```bash
cd frontend
npm install
```

---

## 启动

### 开发模式

```bash
# 终端 1：启动后端
cd server
python app.py

# 终端 2：启动前端 dev server
cd frontend
npm run dev
```

前端 dev server 默认运行在 `http://localhost:5173`，后端在 `http://localhost:5001`。

### 生产构建

```bash
# 构建前端（输出到 frontend/dist/）
cd frontend
npm run build

# 启动后端（会自动 serve frontend/dist/）
cd ../server
python app.py
```

或使用联合构建脚本：
```bash
python build.py
```

---

## 测试

### 前端测试

```bash
cd frontend
npx vitest run
```

### 后端测试

```bash
cd server
python -m pytest tests/ -v
```

---

## 使用说明

### 普通图片模式

1. 点击左侧「上传图片」区域选择照片
2. 在裁剪弹窗中选择需要保留的区域，或点击「不裁剪，直接上传」使用原图
3. 调整参数：网格大小、是否移除背景、颜色简化程度等
4. 点击「生成拼豆图案」
5. 在右侧画板中可点击格子修改颜色，使用顶部工具栏缩放、撤销、显示/隐藏色号
6. 点击「导出」设置文件名、格式等选项后下载制作图纸

### 像素图模式

1. 切换到「像素图」标签页
2. 上传像素风图片（如游戏素材、像素插画）
3. 裁剪或直接使用原图
4. 设置画板大小、像素大小（可点击「自动检测」）
5. 可选点击「对齐预览」进入可视化网格对齐模式，方向键微调偏移
6. 点击「生成拼豆图案」

### 自由绘制模式

1. 切换到「自由绘制」标签页
2. 设置画板尺寸（如 29×29）
3. 选择颜色，使用画笔工具在空白画板上创作
4. 或切换直线/矩形/圆/填充工具进行几何绘制
5. 开启对称模式可快速创建对称图案

---

## 支持的颜色品牌

项目内置 5 个国内主流拼豆品牌的色号映射，可在「品牌」下拉框切换：

| 品牌 | 说明 |
|------|------|
| **MARD** | 默认品牌，色号格式 A01、B02… |
| **COCO** | 色号格式 D01、E02… |
| **漫漫** | 色号格式 A1、B2… |
| **盼盼** | 数字色号 |
| **咪小窝** | 数字色号 |

色号数据存储在 `data/colorSystemMapping.json`，数据库文件为 `data/colors.db`。

---

## 核心算法说明

### 颜色匹配
- **OKLab 感知均匀空间** — 使用前端 `PerlerEngine.ts` 将 RGB 转换到 OKLab 空间，计算感知距离，匹配最接近的拼豆色号。比传统 RGB 欧氏距离更符合人眼感知。

### 普通图片模式
- **K-Means 聚类** — 将图片颜色聚类为拼豆可用的有限色板
- **最近色匹配** — 每个像素匹配到色板中 OKLab 距离最小的颜色
- **颜色量化** — 通过中位切分算法减少颜色数量
- **背景移除** — rembg（U2-Net）分割前景背景

### 像素图模式
- **边缘间隔直方图** — 检测像素块边界的周期性间隔
- **模分布峰值** — 推断最佳对齐偏移
- **块内一致性验证** — 确认像素块大小候选
- **常见尺寸偏好** — 对 16/24/32/48/64 等常见像素尺寸给予优先

---

## 注意事项

1. **编码**：全项目使用 UTF-8 无 BOM 编码。
2. **模型下载**：首次使用背景移除功能时，`rembg` 会自动从网络下载 ONNX 模型，请确保网络畅通。
3. **大图片**：超过 2000px 的图片会被后端自动缩放处理，避免内存溢出。
4. **临时文件**：上传的文件保存在 `server/uploads/`，程序会在处理完成后自动清理。
5. **浏览器兼容性**：推荐使用 Chrome / Edge / Firefox 最新版。Safari 下 Web Audio 声音反馈可能不可用（不影响核心功能）。

---

## License

MIT License
