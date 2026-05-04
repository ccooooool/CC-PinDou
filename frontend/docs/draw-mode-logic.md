# 绘制模式（Free Draw Mode）逻辑与功能梳理

## 1. 模式架构

### 1.1 入口
- 应用有三种模式：`mode: 'normal' | 'pixel' | 'draw'`（存储在 `useUIStore`）
- 绘制模式通过顶部工具栏的「自由绘制」按钮切换进入
- 进入后 `mode === 'draw'`，整个界面布局切换为绘制专用布局

### 1.2 状态管理分层

| Store | 职责 | 关键字段 |
|---|---|---|
| `useUIStore` | UI 状态（工具、面板、参数） | `drawTool`, `symmetryMode`, `brushSize`, `shapeFilled`, `replaceMode`, `replaceSourceColor`, `replaceTargetColor`, `replaceTargetCodes` |
| `useEditorStore` | 编辑器数据（图层、画布、历史） | `layers`, `activeLayerId`, `gridData`, `selectedColor`, `historyStack`, `redoStack`, `selectedCells` |
| `useConfigStore` | 全局配置（品牌、画布配置） | `brand`, `canvasConfig`（`beadSize`, `margin`, `zoomLevel`, `circleMode`） |

### 1.3 激活图层视图
- `gridData` 是**激活图层**的视图，直接反映当前激活 `bead` 图层的数据
- 对 `gridData` 的修改会通过 `pushHistory` 记录，并通过 Immer 的 `setAutoFreeze(false)` 允许直接原地修改（性能优化）
- 切换 `activeLayerId` 时，`gridData` 会自动同步到对应图层的 `gridData`

---

## 2. 工具系统（8 种工具）

| 工具 | 键名 | 功能 | 右键设置 | 画笔粗细 |
|---|---|---|---|---|
| **笔刷** | `pen` | 按住拖动连续绘制 | 笔刷大小 | ✅ |
| **直线** | `line` | 点击起点→拖动→松开终点，绘制直线 | 线条粗细 + 内部填充 | ✅ |
| **矩形** | `rect` | 点击起点→拖动→松开终点，绘制矩形 | 线条粗细 + 内部填充 | ✅ |
| **圆形** | `circle` | 点击圆心→拖动调整半径，绘制圆形 | 线条粗细 + 内部填充 | ✅ |
| **填充** | `fill` | 点击格子，flood-fill 填充相连同色区域 | ❌ | ❌ |
| **橡皮** | `eraser` | 按住拖动，将格子设为 transparent | 笔刷大小 | ✅ |
| **魔棒** | `wand` | 点击格子，选中相连同色区域（`selectedCells`） | ❌ | ❌ |
| **替换** | `replace` | 双模式：替换画笔 / 全局替换 | 模式切换 | ✅ |

### 2.1 笔刷类工具（pen / eraser / replace-brush）

**交互流程：**
1. `mousedown` → `setIsBatchPainting(true)` → 初始化 `batchPositionsRef` 和 `batchPaintedSetRef`
2. `mousemove`（按住）→ 对当前格子调用 `paintAt(cx, cy)` → 收集 `PaintRecord` → 去重后存入 `batchPositionsRef`
3. `mouseup` → `setIsBatchPainting(false)` → 将 `batchPositionsRef` 作为 `batch_paint` 历史记录 `pushHistory`

**`paintAt` 逻辑：**
```
以 (cx, cy) 为中心，brushSize 为边长画一个方形区域
half = floor(brushSize / 2)
遍历 dx ∈ [-half, half], dy ∈ [-half, half]
  对每个格子 (cx+dx, cy+dy) 调用 paintCell
  再对 paintCell 的结果应用 getSymmetricPositions（对称扩展）
```

**`paintCell` 逻辑：**
```
if (drawTool === 'replace' && replaceMode === 'brush'):
  if (oldColor !== replaceSourceColor) return null  // 不匹配源色，不绘制
  newColor = replaceTargetColor
  newCodes = replaceTargetCodes
else:
  newColor = selectedColor.hex（或 forceColor）
  newCodes = selectedColor.codes（或 forceCodes）

if (oldColor === newColor) return null
cell.color = newColor; cell.codes = newCodes
return PaintRecord
```

