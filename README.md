# CC-PinDou 拼豆图案生成器

> 版本：v2.0.0（纯前端版）

将任意图片转换为拼豆（Perler Beads / 融合珠）制作图纸的纯前端 Web 工具。支持普通照片智能转换、像素风素材精确识别、以及自由绘制三种工作模式。内置 5 个国内主流拼豆品牌的色号映射，采用 OKLab 感知均匀颜色空间进行最近色匹配，可导出带图例的高清 PNG/JPG 制作图纸和材料清单。

**本分支为纯前端静态部署版本**，无需 Python 后端，所有计算均在浏览器中完成。

---

## 最新更新

- **Toast 操作反馈** — 覆盖图片上传/清除、背景移除、生成成功/失败、导出成功/失败、恢复备份、清空画板等所有核心操作
- **画笔偶数宽度修复** — 修复 `size=2` 绘成 3×3、`size=4` 绘成 5×5 的 Bug，改为左上角起点严格 `size×size` 范围
- **像素模式 128×128 上限** — 预估尺寸超限变红提示，生成前拦截抛错
- **Logo 彩蛋** — 点击入口页 Logo 触发抖动，连续 7 次触发落叶效果
- **右侧栏条件修复** — 删除/清空画板后正确隐藏绘制提示、工具栏、右侧栏

---

## 功能特性

### 三种工作模式

| 模式 | 适用场景 | 核心能力 |
|------|----------|----------|
| **普通图片** | 照片、插画等任意图片 | 前端背景移除 → 颜色简化 → OKLab 色号匹配 → 拼豆网格 |
| **像素图** | 游戏素材、像素插画 | 自动像素块大小检测 + 对齐偏移微调 → 精确像素网格 |
| **自由绘制** | 从零原创图案 | 多图层画板 + 8 种工具 + 6 种对称 |

### 普通图片模式

- **上传与裁剪** — 支持 JPG、PNG、GIF、BMP、WebP，拖拽上传，集成 Cropper.js 裁剪
- **前端背景移除** — 基于图像边缘检测和颜色聚类的前端降级算法，自动分离前景主体
- **颜色简化** — 0~100 连续可调，控制最终使用的颜色数量
- **线条增强** — 前端降级算法优化黑色轮廓连续性
- **颜色模式** — 全色 / 221 色两档切换

### 像素图模式

- **自动像素大小检测** — 基于边缘间隔直方图 + 块内一致性验证 + 常见尺寸偏好（16/24/32/48/64），自动推断像素块尺寸
- **对齐预览** — 方向键微调偏移，滚轮缩放，红色网格实时叠加预览
- **长宽独立设置** — 支持非正方形像素块（如 16×20）
- **多种采样方式** — 中心点 / 众数 / 平均值
- **背景移除** — 检测边框主色并去除
- **尺寸限制** — 生成前自动检查，超过 128×128 弹窗提示并拦截

### 自由绘制模式

- **空白画板** — 自定义网格尺寸（8×8 ~ 128×128），Slider 与数值输入框联动
- **8 种绘制工具** — 移动、画笔、直线、矩形、圆形、填充、橡皮擦、魔棒选取
- **笔刷大小** — 1×1 到 11×11 可调（偶数宽度严格 `size×size`）
- **批量颜色替换** — 魔棒选取连通区域后一键替换
- **6 种对称模式** — 水平 / 垂直 / 四象限 / 主对角线 / 反对角线 / 四向对角
- **图纸变换** — 水平翻转 / 垂直翻转 / 顺时针 90° / 逆时针 90°
- **多图层系统** — BeadLayer（拼豆格子）+ ImageLayer（背景图片）
  - **拼豆图层**：编辑格子颜色、图例统计、质量检查
  - **图片图层**：上传参考图，自动适配网格起点，支持 XY 位移、缩放（独立/联动）、水平/垂直翻转、90° 旋转
  - **通用控制**：可见性、锁定（保护图层不被误改）、不透明度、层级调整
- **吸管放大镜** — 使用吸管工具时，浮层放大显示当前像素颜色与色值

### 画板与预览

- **三种渲染样式** — 普通方块 / 圆形珠子 / 3D 热熔（模拟烫拼豆后的融合效果）
- **交互式操作** — 点击格子换色、空格拖拽平移、滚轮缩放
- **自定义光标** — 根据当前工具与图层锁定状态自动切换光标样式
- **色号显示** — 格子上叠加当前品牌色号（如 A01、B12）
- **颜色图例** — 底部统计条，按用量排序，支持筛选
- **质量检查** — 自动标记孤立像素和细长不稳定结构
- **撤销 / 重做** — 完整操作历史栈
- **IndexedDB 自动保存** — 刷新页面不丢失工作进度

### 导出与保存

