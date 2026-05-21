#!/usr/bin/env python3
"""
普通图片模式处理流程可视化脚本
========================================
对指定图片逐步执行前后端处理流程，保存每一步的中间结果图，
并生成 HTML 预览页，直观感受每一步的变化。

用法：
    cd CC-PinDou
    python scripts/visualize_pipeline.py

输出：pipeline_debug/ 文件夹
"""

import os
import sys
import io

# Windows 控制台强制 UTF-8 输出
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import json
from pathlib import Path
from collections import Counter

# ── 路径设置 ──
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / 'server'))

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from image_processing import enhance_lines, remove_background, simplify_colors
from colors import color_mapping as lazy_color_mapping, find_closest_colors_batch, _ensure_initialized
from utils import hex_to_rgb

# ── 配置 ──
INPUT_IMAGE = PROJECT_ROOT / '游戏截图参考' / 'test.jpg'
OUTPUT_DIR = PROJECT_ROOT / 'pipeline_debug'
FRONTEND_JSON = PROJECT_ROOT / 'frontend' / 'src' / 'data' / 'colorSystemMapping.json'

GRID_SIZE = 64
COLOR_SIMPLIFY = 30
ENHANCE_LINES = 2
REMOVE_BG = True
REMOVE_BG_THRESHOLD = 30
COLOR_MODE = 'full'
BFS_THRESHOLD = 25

os.makedirs(OUTPUT_DIR, exist_ok=True)


def save_step(img, name, description, group='backend'):
    """保存单步图片并返回元信息。"""
    if isinstance(img, np.ndarray):
        img = Image.fromarray(img)
    path = OUTPUT_DIR / name
    img.save(path)
    print(f"  [OK] {group}/{name}  ->  {description}")
    return {"name": name, "desc": description, "path": str(path), "group": group}


# ═══════════════════════════════════════════════════════════════════════════════
#  颜色工具（前端逻辑 Python 复刻）
# ═══════════════════════════════════════════════════════════════════════════════

def load_frontend_color_mapping():
    """加载前端使用的 colorSystemMapping.json。"""
    with open(FRONTEND_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)
    hexes = list(data.keys())
    if COLOR_MODE == '221':
        hexes = [h for h in hexes if data[h].get('MARD', '') and 'A' <= data[h]['MARD'][0] <= 'M']
    return data, hexes


def rgb_to_oklab(r, g, b):
    """sRGB → OKLab（前端 PerlerEngine.ts 的 Python 移植）。"""
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


def build_oklab_palette(hex_list):
    """预计算所有拼豆色号的 OKLab 值。"""
    arr = np.zeros((len(hex_list), 3), dtype=np.float32)
    for i, h in enumerate(hex_list):
        rgb = hex_to_rgb(h)
        arr[i] = rgb_to_oklab(*rgb)
    return arr


def oklab_nearest(r, g, b, hex_list, oklab_arr):
    """OKLab 空间最近色匹配。"""
    L, A, B = rgb_to_oklab(r, g, b)
    dL = oklab_arr[:, 0] - L
    dA = oklab_arr[:, 1] - A
    dB = oklab_arr[:, 2] - B
    dists = dL * dL + dA * dA + dB * dB
    return hex_list[int(dists.argmin())]


# ═══════════════════════════════════════════════════════════════════════════════
#  前端算法模拟
# ═══════════════════════════════════════════════════════════════════════════════

def frontend_simplify_colors(img_pil, level):
    """模拟前端 simplifyColorsFrontend（4-bit 量化 + 最近主色替换）。"""
    if level <= 0:
        return img_pil
    arr = np.array(img_pil.convert('RGBA'))
    h, w, _ = arr.shape
    data = arr.reshape(-1, 4)

    # 4-bit 量化统计频率
    color_map = {}
    for i in range(len(data)):
        a = data[i, 3]
        if a < 128:
            continue
        r = (data[i, 0] >> 4) << 4
        g = (data[i, 1] >> 4) << 4
        b = (data[i, 2] >> 4) << 4
        key = (r, g, b)
        color_map[key] = color_map.get(key, 0) + 1

    if not color_map:
        return img_pil

    colors = sorted(color_map.items(), key=lambda x: x[1], reverse=True)
    keep_ratio = (100 - level) / 100.0
    keep_count = max(2, int(len(colors) * keep_ratio))
    main_colors = [c[0] for c in colors[:keep_count]]
    main_arr = np.array(main_colors, dtype=np.float32)

    # 替换每个像素为最近主色
    for i in range(len(data)):
        a = data[i, 3]
        if a < 128:
            continue
        r, g, b = data[i, :3]
        dists = np.sum((main_arr - [r, g, b]) ** 2, axis=1)
        best = main_arr[dists.argmin()]
        data[i, :3] = best.astype(np.uint8)

    return Image.fromarray(arr)


