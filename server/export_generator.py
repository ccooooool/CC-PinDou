"""拼豆图案 PNG/JPG 导出生成。"""
import os
from io import BytesIO

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageColor

from colors import color_mapping, find_closest_colors_batch
from utils import get_text_size, draw_checkerboard, hex_to_rgb, logger


# Bayer 矩阵
BAYER_2x2 = np.array([
    [0, 2],
    [3, 1]
], dtype=np.float32) / 4.0

BAYER_4x4 = np.array([
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
], dtype=np.float32) / 16.0


# 模块级字体缓存，避免重复加载
_font_cache = {}


def _load_font(size):
    """加载 WenYuanRounded 字体，不存在则使用系统默认字体。结果按 (path, size) 缓存。"""
    cache_key = ('default', size)
    if cache_key in _font_cache:
        return _font_cache[cache_key]

    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)
    font_paths = [
        os.path.join(project_root, 'frontend', 'public', 'fonts', 'WenYuanRoundedSC-VF.otf'),
        os.path.join(project_root, 'NookUI', 'fonts', 'WenYuanRoundedSC-VF.otf'),
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, size)
                _font_cache[(path, size)] = font
                return font
            except Exception:
                pass
    default_font = ImageFont.load_default()
    _font_cache[cache_key] = default_font
    return default_font


def _find_second_best_color(rgb, exclude_hex, mode='full'):
    """找第二近的拼豆色号（排除指定色号）。"""
    from colors import _get_arrays
    hex_list, rgb_array = _get_arrays(mode)
    rgb_arr = np.array(rgb, dtype=np.float32)
    dists = np.sqrt(np.sum((rgb_array - rgb_arr) ** 2, axis=1))

    # 排除指定色号
    for i, h in enumerate(hex_list):
        if h == exclude_hex:
            dists[i] = float('inf')

    best_idx = int(dists.argmin())
    return hex_list[best_idx]


def _apply_aa(img, grid_data, bead_size, margin, circle_mode=False):
    """
    边缘 AA：在相邻不同颜色的边界插入 1px 过渡色（从色库中选取）。
    仅在导出时作为'艺术预览'选项。
    """
    rows = len(grid_data)
    if rows == 0:
        return img
    cols = len(grid_data[0])
    draw = ImageDraw.Draw(img)

    # 预计算所有边界需要的 AA 色
    aa_colors_h = {}  # 水平边界: (y, x) -> aa_color
    aa_colors_v = {}  # 垂直边界: (y, x) -> aa_color

    for y in range(rows):
        for x in range(cols):
            left = grid_data[y][x]['color']
            # 右邻居
            if x + 1 < cols:
                right = grid_data[y][x + 1]['color']
                if left != right and left != 'transparent' and right != 'transparent':
                    rgb_l = np.array(hex_to_rgb(left))
                    rgb_r = np.array(hex_to_rgb(right))
                    mix = ((rgb_l + rgb_r) / 2).astype(np.uint8)
                    aa_hex = find_closest_colors_batch(mix.reshape(1, 3))[0]
                    aa_colors_v[(y, x)] = aa_hex
            # 下邻居
            if y + 1 < rows:
                down = grid_data[y + 1][x]['color']
                if left != down and left != 'transparent' and down != 'transparent':
                    rgb_l = np.array(hex_to_rgb(left))
                    rgb_d = np.array(hex_to_rgb(down))
                    mix = ((rgb_l + rgb_d) / 2).astype(np.uint8)
                    aa_hex = find_closest_colors_batch(mix.reshape(1, 3))[0]
                    aa_colors_h[(y, x)] = aa_hex

    # 绘制 AA 线
    for (y, x), color in aa_colors_v.items():
        px = margin + (x + 1) * bead_size
        py = margin + y * bead_size
        if circle_mode:
            # 圆形模式下在边界画小竖线
            draw.line([(px, py + 2), (px, py + bead_size - 2)], fill=color, width=1)
        else:
            draw.line([(px, py + 1), (px, py + bead_size - 1)], fill=color, width=1)

    for (y, x), color in aa_colors_h.items():
        px = margin + x * bead_size
        py = margin + (y + 1) * bead_size
        if circle_mode:
            draw.line([(px + 2, py), (px + bead_size - 2, py)], fill=color, width=1)
        else:
            draw.line([(px + 1, py), (px + bead_size - 1, py)], fill=color, width=1)

    return img


