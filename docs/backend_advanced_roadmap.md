# 后端"高级版"技术路线

> 目标：前后端基础算法一致，后端利用服务器算力在数据规模、智能策略、替代算法、独有功能上全面超越前端。

---

## 一、架构总览

```
前端（浏览器）              后端（Python）
─────────────────           ─────────────────────────────
OKLab 颜色匹配    <────>    OKLab 颜色匹配（Phase 1）
4-bit 主导色提取  <────>    4-bit 主导色提取（Phase 2：原图分辨率）
固定阈值 BFS      <────>    自适应 BFS（Phase 3）
max 800px 缩放              原始分辨率分析
无全局优化                  全局色号限制优化（Phase 3）
                            替代量化算法（Phase 4 实验性）
                            渲染美化（Phase 5 可选导出）
                            AI 背景移除（已有）
                            高清导出（已有）
```

**核心原则**：
1. 基础逻辑对齐（Phase 1~3）
2. 后端在"数据规模"和"策略智能度"上碾压（Phase 2~3）
3. 引入替代算法做 A/B 测试，验证是否优于现有方案（Phase 4）
4. 渲染美化不改变 grid_data，仅用于数字预览/导出（Phase 5）

---

## 二、Phase 1：基础对齐（必须先做）

### 2.1 后端改用 OKLab 颜色匹配

**现状**：后端 `colors.py` 用 RGB + cKDTree，前端用 OKLab + 线性扫描。

**修改点**：

```python
# colors.py

def _rgb_to_oklab(r, g, b):
    """sRGB -> OKLab（前端 PerlerEngine.ts 的 Python 移植）"""
    lr = r / 3294.6 if r <= 10 else ((r / 255 + 0.055) / 1.055) ** 2.4
    lg = g / 3294.6 if g <= 10 else ((g / 255 + 0.055) / 1.055) ** 2.4
    lb = b / 3294.6 if b <= 10 else ((b / 255 + 0.055) / 1.055) ** 2.4

    x = 0.8189330101 * lr + 0.3618667424 * lg - 0.1288597137 * lb
    y = 0.0329845436 * lr + 0.9293118715 * lg + 0.0361456387 * lb
    z = 0.0482003018 * lr + 0.2643662691 * lg + 0.6338517070 * lb

    l_ = np.cbrt(x)
    m_ = np.cbrt(y)
    s_ = np.cbrt(z)

    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, A, B
```

然后初始化时预计算 OKLab 值，cKDTree 建在 OKLab 空间上：

```python
_OKLAB_ARRAY_FULL = np.array([
    _rgb_to_oklab(*hex_to_rgb(h)) for h in _HEX_LIST_FULL
], dtype=np.float32)
_tree_full = cKDTree(_OKLAB_ARRAY_FULL)
```

**影响**：零性能损失（cKDTree 对 3D 空间一视同仁），颜色匹配精度与前段对齐。

### 2.2 后端补做 BFS 合并

**现状**：前端有 `bfsMerge(grid, 25)`，后端无此步骤。

**实现**：在 `normal_processing.py` 中增加 `_bfs_merge()`，逻辑与前端一致：
- BFS flood fill 找连通区域
- 相邻格子颜色距离 < threshold（默认 25）视为同一区域
- 区域内统一为最高频色

**调用位置**：在 `generate_perler_bead_data()` 末尾、返回前执行。

---

## 三、Phase 2：数据规模优势（核心差异化）

### 3.1 原始分辨率主导色提取

**前端限制**：
```typescript
// 前端为了性能，强制缩放到 max 800px
const maxSize = 800;
const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
```

**后端优势**：直接读取原始分辨率，不缩放。

```python
img = Image.open(input_path).convert("RGBA")
img_w, img_h = img.size  # 原始尺寸，可能是 2000x2000+
img_arr = np.array(img.convert('RGBA'))  # 直接用原图

# 每个 64x64 格子映射回原图的一块区域
for gy in range(grid_size):
    for gx in range(grid_size):
        # 计算 sx, sy, sw, sh...
        dominant = _dominant_color(img_arr, sx, sy, sw, sh)
        # 样本量是前端的 (orig_size / 800)^2 倍
```

**效果量化**：