### 2.2 形状工具（line / rect / circle）

**交互流程：**
1. `mousedown` → `setIsDrawing(true)` → 记录 `drawStartRef = pos`
2. `mousemove`（全局）→ 更新 `lastPosRef` → 调用 `setShapePreview({ start, end, tool, enabled: true })` 触发实时预览
3. `mouseup` → `setIsDrawing(false)` → 根据工具计算所有点 → 对每个点调用 `paintAt` → `pushHistory`

**各形状点计算：**
- **line**: Bresenham 算法连接起点和终点
- **rect**: 矩形范围内所有点；`shapeFilled=false` 时只取边框
- **circle**: 中点圆算法 + 半径 = 起点到终点的距离；`shapeFilled=true` 时填充圆内所有点

### 2.3 填充工具（fill）

- 点击格子获取 `targetColor`
- 使用 `floodFill`（四邻域 BFS）找到所有相连的同色格子
- 将这些格子全部设为 `selectedColor`
- 直接 `pushHistory`，不走 `batchPositionsRef`

### 2.4 魔棒工具（wand）

- 点击格子获取颜色
- `magicWandSelect(x, y, append)`：找到所有相连同色格子，存入 `selectedCells`
- `append=true`（按住 Shift）时追加选区，否则替换选区
- 选区用黄色虚线框高亮显示

### 2.5 替换工具（replace）

**双模式切换**（右键弹窗）：

| 模式 | 交互 | 逻辑 |
|---|---|---|
| **替换画笔** | 按住拖动绘制 | 仅当格子颜色 === `replaceSourceColor` 时，替换为 `replaceTargetColor` |
| **全局替换** | 点击任意格子 | 将画布中所有该颜色全局替换为 `replaceTargetColor` |

**颜色系统关联：**
- 目标色 = `selectedColor`（前景色，也是当前绘制颜色）
- 源色 = `replaceSourceColor`（背景色，仅用于匹配）
- ColorPickerPopover 选择「目标色」时同时更新 `selectedColor` + `replaceTargetColor`
- ColorPickerPopover 选择「源色」时只更新 `replaceSourceColor`

---

## 3. 颜色系统

### 3.1 PS 风格双色选择器（ColorPickerPopover）

**按钮区域（工具栏中）：**
```
┌─────────────┐
│    ┌───┐    │  右上角小方块 = 源色（14×14）
│    │源 │    │  左下角大方块 = 目标色（22×22）
│ ┌──┘   │    │  右下角 = ⇄ 交换箭头
│ │目标  │    │
└─────────────┘
```

- **点击大方块** → 打开颜色面板，模式 = 目标色
- **点击小方块** → 打开颜色面板，模式 = 源色
- **点击交换箭头** → 互换目标色和源色（同时更新 `selectedColor`）

**弹出面板：**
- 顶部「目标色 / 源色」切换
- 第二行「全色 / 221色」切换
- 颜色网格（5 列），点击选择

### 3.2 颜色数据来源
- `colorSystemMapping.json`：hex → { MARD: code, ... }
- 按品牌代码排序显示

---

## 4. 对称系统

### 4.1 7 种对称模式

| 模式 | 描述 | 对称点计算 |
|---|---|---|
| `none` | 无对称 | 仅自身 |
| `horizontal` | 水平对称（上下） | (x, rows-1-y) |
| `vertical` | 垂直对称（左右） | (cols-1-x, y) |
| `quad` | 四向对称 | 水平 + 垂直 + 中心对称 |
| `diagonal` | 主对角线对称（y=x） | (y, x) |
| `diagonal_anti` | 反对角线对称 | (cols-1-y, rows-1-x) |
| `diagonal_quad` | 四向对角对称 | 主对角 + 反对角 + 中心对称 |