def _apply_dither(img, grid_data, bead_size, margin, strength=0.5):
    """
    有序抖动（简化版）：在格子内部根据 Bayer 矩阵绘制次优色小点。
    不需要原始图片，仅基于 grid_data 中相邻色的差异。
    """
    rows = len(grid_data)
    if rows == 0:
        return img
    cols = len(grid_data[0])
    draw = ImageDraw.Draw(img)

    bayer = BAYER_4x4
    bayer_size = 4

    for y in range(rows):
        for x in range(cols):
            color = grid_data[y][x]['color']
            if color == 'transparent':
                continue

            # 收集邻居颜色
            neighbors = []
            for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                ny, nx = y + dy, x + dx
                if 0 <= ny < rows and 0 <= nx < cols:
                    nc = grid_data[ny][nx]['color']
                    if nc != color and nc != 'transparent':
                        neighbors.append(nc)

            if not neighbors:
                continue

            # 找次优色（基于 RGB 距离的邻居色）
            rgb = np.array(hex_to_rgb(color))
            best_neighbor = None
            best_dist = float('inf')
            for nc in neighbors:
                n_rgb = np.array(hex_to_rgb(nc))
                dist = np.linalg.norm(rgb - n_rgb)
                if dist < best_dist:
                    best_dist = dist
                    best_neighbor = nc

            if best_neighbor is None:
                continue

            # Bayer 矩阵决定是否绘制次优色小点
            threshold_val = bayer[y % bayer_size, x % bayer_size] * 255
            if best_dist * strength > threshold_val:
                px = margin + x * bead_size
                py = margin + y * bead_size
                # 在格子中心画一个小点
                dot_size = max(2, bead_size // 4)
                cx = px + bead_size // 2
                cy = py + bead_size // 2
                draw.ellipse(
                    [cx - dot_size, cy - dot_size, cx + dot_size, cy + dot_size],
                    fill=best_neighbor
                )

    return img


def generate_export_image(grid_data, color_list, brand='MARD', show_code=False,
                          show_legend=True, circle_mode=False, show_mark_lines=False,
                          mark_interval=5, fmt='png',
                          aa_enabled=False, dither_enabled=False, dither_strength=0.5):
    """
    根据网格数据和颜色列表生成拼豆图案。
    返回 BytesIO 对象。

    Phase 5 新增参数：
    - aa_enabled: 边缘 AA（艺术预览）
    - dither_enabled: 有序抖动（艺术预览）
    - dither_strength: 抖动强度 0.0~1.0
    """
    if not grid_data:
        raise ValueError("grid_data is empty")

    # 防御性检查
    if mark_interval is None or mark_interval <= 0:
        mark_interval = 5
    if not isinstance(mark_interval, int):
        mark_interval = int(mark_interval)

    bead_size = 28
    margin = 45
    rows = len(grid_data)
    cols = len(grid_data[0]) if rows > 0 else 0

    canvas_width = cols * bead_size + 2 * margin
    canvas_height = rows * bead_size + 2 * margin

    img = Image.new('RGB', (canvas_width, canvas_height), 'white')
    draw = ImageDraw.Draw(img)

    font = _load_font(14)
    code_font = _load_font(12)
    legend_font = _load_font(14)

    # 绘制坐标轴数字
    for i in range(cols):
        text = str(i + 1)
        text_w, text_h = get_text_size(draw, text, font)
        cx = margin + i * bead_size + bead_size // 2
        cy = margin // 2
        draw.text((cx - text_w // 2, cy - text_h // 2), text, fill='#333', font=font)
    for i in range(rows):
        text = str(i + 1)
        text_w, text_h = get_text_size(draw, text, font)
        cy = margin + i * bead_size + bead_size // 2
        draw.text((margin // 2 - text_w // 2, cy - text_h // 2), text, fill='#333', font=font)

    # 绘制格子
    for y in range(rows):
        for x in range(cols):
            cell = grid_data[y][x]
            px = margin + x * bead_size
            py = margin + y * bead_size
            color = cell.get('color', '#FFFFFF')

            if circle_mode:
                # 圆形模式：先画白色背景方块，再画带浅描边的内接圆（半径小1px）
                draw.rectangle([px, py, px + bead_size, py + bead_size], fill='white')
                cx = px + bead_size // 2
                cy = py + bead_size // 2
                r = bead_size // 2 - 1
                # 浅描边/阴影底（稍大一圈）
                draw.ellipse([cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1], fill='#e0e0e0')
                if color == 'transparent':
                    # 透明圆形：用棋盘格图案填充小圆
                    cell_img = Image.new('RGBA', (bead_size, bead_size), (255, 255, 255, 0))
                    cell_draw = ImageDraw.Draw(cell_img)
                    draw_checkerboard(cell_draw, 0, 0, bead_size)
                    # 创建小圆 mask（在 bead_size x bead_size 的局部坐标系中）
                    mask = Image.new('L', (bead_size, bead_size), 0)
                    mask_draw = ImageDraw.Draw(mask)
                    mask_c = bead_size / 2
                    mask_draw.ellipse([mask_c - r, mask_c - r, mask_c + r, mask_c + r], fill=255)
                    img.paste(cell_img, (int(px), int(py)), mask)
                else:
                    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
            else:
                if color == 'transparent':
                    draw_checkerboard(draw, px, py, bead_size)
                else:
                    draw.rectangle([px, py, px + bead_size, py + bead_size], fill=color)

            if show_code and cell.get('codes', {}).get(brand):
                code = cell['codes'][brand]
                rgb = ImageColor.getcolor(color, 'RGB') if color != 'transparent' else (255, 255, 255)
                brightness = sum(rgb) / 3
                text_color = '#000' if brightness > 128 else '#fff'
                text_w, text_h = get_text_size(draw, code, code_font)
                draw.text(
                    (px + bead_size / 2 - text_w / 2, py + bead_size / 2 - text_h / 2),
                    code, fill=text_color, font=code_font
                )

    # Phase 5: 边缘 AA
    if aa_enabled:
        img = _apply_aa(img, grid_data, bead_size, margin, circle_mode=circle_mode)

    # Phase 5: 有序抖动
    if dither_enabled:
        img = _apply_dither(img, grid_data, bead_size, margin, strength=dither_strength)

    # 绘制网格线
    for i in range(rows + 1):
        if show_mark_lines and i > 0 and i % mark_interval == 0:
            draw.line(
                [(margin, margin + i * bead_size), (margin + cols * bead_size, margin + i * bead_size)],
                fill='#333', width=2
            )
        else:
            draw.line(
                [(margin, margin + i * bead_size), (margin + cols * bead_size, margin + i * bead_size)],
                fill='#999', width=1
            )
    for i in range(cols + 1):
        if show_mark_lines and i > 0 and i % mark_interval == 0:
            draw.line(
                [(margin + i * bead_size, margin), (margin + i * bead_size, margin + rows * bead_size)],
                fill='#333', width=2
            )
        else:
            draw.line(
                [(margin + i * bead_size, margin), (margin + i * bead_size, margin + rows * bead_size)],
                fill='#999', width=1
            )

    # 绘制图例
    if show_legend and color_list:
        items_per_row = max(1, (canvas_width - 20) // 100)
        legend_rows = (len(color_list) + items_per_row - 1) // items_per_row
        legend_height = max(60, legend_rows * 30 + 20)

        legend_img = Image.new('RGB', (canvas_width, legend_height), 'white')
        legend_draw = ImageDraw.Draw(legend_img)
        x_pos = 20
        y_pos = 20

        for color_info in color_list:
            code = color_info.get('codes', {}).get(brand, 'N/A')
            text = f"{code} x{color_info['count']}"
            color = color_info.get('hex', '#FFFFFF')

            if color == 'transparent':
                draw_checkerboard(legend_draw, x_pos, y_pos - 8, 16, cell=4)
            else:
                if circle_mode:
                    legend_draw.ellipse([x_pos, y_pos - 8, x_pos + 16, y_pos + 8], fill=color)
                else:
                    legend_draw.rectangle([x_pos, y_pos - 8, x_pos + 16, y_pos + 8], fill=color)

            _, text_h = get_text_size(legend_draw, text, legend_font)
            legend_draw.text((x_pos + 25, y_pos - text_h / 2), text, fill='#333', font=legend_font)
            x_pos += 100
            if x_pos > canvas_width - 100:
                x_pos = 20
                y_pos += 30

        combined = Image.new('RGB', (canvas_width, canvas_height + legend_height + 20), 'white')
        combined.paste(img, (0, 0))
        combined.paste(legend_img, (0, canvas_height + 10))
        img = combined

    buf = BytesIO()
    if fmt.lower() == 'jpg' or fmt.lower() == 'jpeg':
        img.save(buf, format='JPEG', quality=95)
    else:
        img.save(buf, format='PNG')
    buf.seek(0)
    return buf