| 原图尺寸 | 前端缩放后 | 后端采样像素数/格 | 倍数优势 |
|---------|-----------|------------------|---------|
| 800x800 | 800x800 | ~156 px | 1x |
| 2000x2000 | 800x800 | ~977 px | **6x** |
| 4000x4000 | 800x800 | ~3906 px | **25x** |

**收益**：
- 大面积区域的主导色更稳定，不容易被偶然噪点带偏
- 小面积特征（眼睛高光、文字笔画）在采样时不会被 resize 抹平

---

## 四、Phase 3：智能后处理（高级版特性）

### 4.1 自适应 BFS 合并

**前端现状**：固定 `threshold = 25`，对所有区域一视同仁。

**问题**：
- 天空区域颜色接近，阈值 25 合适
- 眼睛区域颜色变化剧烈，阈值 25 可能把瞳孔和眼白错误合并

**后端策略**：根据区域特征动态调整。

```
策略：
1. 先做标准 BFS 合并（threshold=25）
2. 检测所有连通区域
3. 面积 < min_area（默认 4 格）的区域视为"孤岛"，强制合并到最大邻居
4. 大面积区域保持原样（不额外合并）
```

**参数**：

| 参数 | 默认值 | 作用 |
|------|--------|------|
| `base_threshold` | 25 | 标准 BFS 的颜色距离阈值 |
| `min_area` | 4 | 小于此面积的连通区域被视为"孤岛"，强制合并 |

**效果**：
- 天空/皮肤等大面积区域更干净
- 眼睛/文字等小面积特征不会被吞掉
- 整体图纸的"色块感"更强，"噪点感"更弱

### 4.2 全局色号限制优化

**场景**：用户说"我只想买 20 种颜色的豆子"。

**前端限制**：每个格子独立匹配，无法控制全局色号数量。

**后端策略**：生成完整网格后，全局压缩色号。

```
算法步骤：
1. 生成完整网格（不限色号）
2. 统计所有色号频率
3. 保留 Top-N 高频色号（N = max_colors）
4. 低频色号替换为最近保留色（OKLab 距离）
5. 再次 BFS 合并（可能产生新的可合并区域）
```

**效果**：
- 色号数量可控，用户可根据预算选择"精简版"或"豪华版"
- 低频色被替换为最接近的高频色，视觉上损失最小

---

## 五、Phase 4：替代量化算法（实验性）

> 目标：引入 K-Means、SLIC、Mean-Shift 等算法作为"颜色量化 + 网格生成"的替代方案，与现有"逐格主导色提取"做 A/B 测试，用实际效果决定取舍。

### 5.1 现有方案（Baseline）

**逐格主导色提取 + OKLab 匹配**：
1. 每个格子对应原图一块区域
2. 区域内 4-bit 量化统计频率最高色
3. OKLab 匹配到最近拼豆色号

**优点**：简单、快速、局部抗噪
**局限**：格子之间无关联，可能出现"跨格边界不连续"

### 5.2 K-Means 颜色量化

**思路**：在全局颜色空间中用 K-Means 聚类，将原图颜色压缩到 K 个中心，再映射到拼豆色库。

**实现步骤**：
```python
from sklearn.cluster import KMeans

def kmeans_quantize(img_arr, k=50, color_mapping=None):
    # 1. 收集所有不透明像素
    h, w, _ = img_arr.shape
    pixels = img_arr.reshape(-1, 4)
    opaque = pixels[pixels[:, 3] >= 128][:, :3]
    
    # 2. K-Means 聚类（在 RGB 空间或 OKLab 空间）
    # 建议用 OKLab 空间，感知更均匀
    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    kmeans.fit(opaque)
    centers = kmeans.cluster_centers_.astype(np.uint8)
    
    # 3. 每个中心映射到最近拼豆色号
    perler_centers = [find_closest_color(c, mode='full') for c in centers]
    
    # 4. 每个像素分配到最近的聚类中心 -> 拼豆色号
    labels = kmeans.labels_
    quantized = np.array([perler_centers[l] for l in labels])
    
    # 5. 缩放到 grid_size x grid_size（NEAREST 或主导色重采样）
    # ...
```

**预期优势**：
- 全局颜色分布更均匀，不会出现"某颜色只出现 1-2 格"的孤岛
- 色号数量天然可控（K 值 = 色号数上限）

**预期问题**：
- K-Means 中心色是连续 RGB，映射到拼豆色号时可能产生偏差
- 对边缘处理不如逐格主导色提取精细（K-Means 不感知空间位置）
- 需要引入 sklearn 依赖
- K 值选择困难：太小丢失细节，太大色号爆炸