### 4.2 对称位置计算
- `getSymmetricPositions(x, y)`：根据 `symmetryMode` 返回所有对称位置（去重 + 边界检查）
- `paintAt` 对每个基础位置调用 `getSymmetricPositions`，然后对每个对称位置调用 `paintCell`
- 画布上绘制粉色虚线对称轴标识

---

## 5. 变换系统

### 5.1 翻转（Flip）
- 合并按钮：水平翻转 / 垂直翻转
- 左键：执行当前方向的翻转
- 右键：弹出方向选择菜单
- 底层调用 `flipHorizontal()` / `flipVertical()`（反转 gridData 的行/列顺序）

### 5.2 旋转（Rotate）
- 合并按钮：顺时针 90° / 逆时针 90°
- 左键：执行当前方向的旋转
- 右键：弹出方向选择菜单
- 底层调用 `rotateCW()` / `rotateCCW()`（矩阵转置 + 反转）

---

## 6. 图层系统

### 6.1 图层类型

| 类型 | 数据 | 渲染方式 |
|---|---|---|
| `bead` | `gridData: GridCell[][]` | 逐格渲染颜色/3D 效果 |
| `image` | `imageUrl: string` + `transform` | Canvas `drawImage`，支持拖拽移动、缩放、旋转 |

### 6.2 图层操作
- **新建 bead 图层**：`addBeadLayer(name, size)` → 创建空白网格
- **新建 image 图层**：`addImageLayer(name, imageUrl)` → 文件上传（FileReader → dataURL）或 URL
- **排序**：`reorderLayer(id, 'up'|'down')` → 交换 zIndex
- **合并**：`mergeLayerDown(id)` → 将当前图层内容合并到下方图层
- **透明度**：`updateLayerOpacity(id, opacity)` → 0~100
- **锁定**：`toggleLayerLock(id)` → 锁定后 canvas 不可编辑
- **可见性**：`toggleLayerVisible(id)` → 不可见图层不渲染

### 6.3 渲染顺序
```
对所有 visible 图层按 zIndex 升序排序
for each layer:
  ctx.globalAlpha = layer.opacity / 100
  if bead layer: drawNormalBeads / draw3DBeads
  if image layer: drawImageLayer
  if active layer: 绘制蓝色虚线边框
```

---

## 7. 历史记录系统

### 7.1 历史记录类型

```typescript
interface HistoryAction {
  type: 'batch_paint' | 'add_layer' | 'delete_layer' | 'merge_layer' | ...;
  layerId: string;
  positions: PaintRecord[];  // 对于 batch_paint
}

interface PaintRecord {
  x, y, oldColor, oldCodes, newColor, newCodes
}
```

### 7.2 Undo / Redo
- **Undo**：弹出 `historyStack` 栈顶，根据 `PaintRecord[]` 逐个恢复 `oldColor`/`oldCodes`，压入 `redoStack`
- **Redo**：弹出 `redoStack` 栈顶，根据 `PaintRecord[]` 逐个应用 `newColor`/`newCodes`，压回 `historyStack`
- 每次绘制操作（mouseup）将本次所有 `PaintRecord` 作为一条 `batch_paint` 记录 `pushHistory`

---

## 8. 画笔预览系统

### 8.1 Shape 预览（line / rect / circle）
- 由 `shapePreviewRef` 控制
- `mousedown` 后开始，`mousemove` 时更新，`mouseup` 时清除
- 绘制方式：粉色虚线（`rgba(255, 107, 157, 0.9)`，`lineDash: [4, 4]`）

### 8.2 画笔大小预览（pen / eraser / replace-brush）
- 由 `brushPreviewRef` 控制
- **鼠标未按下时**，在 `mousemove` 中更新预览位置
- **鼠标按下时**，自动隐藏预览
- **鼠标移出 canvas**，清除预览
- 绘制方式：
  - 粉色虚线边框（`rgba(255, 107, 157, 0.8)`，`lineDash: [3, 3]`）
  - `circleMode=true` 时绘制圆形预览，`false` 时方形预览
  - 中心十字准星（4px）

