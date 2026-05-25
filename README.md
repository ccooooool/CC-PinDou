# CC-PinDou 拼豆图案生成器

> 版本：v1.0.0（纯前端版）

将任意图片转换为拼豆（Perler Beads）制作图纸的纯前端 Web 工具，支持普通照片转换、像素图识别、自由绘制三种模式。内置 5 个国内拼豆品牌色号映射，采用 OKLab 颜色空间匹配，可导出高清图纸和材料清单。

**本分支为纯前端静态部署版本**，无后端依赖，所有计算在浏览器中完成。

---

## 三种工作模式

| 模式 | 适用场景 | 核心能力 |
|------|----------|----------|
| **普通图片** | 照片、插画 | 前端背景移除 → 颜色简化 → OKLab 色号匹配 → 拼豆网格 |
| **像素图** | 游戏素材、像素插画 | 自动像素块检测 + 对齐偏移微调 → 精确像素网格（上限 128×128） |
| **自由绘制** | 从零原创 | 多图层画板 + 8 种工具 + 6 种对称 + 批量颜色替换 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vite 5 + React 18 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui |
| 状态管理 | Zustand（Editor / UI / Config 三 Store）|
| 颜色匹配 | OKLab 感知均匀空间 |
| UI 设计 | NookUI（Animal Crossing 马卡龙风格）|
| Toast | Sonner + NookUI 自定义样式 |
| 测试 | Vitest（jsdom）|

---

## 项目结构

```
CC-PinDou/
├── frontend/
│   ├── public/                 # 静态资源（logo.svg 等）
│   ├── src/
│   │   ├── components/         # React 组件
│   │   │   ├── CanvasEditor.tsx, Toolbar.tsx, ParamPanel.tsx, PixelPanel.tsx
│   │   │   ├── DrawToolBar.tsx, EditPanel.tsx, LayerPanel.tsx, BeadLayerPanel.tsx
│   │   │   ├── ImageLayerPanel.tsx, LegendBar.tsx, FloatingZoom.tsx
│   │   │   ├── ExportModal.tsx, SaveModal.tsx, ImageCropModal.tsx, PixelAlignModal.tsx
│   │   │   ├── RemoveBgButton.tsx, ModeTabs.tsx, ImageUploader.tsx
│   │   │   ├── BgRemovePanel.tsx, SettingsPanel.tsx, ModeBackground.tsx
│   │   │   ├── ColorPickerPopover.tsx, GridLineColorPicker.tsx, ToolPropertiesPopover.tsx
│   │   │   └── ui/             # shadcn/ui 基础组件（Button、Slider、Toast 等）
│   │   ├── engine/             # OKLab 颜色匹配 + 网格生成 + BFS 连通合并
│   │   ├── hooks/              # 自定义 Hooks（Canvas 渲染、绘制工具、图案生成等）
│   │   ├── pages/              # 页面组件（EntryPage）
│   │   ├── store/              # Zustand 状态管理
│   │   ├── styles/             # 全局样式 + NookUI 设计令牌
│   │   ├── types/              # TypeScript 类型定义
│   │   ├── utils/              # 工具函数
│   │   ├── workers/            # Web Worker（重型计算卸载）
│   │   └── App.tsx, Router.tsx, main.tsx
│   ├── package.json            # npm 依赖（版本 1.0.0）
│   ├── vite.config.ts          # Vite 配置
│   └── vitest.config.ts        # Vitest 配置
│
├── data/
│   └── colorSystemMapping.json # 5 品牌色号映射源数据
│
├── scripts/                    # 调试脚本
└── web_backup/                 # 旧版前端参考
```

---

## 安装与启动

```bash
# 环境要求：Node.js >= 18
cd frontend
npm install
npm run dev          # 端口 6789
```

### 生产构建

```bash
npm run build        # 输出到 frontend/dist/
```

构建产物可直接部署到 GitHub Pages / Vercel / Netlify / Cloudflare Pages 等静态托管服务。

---

## 测试

```bash
npm test              # 运行一次
npm run test:watch    # 监听模式
```

---

## 分支说明

| 分支 | 说明 |
|------|------|
| **`full-stack`**（默认） | 完整前后端分离版本，Python 后端提供 AI 背景移除、高清导出 |
| **`frontend-only`** | 纯前端静态部署版本，无后端依赖 |

---

## 相关链接

- **项目仓库**
  - Gitee：https://gitee.com/ccoooool/CC-PinDou
  - GitHub：https://github.com/ccooooool/CC-PinDou
- **字体**：文源圆体 [WenYuanFonts](https://github.com/takushun-wu/WenYuanFonts)
- **像素模式图标**：[NES.css](https://github.com/nostalgic-css/NES.css)
  > Nintendo owns the copyright of these characters. Please comply with the Nintendo guidelines and laws of the applicable jurisdiction.
- **UI 设计系统**：[NookUI](https://gitee.com/ccoooool/NookUI)

---

## 支持项目

如果觉得本项目对你有帮助，欢迎打赏支持！

> 打赏前请务必仔细检查付款账户（支付宝：粥叉叉 / 微信：淡定从容）。上述账户为唯一正式受捐账户。若发现账户信息与二维码不符，请立刻举报。打赏款项一经转账恕不退还，请慎重考虑。（未成年人请取得法定监护人许可后方可捐助）

<p align="center">
  <img src="打赏收款码/微信收款码.png" width="200" alt="微信收款码" />
  <img src="打赏收款码/支付宝收款码.jpg" width="200" alt="支付宝收款码" />
</p>

---

## License

MIT License