**测试方案**：
- 用 10 张测试图（卡通、照片、像素风各 3-4 张）
- K 值取 20/40/60/80 四档
- 对比指标：色号数、视觉主观评分、SSIM 结构相似度

### 5.3 SLIC 超像素

**思路**：用 SLIC（Simple Linear Iterative Clustering）将图片分割成大小相近、颜色一致的超像素区域，每个超像素对应一个拼豆色号。

**实现步骤**：
```python
from skimage.segmentation import slic
from skimage.util import img_as_float

def slic_perler(img_arr, n_segments=500, compactness=10):
    # 1. SLIC 分割（在 RGBA 的 RGB 通道上做）
    rgb = img_arr[:, :, :3] / 255.0
    segments = slic(rgb, n_segments=n_segments, compactness=compactness)
    
    # 2. 每个超像素提取主导色
    superpixel_colors = {}
    for seg_id in np.unique(segments):
        mask = segments == seg_id
        pixels = img_arr[mask]
        opaque = pixels[pixels[:, 3] >= 128][:, :3]
        if len(opaque) == 0:
            superpixel_colors[seg_id] = 'transparent'
        else:
            # 4-bit 量化主导色
            dominant = _dominant_color_from_pixels(opaque)
            superpixel_colors[seg_id] = find_closest_color(dominant)
    
    # 3. 将超像素标签图缩放到 grid_size x grid_size
    # 对每个格子，统计覆盖它的超像素中面积最大的那个
    # ...
```

**预期优势**：
- 区域边界非常清晰，内部颜色高度一致
- 天然保持边缘，不会像逐格采样那样在边界产生随机杂色
- 超像素的"块状感"与拼豆珠子非常契合

**预期问题**：
- 超像素形状不规则，映射到固定网格时可能产生锯齿
- `n_segments` 和 `compactness` 调参困难
- 需要 skimage 依赖
- 计算量大（SLIC 迭代过程耗时）

**测试方案**：
- `n_segments` 取 200/500/1000 三档
- `compactness` 取 5/10/20 三档
- 重点观察边缘清晰度和区域内部一致性

### 5.4 Mean-Shift 颜色量化

**思路**：在颜色空间中用 Mean-Shift 找到颜色密度峰值，每个峰值对应一个拼豆色号，像素聚类到最近的峰值。

**实现步骤**：
```python
from sklearn.cluster import MeanShift, estimate_bandwidth

def meanshift_quantize(img_arr):
    # 1. 收集不透明像素
    pixels = img_arr.reshape(-1, 4)
    opaque = pixels[pixels[:, 3] >= 128][:, :3]
    
    # 2. 估计带宽（或在 OKLab 空间中固定带宽）
    # Mean-Shift 在 OKLab 空间中更稳定
    bandwidth = estimate_bandwidth(opaque, quantile=0.2, n_samples=500)
    
    # 3. Mean-Shift 聚类
    ms = MeanShift(bandwidth=bandwidth, bin_seeding=True)
    ms.fit(opaque)
    centers = ms.cluster_centers_.astype(np.uint8)
    
    # 4. 每个中心映射到拼豆色号
    perler_centers = [find_closest_color(c) for c in centers]
    
    # 5. 缩放到 grid_size
    # ...
```

**预期优势**：
- 不需要预设 K 值，自动确定颜色数量
- 对颜色密度敏感，能自动发现"自然"的颜色分组

**预期问题**：
- 计算量巨大（Mean-Shift 是 O(N^2) 级别），大图几乎不可用
- `bandwidth` 选择极其敏感：太小色号爆炸，太大过度合并
- 需要 sklearn 依赖
- 颜色峰值是连续 RGB，映射到拼豆色号有偏差

**测试方案**：
- 由于计算量大，先用 200x200 缩略图做快速测试
- 对比带宽对结果的影响
- 如果效果不如 K-Means，直接放弃

### 5.5 A/B 测试框架

```python
# backend/algorithms/__init__.py
# 定义统一的算法接口

ALGORITHMS = {
    'dominant': dominant_color_grid,      # 现有方案（Baseline）
    'kmeans': kmeans_grid,                # K-Means 量化
    'slic': slic_grid,                    # SLIC 超像素
    'meanshift': meanshift_grid,          # Mean-Shift 量化
}

def generate_with_algorithm(img, grid_size, algorithm='dominant', **kwargs):
    """统一入口，根据 algorithm 参数选择不同实现。"""
    return ALGORITHMS[algorithm](img, grid_size, **kwargs)
```