- **高清图纸** — PNG / JPG，含色号、图例、坐标轴开关（前端 Canvas 导出）
- **材料清单** — CSV / Excel（xlsx）格式，含各颜色用量统计
- **工程文件** — `.pindou.json` 格式，保存 gridData、colorList、图层结构和配置参数

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vite 5 + React 18 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui |
| 路由 | React Router v7 |
| 状态管理 | Zustand（三 Store 拆分：Editor / UI / Config）|
| 颜色匹配 | OKLab 感知均匀空间（前端 `PerlerEngine.ts` 计算）|
| 图像处理 | Canvas API + Web Worker（前端降级算法）|
| UI 设计系统 | NookUI（Animal Crossing 马卡龙风格）|
| Toast | Sonner 2.0.7 + NookUI 自定义样式 |
| Tooltip | Radix UI `@radix-ui/react-tooltip` |
| 测试 | Vitest（前端，jsdom）|

---

## 项目结构

```
CC-PinDou/
├── frontend/                   # 前端（Vite + React + TypeScript）
│   ├── src/
│   │   ├── components/         # React 组件
│   │   │   ├── CanvasEditor.tsx       # 主画板编辑器
│   │   │   ├── Toolbar.tsx            # 顶部工具栏（自动保存状态、保存按钮、设置）
│   │   │   ├── ParamPanel.tsx         # 普通图参数面板
│   │   │   ├── PixelPanel.tsx         # 像素图参数面板
│   │   │   ├── DrawToolBar.tsx        # 绘制模式左侧工具栏
│   │   │   ├── EditPanel.tsx          # 绘制模式右侧面板
│   │   │   ├── LayerPanel.tsx         # 图层面板
│   │   │   ├── ImageLayerPanel.tsx    # 图片图层上传与管理
│   │   │   ├── ColorLegend.tsx        # 颜色图例
│   │   │   ├── ExportModal.tsx        # 导出设置弹窗
│   │   │   ├── SaveModal.tsx          # 保存工程弹窗
│   │   │   ├── RemoveBgButton.tsx     # 背景移除按钮
│   │   │   ├── ModeTabs.tsx           # 模式切换标签
│   │   │   ├── ImageUploader.tsx      # 图片上传组件
│   │   │   ├── ImageCropModal.tsx     # 图片裁剪弹窗
│   │   │   ├── BgRemovePanel.tsx      # 背景移除参数面板
│   │   │   ├── SettingsPanel.tsx      # 设置面板
│   │   │   └── ui/                    # shadcn/ui 基础组件
│   │   ├── hooks/              # 自定义 Hooks
│   │   │   ├── useCanvasRenderer.ts   # Canvas 渲染（方块/圆形/3D 热熔三模式）
│   │   │   ├── useCanvasInteractions.ts # 画布交互（点击/拖拽/空格平移）
│   │   │   ├── useDrawingTools.ts     # 绘制工具（Bresenham 直线、FloodFill 填充）
│   │   │   ├── usePanZoom.ts          # 滚轮缩放 + 空格拖拽平移
│   │   │   ├── usePatternGenerator.ts # 图纸生成逻辑（Web Worker + fallback）
│   │   │   ├── usePixelProcessor.ts   # 像素图处理逻辑
│   │   │   ├── usePerlerEngine.ts     # PerlerEngine 封装
│   │   │   ├── useAutoSave.ts         # IndexedDB 自动保存
│   │   │   ├── useProjectExport.ts    # 工程导出
│   │   │   └── useImageUpload.ts      # 图片上传逻辑
│   │   ├── store/              # Zustand 状态管理
│   │   │   ├── useEditorStore.ts      # 编辑状态（gridData、colorList、historyStack、图层系统）
│   │   │   ├── useUIStore.ts          # UI 状态（mode、drawTool、symmetryMode、面板状态）
│   │   │   ├── useConfigStore.ts      # 配置状态（brand、gridSize、colorMode 等）
│   │   │   └── usePerlerStore.ts      # 兼容层（re-export 三个子 Store）
│   │   ├── engine/
│   │   │   ├── PerlerEngine.ts        # OKLab 颜色匹配 + 网格生成 + BFS 连通合并
│   │   │   └── frontendAlgorithms.ts  # 前端降级算法（背景移除、线条增强等）
│   │   ├── workers/
│   │   │   └── perler.worker.ts       # 重型计算卸载（generateGrid + bfsMerge）
│   │   ├── utils/
│   │   │   ├── colorList.ts           # 颜色统计工具
│   │   │   ├── autoSave.ts            # IndexedDB 自动保存底层
│   │   │   └── theme.ts               # 主题相关工具
│   │   ├── types/
│   │   │   └── perler.ts              # TypeScript 类型定义
│   │   ├── styles/
│   │   │   ├── pindou-theme.css       # 基础全局样式
│   │   │   └── nookui-theme.css       # NookUI 设计令牌 + 组件类
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json            # npm 依赖与脚本（版本 2.0.0）
│   ├── vite.config.ts          # Vite 配置（dev 端口 6789）
│   ├── vitest.config.ts        # Vitest 配置
│   └── tailwind.config.js
│
├── data/
│   └── colorSystemMapping.json # 5 品牌色号映射源数据
│
├── NookUI/                     # NookUI 组件库（独立子项目，被 .gitignore 忽略）
│
├── scripts/                    # 调试与工具脚本
└── web_backup/                 # 旧版前端（jQuery + 原生 JS），仅保留参考
```