---

## 9. 渲染系统（useCanvasRenderer）

### 9.1 drawGrid 主循环

```
1. 计算画布尺寸（cols × beadSize + margin × 2）
2. 清空画布 → 白色背景
3. 绘制棋盘格背景（透明 pattern）
4. 遍历所有可见图层（按 zIndex 排序）
   - bead 图层：drawNormalBeads / draw3DBeads
   - image 图层：drawImageLayer
   - 激活图层：蓝色虚线边框
5. 绘制网格线
6. 标记孤立像素（红色圆点）
7. 标记不稳定结构（橙色方框）
8. 绘制对称轴（绘制模式下）
9. 绘制魔法棒选区（黄色虚线框）
10. 绘制 Shape 预览
11. 绘制画笔大小预览
```

### 9.2 渲染模式
- **Normal**：方形格子直接 `fillRect`，或 `circleMode` 时绘制圆
- **3D**：径向渐变模拟圆柱体 + 内孔 + 高光

---

## 10. 鼠标事件流

### 10.1 事件注册
```tsx
<canvas
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseLeave}
/>
// 全局监听（用于 shape 预览和 canvas 外释放兜底）
document.addEventListener('mousemove', handleGlobalMouseMove)
document.addEventListener('mouseup', handleGlobalMouseUp)
```

### 10.2 mousedown 处理流程
```
1. Space 按下 → startDrag（平移画布）
2. Image 图层激活 → 记录拖拽起始位置
3. 图层锁定 → 直接返回
4. 获取 grid 坐标 pos
5. 根据 drawTool 分发：
   - wand → magicWandSelect
   - fill → floodFill + pushHistory
   - line/rect/circle → setIsDrawing(true) + drawStartRef = pos
   - replace(brush) → setIsBatchPainting(true) + paintAt
   - replace(global) → replaceColorGlobally
   - pen/eraser → setIsBatchPainting(true) + paintAt
```

### 10.3 mousemove 处理流程
```
1. Space 拖拽 → onDragMove
2. e.buttons !== 1（未按下）：
   - 清理 batch painting（如有）
   - 更新画笔大小预览（笔刷类工具）
   - 返回
3. e.buttons === 1（按住）：
   - 隐藏画笔预览
   - 获取 pos
   - batch painting → paintAt + 收集记录 + scheduleDrawGrid
```

### 10.4 mouseup 处理流程
```
1. stopDrag
2. Image 拖拽结束 → 清除 ref
3. line/rect/circle（isDrawing=true）：
   - 计算所有形状点
   - 对每个点 paintAt
   - pushHistory + scheduleDrawGrid
4. 其他 batch painting：
   - pushHistory + 清理 refs
```

### 10.5 全局 mousemove（document）
- 仅处理 `isDrawing`（shape 预览）
- 更新 `lastPosRef` → `setShapePreview`

### 10.6 全局 mouseup（document）
- 兜底：canvas 外释放时也要清理所有绘制状态
- 清理 batch painting、shape preview、image drag

---

## 11. 配置 Badge 与右键菜单

### 11.1 ConfigBadge（粉色小三角）
- 显示在支持右键配置的工具按钮右下角
- 使用 `<i>` 元素 + `clip-path` 三角形
- 避免被 `.dop-tool span { position: relative }` CSS 覆盖

### 11.2 右键菜单系统
| 按钮 | 右键行为 |
|---|---|
| 笔刷/直线/矩形/圆形/橡皮/替换 | 打开 ToolPropertiesPopover（该工具专属设置） |
| 翻转 | 打开方向选择弹窗（水平/垂直） |
| 旋转 | 打开方向选择弹窗（顺时针/逆时针） |
| 对称模式 | 打开对称模式选择弹窗（7 种） |
| 清空画板 | 禁用右键菜单 |

**关键设计**：右键时通过 `targetTool` 传入被右键的工具 key，确保弹窗显示的是该工具的设置（而非当前选中工具的设置）。