**API 扩展**：
```json
{
  "algorithm": "dominant",
  "algorithm_params": {
    "kmeans_k": 50,
    "slic_segments": 500,
    "meanshift_bandwidth": null
  }
}
```

**评估指标**：

| 指标 | 计算方法 | 权重 |
|------|---------|------|
| 色号数 | 统计 color_list 长度 | 中等 |
| 孤岛率 | 面积 < 4 格的连通区域占比 | 高 |
| 边缘清晰度 | Sobel 边缘检测后的方差 | 高 |
| 区域一致性 | 每个连通区域内的颜色方差 | 高 |
| SSIM | 与原图的结构相似度 | 中等 |
| 响应时间 | 端到端耗时 | 中等 |

**决策流程**：
1. 先用 20 张测试图跑通所有算法
2. 计算上述指标
3. 主观评审（3-5 人投票"哪张更好"）
4. 综合评分后，保留 Top-2 算法作为后端选项
5. 默认仍用 `dominant`，其他作为"高级模式"可选

---

## 六、Phase 5：渲染美化（可选导出）

> 目标：不改变 grid_data，仅在数字预览/导出时提供视觉增强。明确标注"艺术预览"而非"制作图纸"。

### 6.1 边缘 AA（色库内）

**思路**：在渲染放大图时，对相邻不同颜色的边界插入 1px 宽的过渡色，但过渡色必须从拼豆色库中选取。

**实现**：
```python
def render_with_aa(grid, bead_size=8):
    img = render_base(grid, bead_size)
    
    # 检测水平相邻边界
    for y, row in enumerate(grid):
        for x in range(len(row) - 1):
            left, right = row[x], row[x + 1]
            if left != right and left != 'transparent' and right != 'transparent':
                # 计算真实混合色
                mix_rgb = (np.array(hex_to_rgb(left)) + np.array(hex_to_rgb(right))) / 2
                # 在色库中找最接近的色号
                aa_color = find_closest_color(mix_rgb.astype(np.uint8))
                # 在边界绘制 1px AA 线
                px = (x + 1) * bead_size
                py = y * bead_size
                draw_line(img, (px, py), (px, py + bead_size), aa_color)
    
    # 同理处理垂直方向和对角方向...
    return img
```

**预期效果**：
- 斜线和圆形边缘更柔和
- 但由于只用色库内颜色，AA 效果不如自由混合色完美

**问题**：
- 引入大量新色号（每对相邻色都可能产生一个过渡色）
- 1px 线在物理拼豆中极难精准放置
- 热熔后会糊掉

**使用策略**：
- 仅作为导出 PNG/JPG 时的"艺术预览"选项
- 明确标注："此效果仅用于数字分享，实际制作时请使用标准图纸"

### 6.2 有序抖动（Ordered Dithering）

**思路**：根据原图平均色与选中色号之间的残差，用 Bayer 矩阵决定是否在某些子像素中使用次优色号，模拟更多颜色层次。

**实现**：
```python
# Bayer 2x2 矩阵
BAYER_2x2 = np.array([
    [0, 2],
    [3, 1]
]) / 4.0

# Bayer 4x4 矩阵
BAYER_4x4 = np.array([
    [ 0,  8,  2, 10],
    [12,  4, 14,  6],
    [ 3, 11,  1,  9],
    [15,  7, 13,  5]
]) / 16.0

def render_with_dither(grid, original_img, bead_size=8, bayer_size=2):
    img = render_base(grid, bead_size)
    bayer = BAYER_2x2 if bayer_size == 2 else BAYER_4x4
    
    for y, row in enumerate(grid):
        for x, color in enumerate(row):
            if color == 'transparent':
                continue
            
            # 获取该格子对应原图区域的平均色
            avg_rgb = get_region_average(original_img, x, y, grid_size)
            # 获取当前色号 RGB
            current_rgb = hex_to_rgb(color)
            # 计算残差
            residual = np.linalg.norm(avg_rgb - current_rgb)
            
            # 如果残差大，找次优色号
            if residual > threshold:
                second_best = find_second_best_color(avg_rgb, exclude=color)
                second_rgb = hex_to_rgb(second_best)
                
                # Bayer 矩阵决定是否用次优色
                bx = x % bayer_size
                by = y % bayer_size
                threshold_val = bayer[by, bx] * 255
                
                if residual > threshold_val:
                    # 在该格子的部分子像素中使用次优色
                    # ...
    
    return img
```