def frontend_enhance_lines(img_pil, strength):
    """模拟前端 enhanceLinesFrontend（灰度阈值 + MinFilter 腐蚀）。"""
    if strength <= 0:
        return img_pil
    arr = np.array(img_pil.convert('RGBA'))
    h, w, _ = arr.shape
    out = arr.copy()

    threshold = max(20, 110 - strength * 10)
    gray = np.round(0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]).astype(np.uint8)
    mask = gray.copy()

    iterations = min(strength, 5)
    for _ in range(iterations):
        new_mask = mask.copy()
        new_mask[1:-1, 1:-1] = np.minimum.reduce([
            mask[1:-1, 1:-1],
            mask[1:-1, :-2],
            mask[1:-1, 2:],
            mask[:-2, 1:-1],
            mask[2:, 1:-1],
        ])
        mask = new_mask

    dark = mask < threshold
    out[dark] = [0, 0, 0, 255]
    return Image.fromarray(out)


def frontend_dominant_color(rgba_arr, sx, sy, sw, sh):
    """模拟前端 dominantColor（4-bit 量化频率最高色）。"""
    h, w, _ = rgba_arr.shape
    freq = Counter()
    for y in range(sy, min(sy + sh, h)):
        for x in range(sx, min(sx + sw, w)):
            a = rgba_arr[y, x, 3]
            if a < 128:
                continue
            r = rgba_arr[y, x, 0] >> 4
            g = rgba_arr[y, x, 1] >> 4
            b = rgba_arr[y, x, 2] >> 4
            freq[(r, g, b)] += 1
    if not freq:
        return None
    best = freq.most_common(1)[0][0]
    return (best[0] << 4, best[1] << 4, best[2] << 4)


def frontend_generate_grid(rgba_arr, grid_size, hex_list, oklab_arr):
    """模拟前端 PerlerEngine.generateGrid()。"""
    h, w, _ = rgba_arr.shape
    if w >= h:
        draw_w = grid_size
        draw_h = max(1, round(grid_size * h / w))
        off_x = 0
        off_y = (grid_size - draw_h) // 2
    else:
        draw_h = grid_size
        draw_w = max(1, round(grid_size * w / h))
        off_y = 0
        off_x = (grid_size - draw_w) // 2

    grid = []
    for gy in range(grid_size):
        row = []
        for gx in range(grid_size):
            if gx < off_x or gx >= off_x + draw_w or gy < off_y or gy >= off_y + draw_h:
                row.append('transparent')
                continue
            lx = gx - off_x
            ly = gy - off_y
            sx = round(lx * w / draw_w)
            sy = round(ly * h / draw_h)
            sx_next = min(w, round((lx + 1) * w / draw_w))
            sy_next = min(h, round((ly + 1) * h / draw_h))
            sw = max(1, sx_next - sx)
            sh = max(1, sy_next - sy)
            dom = frontend_dominant_color(rgba_arr, sx, sy, sw, sh)
            if dom:
                row.append(oklab_nearest(*dom, hex_list, oklab_arr))
            else:
                row.append('transparent')
        grid.append(row)
    return grid