---

## 安装

### 环境要求

- **Node.js**：>= 18
- **编码**：UTF-8 无 BOM

```bash
git clone <仓库地址>
cd CC-PinDou/frontend
npm install
```

---

## 启动与部署

### 开发模式

```bash
cd frontend
npm run dev          # 端口 6789
```

### 生产构建

```bash
cd frontend
npm run build        # 输出到 frontend/dist/
```

构建产物 `frontend/dist/` 可直接部署到任意静态托管服务：

- [GitHub Pages](https://pages.github.com/)
- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)
- [Cloudflare Pages](https://pages.cloudflare.com/)
- Nginx / Apache 等自建服务器

---

## 测试

```bash
cd frontend
npm test              # 运行一次
npm run test:watch    # 监听模式
```

---

## 使用说明

### 普通图片模式

1. 点击「上传图片」选择照片，支持拖拽
2. 在裁剪弹窗中选择保留区域，或点击「不裁剪，直接上传」使用原图
3. 调整参数：网格大小、背景移除、颜色简化程度、颜色模式（全色/221色）
4. 点击「生成拼豆图案」
5. 在画板中点击格子修改颜色，使用顶部工具栏缩放、撤销、显示/隐藏色号
6. 点击「导出」设置文件名、格式等选项后下载制作图纸

### 像素图模式

1. 切换到「像素图」标签页
2. 上传像素风图片（如游戏素材、像素插画）
3. 裁剪或直接使用原图
4. 设置画板大小、像素大小（可点击「自动检测」）
5. 可选进入「对齐预览」模式，方向键微调偏移、滚轮缩放
6. 点击「生成拼豆图案」

### 自由绘制模式

1. 切换到「自由绘制」标签页
2. 设置画板大小（8×8 ~ 128×128）
3. 选择颜色，使用画笔工具在空白画板上创作
4. 切换直线 / 矩形 / 圆形 / 填充工具进行几何绘制
5. 使用魔棒工具快速选取连通区域，批量替换颜色
6. 开启对称模式可快速创建对称图案
7. （可选）上传参考图片作为背景图层，自动适配网格；通过左侧面板调整位置、缩放、翻转、旋转和不透明度
8. 锁定图层可避免误操作；图层面板可管理多个拼豆图层和图片图层的叠加顺序

---

## 支持的颜色品牌

内置 5 个国内主流拼豆品牌的色号映射：

| 品牌 | 说明 |
|------|------|
| **MARD** | 默认品牌，色号格式 A01、B02… |
| **COCO** | 色号格式 D01、E02… |
| **漫漫** | 色号格式 A1、B2… |
| **盼盼** | 数字色号 |
| **咪小窝** | 数字色号 |

色号数据存储在 `frontend/src/data/colorSystemMapping.json`。

---

## 核心算法

### 颜色匹配

项目使用 **OKLab 感知均匀颜色空间** 进行最近色匹配（位于 `frontend/src/engine/PerlerEngine.ts`）。OKLab 比传统 RGB 欧氏距离更符合人眼感知，对近似色的区分更精确。

### 普通图片模式

- **K-Means 聚类** — 将图片颜色聚类为拼豆可用色板
- **最近色匹配** — 每个像素匹配到色板中 OKLab 距离最小的颜色
- **背景移除** — 前端降级算法（基于颜色聚类和边缘检测）

### 像素图模式

- **边缘间隔直方图** — 检测像素块边界的周期性间隔
- **模分布峰值** — 推断最佳对齐偏移
- **块内一致性验证** — 确认像素块大小候选
- **常见尺寸偏好** — 对 16/24/32/48/64 等常见像素尺寸给予优先

---

## 分支说明

| 分支 | 说明 |
|------|------|
| **`full-stack`**（默认） | 完整前后端分离版本，后端 Python 提供 AI 背景移除、线条增强、高清导出 |
| **`frontend-only`** | 纯前端静态部署版本，AI 背景移除和导出使用前端降级算法，无后端依赖 |

---

## 注意事项

1. **编码**：全项目强制 UTF-8 无 BOM。
2. **纯前端限制**：
   - 背景移除使用前端降级算法，效果不如后端 rembg（U2-Net）精确
   - 导出图纸使用前端 Canvas 渲染，精度和排版略逊于后端生成器
   - 大图片处理受浏览器内存限制
3. **自动保存限制**：IndexedDB 自动保存不恢复图片文件状态（blob URL 无法持久化），仅保存 gridData、colorList 和图层结构。
4. **浏览器兼容性**：推荐使用 Chrome / Edge / Firefox 最新版。

---

## License

MIT License