**预期效果**：
- 大面积渐变（天空、肤色）过渡更自然
- 经典像素艺术的"颗粒感"

**问题**：
- 物理拼豆中需要交替放置两种豆子，制作复杂度翻倍
- 近距离看会有明显的"棋盘格"纹理

**使用策略**：
- 作为"数字导出选项"，默认关闭
- 提供滑块控制抖动强度（0%~100%）

### 6.3 渲染模式总览

| 模式 | 作用 | 适用场景 |
|------|------|---------|
| **标准图纸** | 无美化，硬边缘，清晰色号 | 物理制作（默认） |
| **艺术预览** | 边缘 AA + 有序抖动 | 数字分享、社交媒体 |
| **对比模式** | 左右分栏：标准 vs 艺术 | 用户决策 |

---

## 七、API 参数设计

后端 `/api/generate-pattern` 接口完整参数：

```json
{
  "grid_size": 64,
  "color_simplify": 30,
  "enhance_lines": 2,
  "color_mode": "full",
  
  "max_colors": null,
  "adaptive_merge": true,
  "min_area": 4,
  "use_original_size": true,
  
  "algorithm": "dominant",
  "algorithm_params": {
    "kmeans_k": 50,
    "slic_segments": 500,
    "slic_compactness": 10,
    "meanshift_bandwidth": null
  },
  
  "render_mode": "standard",
  "render_params": {
    "aa_enabled": false,
    "dither_enabled": false,
    "dither_strength": 0.5
  }
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `max_colors` | int/null | 全局色号上限 |
| `adaptive_merge` | bool | 自适应 BFS 合并开关 |
| `min_area` | int | 孤岛判定阈值（格） |
| `use_original_size` | bool | 原图分辨率分析 |
| `algorithm` | string | 量化算法：`dominant` / `kmeans` / `slic` / `meanshift` |
| `algorithm_params` | object | 算法专属参数 |
| `render_mode` | string | 渲染模式：`standard` / `artistic` / `compare` |
| `render_params` | object | 渲染参数（AA、抖动等） |

---

## 八、渐进式实施路线图

| 阶段 | 内容 | 预计工时 | 收益 |
|------|------|---------|------|
| **Week 1** | Phase 1：OKLab 对齐 + BFS 合并补全 | 1 天 | 前后端基础一致 |
| **Week 2** | Phase 2：原图分辨率分析 | 0.5 天 | 大图画质质变 |
| **Week 3** | Phase 3：自适应 BFS + 全局色号限制 | 1.5 天 | 智能后处理 |
| **Week 4** | Phase 4：K-Means / SLIC / Mean-Shift 实现 + A/B 测试框架 | 2 天 | 替代算法实验 |
| **Week 5** | Phase 5：边缘 AA + 有序抖动渲染 | 1 天 | 数字美化导出 |
| **Week 6** | API 统一 + 前端对接 + 全量测试 | 2 天 | 功能上线 |

**总计**：约 8 天开发工时。

---

## 九、依赖新增

| 库 | 用途 | 是否必须 |
|---|------|---------|
| `scikit-learn` | K-Means、Mean-Shift | Phase 4 必须 |
| `scikit-image` | SLIC 超像素分割 | Phase 4 必须 |
| `numpy` | 已有 | - |
| `Pillow` | 已有 | - |
| `scipy` | 已有 | - |

---

## 十、风险与回退

| 风险 | 缓解措施 |
|------|---------|
| K-Means/SLIC/Mean-Shift 效果不如现有方案 | A/B 测试后淘汰，保留 `dominant` 作为默认 |
| sklearn/skimage 引入大量依赖 | 将 Phase 4 算法作为可选插件，不安装时不影响核心功能 |
| 原图分辨率分析太慢 | 超大图（>4000px）自动降级到 2000px |
| AA/抖动误导用户用于制作 | 渲染模式明确标注"艺术预览"，标准图纸保持硬边缘 |
| 算法参数调参困难 | 提供"智能自动"模式，后端根据图片特征自动选择参数 |