def frontend_bfs_merge(grid, threshold, hex_list, oklab_arr, color_map_data):
    """模拟前端 PerlerEngine.bfsMerge()。"""
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    visited = set()
    new_grid = [row[:] for row in grid]
    dirs = [(0, 1), (1, 0), (0, -1), (-1, 0)]

    def get_rgb(hex_c):
        if hex_c == 'transparent':
            return (255, 255, 255)
        return hex_to_rgb(hex_c)

    def color_dist(a, b):
        ca, cb = get_rgb(a), get_rgb(b)
        return ((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2 + (ca[2] - cb[2]) ** 2) ** 0.5

    for y in range(rows):
        for x in range(cols):
            key = f"{x},{y}"
            if key in visited:
                continue
            base = grid[y][x]
            region = []
            queue = [(x, y)]
            visited.add(key)
            while queue:
                cx, cy = queue.pop(0)
                region.append((cx, cy))
                for dx, dy in dirs:
                    nx, ny = cx + dx, cy + dy
                    if nx < 0 or nx >= cols or ny < 0 or ny >= rows:
                        continue
                    nk = f"{nx},{ny}"
                    if nk in visited:
                        continue
                    if color_dist(base, grid[ny][nx]) < threshold:
                        visited.add(nk)
                        queue.append((nx, ny))
            freq = Counter(grid[ry][rx] for rx, ry in region)
            max_color = freq.most_common(1)[0][0]
            for rx, ry in region:
                new_grid[ry][rx] = max_color
    return new_grid


def render_grid_to_image(grid, bead_size=8, show_grid=True):
    """将拼豆格子网格渲染为图片。"""
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    w = cols * bead_size
    h = rows * bead_size
    img = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    for y, row in enumerate(grid):
        for x, color in enumerate(row):
            px = x * bead_size
            py = y * bead_size
            fill = (255, 255, 255, 255) if color == 'transparent' else hex_to_rgb(color) + (255,)
            draw.rectangle([px, py, px + bead_size - 1, py + bead_size - 1], fill=fill)

    if show_grid:
        for i in range(rows + 1):
            draw.line([(0, i * bead_size), (w, i * bead_size)], fill=(200, 200, 200, 255), width=1)
        for i in range(cols + 1):
            draw.line([(i * bead_size, 0), (i * bead_size, h)], fill=(200, 200, 200, 255), width=1)

    return img


def render_grid_to_preview(grid, img_w, img_h, grid_size, preview_size=400):
    """将色号网格渲染为一张中等尺寸的可视化预览图（保持原图比例）。"""
    if img_w >= img_h:
        vis_w = preview_size
        vis_h = max(1, round(preview_size * img_h / img_w))
    else:
        vis_h = preview_size
        vis_w = max(1, round(preview_size * img_w / img_h))

    cell_w = vis_w / grid_size
    cell_h = vis_h / grid_size

    img = Image.new('RGBA', (vis_w, vis_h), (255, 255, 255, 255))
    arr = np.array(img)

    for gy, row in enumerate(grid):
        for gx, color in enumerate(row):
            if color == 'transparent':
                continue
            x0 = int(gx * cell_w)
            y0 = int(gy * cell_h)
            x1 = int((gx + 1) * cell_w)
            y1 = int((gy + 1) * cell_h)
            rgb = hex_to_rgb(color)
            arr[y0:y1, x0:x1] = [rgb[0], rgb[1], rgb[2], 255]

    return Image.fromarray(arr)


# ═══════════════════════════════════════════════════════════════════════════════
#  主流程
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    steps = []
    print(f"[DIR] output: {OUTPUT_DIR}")
    print(f"[IMG] input: {INPUT_IMAGE}")

    if not INPUT_IMAGE.exists():
        print(f"[ERR] input image not found: {INPUT_IMAGE}")
        sys.exit(1)

    # ── 0. 原始图 ──
    print("\n[BACKEND]")
    img = Image.open(INPUT_IMAGE).convert('RGBA')
    steps.append(save_step(img, '01_original.png', 'original (converted to RGBA)', 'backend'))

    # ── 1. 后端：线条增强 ──
    img_enhanced = enhance_lines(img, ENHANCE_LINES)
    steps.append(save_step(img_enhanced, '02_backend_enhance_lines.png',
                           f'enhance_lines (strength={ENHANCE_LINES})', 'backend'))

    # ── 2. 后端：背景移除 ──
    if REMOVE_BG:
        try:
            img_no_bg = remove_background(img_enhanced, edge_threshold=REMOVE_BG_THRESHOLD)
        except Exception as e:
            print(f"  [WARN] remove_background failed (missing ONNX model?): {e}")
            img_no_bg = img_enhanced
    else:
        img_no_bg = img_enhanced
    steps.append(save_step(img_no_bg, '03_backend_remove_bg.png',
                           f'remove_background (threshold={REMOVE_BG_THRESHOLD})', 'backend'))

    # ── 3. 后端：调用新的 generate_perler_bead_data（主导色提取 + 最近色匹配，未简化） ──
    img_w, img_h = img_no_bg.size
    from normal_processing import generate_perler_bead_data

    result_unsimplified = generate_perler_bead_data(
        str(INPUT_IMAGE),
        grid_size=GRID_SIZE,
        remove_bg=False,
        color_simplify=0,
        remove_bg_threshold=REMOVE_BG_THRESHOLD,
        enhance_lines_strength=0,
        bg_model=None,
        color_mode=COLOR_MODE
    )
    backend_grid_unsimplified = [[cell['color'] for cell in row] for row in result_unsimplified['grid_data']]

    # 可视化：未简化原图的主导色提取 + 颜色匹配效果
    vis_img = render_grid_to_preview(backend_grid_unsimplified, img_w, img_h, GRID_SIZE)
    steps.append(save_step(vis_img, '04_backend_dominant_color_match.png',
                           f'dominant color extract + color match ({COLOR_MODE}, unsimplified)', 'backend'))

    # ── 4. 后端：颜色简化后再匹配 ──
    if COLOR_SIMPLIFY > 0:
        img_simplified = simplify_colors(img_no_bg, COLOR_SIMPLIFY)
        steps.append(save_step(img_simplified, '05_backend_simplify_colors.png',
                               f'simplify_colors (level={COLOR_SIMPLIFY}, then match)', 'backend'))

        result_simplified = generate_perler_bead_data(
            str(INPUT_IMAGE),
            grid_size=GRID_SIZE,
            remove_bg=False,
            color_simplify=0,
            remove_bg_threshold=REMOVE_BG_THRESHOLD,
            enhance_lines_strength=0,
            bg_model=None,
            color_mode=COLOR_MODE
        )
        backend_grid = [[cell['color'] for cell in row] for row in result_simplified['grid_data']]
    else:
        backend_grid = backend_grid_unsimplified

    # ── 5. 后端：最终网格 ──
    backend_grid_img = render_grid_to_image(backend_grid, bead_size=8, show_grid=True)
    steps.append(save_step(backend_grid_img, '06_backend_final_grid.png',
                           f'final grid {GRID_SIZE}x{GRID_SIZE} (with grid lines)', 'backend'))

    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[FRONTEND]")
    # ── 0. 前端缩放（max 800px） ──
    max_size = 800
    f_scale = min(1, max_size / max(img_w, img_h))
    f_w = int(img_w * f_scale)
    f_h = int(img_h * f_scale)
    f_img = img.resize((f_w, f_h), Image.LANCZOS)
    steps.append(save_step(f_img, '11_frontend_resize_800px.png',
                           f'前端缩放至 {f_w}×{f_h}（LANCZOS，max 800px）', 'frontend'))

    # ── 1. 前端：颜色简化 ──
    f_simplified = frontend_simplify_colors(f_img, COLOR_SIMPLIFY)
    steps.append(save_step(f_simplified, '12_frontend_simplify_colors.png',
                           f'simplify_colors (level={COLOR_SIMPLIFY}, 4-bit quantize)', 'frontend'))

    # ── 2. 前端：线条增强 ──
    f_enhanced = frontend_enhance_lines(f_simplified, ENHANCE_LINES)
    steps.append(save_step(f_enhanced, '13_frontend_enhance_lines.png',
                           f'enhance_lines (strength={ENHANCE_LINES})', 'frontend'))

    # 加载前端色库
    frontend_color_map, frontend_hexes = load_frontend_color_mapping()
    frontend_oklab = build_oklab_palette(frontend_hexes)

    # ── 3. 前端：网格生成（主导色 + OKLab 匹配） ──
    f_arr = np.array(f_enhanced.convert('RGBA'))
    frontend_grid = frontend_generate_grid(f_arr, GRID_SIZE, frontend_hexes, frontend_oklab)
    frontend_grid_img = render_grid_to_image(frontend_grid, bead_size=8, show_grid=True)
    steps.append(save_step(frontend_grid_img, '14_frontend_generate_grid.png',
                           f'generate_grid (dominant color + OKLab match)', 'frontend'))

    # ── 4. 前端：BFS 合并 ──
    frontend_merged = frontend_bfs_merge(frontend_grid, BFS_THRESHOLD, frontend_hexes, frontend_oklab, frontend_color_map)
    frontend_merged_img = render_grid_to_image(frontend_merged, bead_size=8, show_grid=True)
    steps.append(save_step(frontend_merged_img, '15_frontend_bfs_merge.png',
                           f'BFS merge (threshold={BFS_THRESHOLD})', 'frontend'))

    # ── 5. 前端：最终网格（放大版） ──
    frontend_final_img = render_grid_to_image(frontend_merged, bead_size=12, show_grid=True)
    steps.append(save_step(frontend_final_img, '16_frontend_final_grid.png',
                           f'前端最终网格 {GRID_SIZE}×{GRID_SIZE}（bead_size=12）', 'frontend'))

    # ═══════════════════════════════════════════════════════════════════════════
    print("\n[HTML]")
    generate_html(steps)
    print(f"\n[DONE] All done! Open: {OUTPUT_DIR / 'index.html'}")


def generate_html(steps):
    backend_steps = [s for s in steps if s['group'] == 'backend']
    frontend_steps = [s for s in steps if s['group'] == 'frontend']

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>拼豆处理流程可视化</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Nunito', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    background: #f8f8f0;
    color: #5D4037;
    padding: 20px;
  }}
  h1 {{
    text-align: center;
    margin-bottom: 8px;
    font-size: 24px;
  }}
  .subtitle {{
    text-align: center;
    color: #888;
    font-size: 14px;
    margin-bottom: 30px;
  }}
  .grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    max-width: 1400px;
    margin: 0 auto;
  }}
  .column {{
    background: #fff;
    border-radius: 20px;
    padding: 20px;
    border: 3px solid #F3E5D8;
  }}
  .column h2 {{
    font-size: 18px;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid #2BB4AB;
    color: #2BB4AB;
  }}
  .column.frontend h2 {{
    border-bottom-color: #FFB7C5;
    color: #E91E63;
  }}
  .step {{
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px dashed #e0e0e0;
  }}
  .step:last-child {{
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }}
  .step-title {{
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 8px;
    color: #5D4037;
  }}
  .step-desc {{
    font-size: 12px;
    color: #888;
    margin-bottom: 10px;
    line-height: 1.5;
  }}
  .step img {{
    max-width: 100%;
    max-height: 320px;
    border-radius: 12px;
    border: 2px solid #f0f0f0;
    display: block;
    image-rendering: auto;
    object-fit: contain;
  }}
  .step img.pixelated {{
    image-rendering: pixelated;
  }}
  .arrow {{
    text-align: center;
    font-size: 20px;
    color: #ccc;
    margin: 8px 0;
  }}
  @media (max-width: 900px) {{
    .grid {{ grid-template-columns: 1fr; }}
  }}
</style>
</head>
<body>
<h1>🎨 拼豆处理流程可视化</h1>
<p class="subtitle">图片素材：游戏截图参考/test.jpg | 网格尺寸：{GRID_SIZE}×{GRID_SIZE}</p>

<div class="grid">
  <div class="column">
    <h2>🖥️ 后端流程（Python）</h2>
    {render_steps(backend_steps)}
  </div>
  <div class="column frontend">
    <h2>🌐 前端流程（浏览器模拟）</h2>
    {render_steps(frontend_steps)}
  </div>
</div>

</body>
</html>"""

    with open(OUTPUT_DIR / 'index.html', 'w', encoding='utf-8') as f:
        f.write(html)


def render_steps(steps_list):
    parts = []
    for i, s in enumerate(steps_list):
        img_name = s['name']
        is_grid = 'grid' in img_name.lower()
        pixelated = 'pixelated' if is_grid else ''
        parts.append(f"""
    <div class="step">
      <div class="step-title">{i+1}. {s['desc']}</div>
      <img src="{img_name}" alt="{s['desc']}" class="{pixelated}" />
    </div>
""")
    return '\n'.join(parts)


if __name__ == '__main__':
    main()
