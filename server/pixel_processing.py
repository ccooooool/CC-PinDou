"""像素图处理：自动检测、块采样、像素图完整流程。"""
import math

import numpy as np
from PIL import Image

from colors import color_mapping, find_closest_color
from utils import logger, clamp_param


def detect_pixel_size_and_alignment(img, max_size=200):
    """
    自动检测像素图的像素块大小和对齐偏移。
    使用颜色梯度 + 块内一致性双重评分。
    返回 (pixel_size, offset_x, offset_y)
    """
    img_w, img_h = img.size
    scale = min(max_size / img_w, max_size / img_h, 1.0)
    if scale < 1.0:
        small = img.resize((int(img_w * scale), int(img_h * scale)), Image.LANCZOS)
    else:
        small = img.copy()
    arr = np.array(small.convert('RGB')).astype(np.float32)
    h, w = arr.shape[:2]

    dx = np.zeros((h, w), dtype=np.float32)
    dx[:, 1:] = np.sum(np.abs(arr[:, 1:] - arr[:, :-1]), axis=2)
    dy = np.zeros((h, w), dtype=np.float32)
    dy[1:, :] = np.sum(np.abs(arr[1:, :] - arr[:-1, :]), axis=2)

    def _compute_uniformity(arr_u, ps, ox, oy, threshold=30):
        h_u, w_u = arr_u.shape[:2]
        crop_h = ((h_u - oy) // ps) * ps
        crop_w = ((w_u - ox) // ps) * ps
        if crop_h < ps or crop_w < ps:
            return 0.0
        cropped = arr_u[oy:oy + crop_h, ox:ox + crop_w]
        blocks = cropped.reshape(crop_h // ps, ps, crop_w // ps, ps, 3)
        rgb_range = blocks.max(axis=(1, 3)) - blocks.min(axis=(1, 3))
        uniform = np.all(rgb_range < threshold, axis=2)
        return float(uniform.mean())

    best_score = -1
    best_ps = 16
    best_ox = 0
    best_oy = 0

    for ps in range(4, min(65, max(w, h) // 2 + 1)):
        max_offset = min(ps, 8)
        best_grad = -1
        best_ox_ps = 0
        best_oy_ps = 0
        best_num_lines = 1

        for ox in range(max_offset):
            x_lines = list(range(ox, w, ps))
            if len(x_lines) < 2:
                continue
            score_x = np.sum(dx[:, x_lines])
            for oy in range(max_offset):
                y_lines = list(range(oy, h, ps))
                if len(y_lines) < 2:
                    continue
                score_y = np.sum(dy[y_lines, :])
                score = score_x + score_y
                if score > best_grad:
                    best_grad = score
                    best_ox_ps = ox
                    best_oy_ps = oy
                    best_num_lines = len(x_lines) + len(y_lines)

        uniformity = _compute_uniformity(arr, ps, best_ox_ps, best_oy_ps)
        combined = (best_grad / best_num_lines) * (1.0 + uniformity)

        if combined >= best_score:
            best_score = combined
            best_ps = ps
            best_ox = best_ox_ps
            best_oy = best_oy_ps

    if scale < 1.0:
        best_ox = int(best_ox / scale)
        best_oy = int(best_oy / scale)
        best_ps = int(best_ps / scale)
        best_ps = max(4, best_ps)

        fine_range = min(best_ps, 3)
        arr_full = np.array(img.convert('RGB')).astype(np.float32)
        h_f, w_f = arr_full.shape[:2]
        dx_f = np.zeros((h_f, w_f), dtype=np.float32)
        dx_f[:, 1:] = np.sum(np.abs(arr_full[:, 1:] - arr_full[:, :-1]), axis=2)
        dy_f = np.zeros((h_f, w_f), dtype=np.float32)
        dy_f[1:, :] = np.sum(np.abs(arr_full[1:, :] - arr_full[:-1, :]), axis=2)

        best_score_f = -1
        best_ox_f = best_ox
        best_oy_f = best_oy
        for ox in range(max(0, best_ox - fine_range), min(best_ox + fine_range + 1, best_ps)):
            x_lines = list(range(ox, w_f, best_ps))
            if len(x_lines) < 2:
                continue
            score_x = np.sum(dx_f[:, x_lines])
            for oy in range(max(0, best_oy - fine_range), min(best_oy + fine_range + 1, best_ps)):
                y_lines = list(range(oy, h_f, best_ps))
                if len(y_lines) < 2:
                    continue
                score_y = np.sum(dy_f[y_lines, :])
                score = score_x + score_y
                if score > best_score_f:
                    best_score_f = score
                    best_ox_f = ox
                    best_oy_f = oy
        best_ox = best_ox_f
        best_oy = best_oy_f

    return best_ps, best_ox, best_oy


def sample_pixel_block(img_arr, x0, y0, block_w, block_h, sampling_mode='mode'):
    """
    从图像数组的一个块中采样颜色。
    sampling_mode: 'center' | 'mode' | 'mean'
    返回 (r, g, b, a) 或 None（如果块全透明）
    """
    h, w = img_arr.shape[:2]
    x1 = min(x0 + block_w, w)
    y1 = min(y0 + block_h, h)
    if x0 >= w or y0 >= h or x1 <= x0 or y1 <= y0:
        return None

    block = img_arr[y0:y1, x0:x1]

    if sampling_mode == 'center':
        cy = min(y0 + block_h // 2, h - 1)
        cx = min(x0 + block_w // 2, w - 1)
        return tuple(img_arr[cy, cx])

    if sampling_mode == 'mean':
        alphas = block[:, :, 3]
        opaque = alphas >= 128
        if not opaque.any():
            return None
        rgb = block[:, :, :3]
        mean_rgb = np.mean(rgb[opaque], axis=0)
        mean_a = np.mean(alphas)
        return (int(mean_rgb[0]), int(mean_rgb[1]), int(mean_rgb[2]), int(mean_a))

    # mode (default): 众数采样
    pixels = block.reshape(-1, 4)
    opaque_mask = pixels[:, 3] >= 128
    if not opaque_mask.any():
        return None
    opaque_pixels = pixels[opaque_mask]
    encoded = (opaque_pixels[:, 0].astype(np.uint32) * 256 * 256 * 256 +
               opaque_pixels[:, 1].astype(np.uint32) * 256 * 256 +
               opaque_pixels[:, 2].astype(np.uint32) * 256 +
               opaque_pixels[:, 3].astype(np.uint32))
    unique, counts = np.unique(encoded, return_counts=True)
    most_common = unique[counts.argmax()]
    a = most_common & 0xFF
    most_common >>= 8
    b = most_common & 0xFF
    most_common >>= 8
    g = most_common & 0xFF
    most_common >>= 8
    r = most_common & 0xFF
    return (r, g, b, a)


def generate_pixel_data(input_path, pixel_size, pixel_size_w=None, pixel_size_h=None,
                        offset_x=0, offset_y=0,
                        sampling_mode='mode', remove_bg=False, bg_threshold=80,
                        color_quantize=0):
    """
    处理像素风格图片，支持多种采样方式和预处理。
    pixel_size: 0=自动检测（当 pixel_size_w/h 未指定时作为默认值）
    pixel_size_w/pixel_size_h: 可分别指定宽/高方向像素块大小，实现长宽不一致网格
    offset_x/offset_y: -1=自动检测
    """
    img = Image.open(input_path).convert("RGBA")
    img_w, img_h = img.size
    img_arr = np.array(img)

    # 自动检测
    if pixel_size <= 0 or offset_x < 0 or offset_y < 0:
        detected_ps, detected_ox, detected_oy = detect_pixel_size_and_alignment(img)
        if pixel_size <= 0:
            pixel_size = detected_ps
        if offset_x < 0:
            offset_x = detected_ox
        if offset_y < 0:
            offset_y = detected_oy

    pixel_size = max(1, int(pixel_size))
    offset_x = max(0, int(offset_x))
    offset_y = max(0, int(offset_y))

    # 支持长宽不一致的像素块
    ps_w = pixel_size_w if pixel_size_w is not None else pixel_size
    ps_h = pixel_size_h if pixel_size_h is not None else pixel_size
    ps_w = max(1, int(ps_w))
    ps_h = max(1, int(ps_h))

    # 边缘补全：向上取整，不截断边缘
    cols = max(1, math.ceil((img_w - offset_x) / ps_w))
    rows = max(1, math.ceil((img_h - offset_y) / ps_h))

    # 背景色检测
    bg_color = None
    if remove_bg:
        border_colors = {}
        for gy in range(rows):
            for gx in range(cols):
                if gy == 0 or gy == rows - 1 or gx == 0 or gx == cols - 1:
                    x0 = offset_x + gx * ps_w
                    y0 = offset_y + gy * ps_h
                    bw = min(ps_w, img_w - x0)
                    bh = min(ps_h, img_h - y0)
                    color = sample_pixel_block(img_arr, x0, y0, bw, bh, sampling_mode='mode')
                    if color is not None:
                        key = color[0] * 256 * 256 + color[1] * 256 + color[2]
                        border_colors[key] = border_colors.get(key, 0) + 1

        total_border = sum(border_colors.values())
        if total_border > 0:
            best_key = max(border_colors, key=lambda k: border_colors[k])
            best_ratio = border_colors[best_key] / total_border * 100
            if best_ratio >= clamp_param(bg_threshold, 0, 100):
                bg_color = (
                    (best_key >> 16) & 0xFF,
                    (best_key >> 8) & 0xFF,
                    best_key & 0xFF
                )

    # 采样所有像素块
    grid_data = []
    color_usage = {}
    raw_colors = []

    for gy in range(rows):
        row_data = []
        for gx in range(cols):
            x0 = offset_x + gx * ps_w
            y0 = offset_y + gy * ps_h
            bw = min(ps_w, img_w - x0)
            bh = min(ps_h, img_h - y0)

            color = sample_pixel_block(img_arr, x0, y0, bw, bh, sampling_mode)

            if color is None or color[3] < 128:
                closest_hex = "transparent"
                codes = {}
            else:
                rgb = (color[0], color[1], color[2])
                if bg_color is not None and rgb == bg_color:
                    closest_hex = "transparent"
                    codes = {}
                else:
                    closest_hex = find_closest_color(rgb)
                    codes = color_mapping.get(closest_hex, {})
                    if closest_hex not in color_usage:
                        color_usage[closest_hex] = {
                            "hex": closest_hex,
                            "count": 0,
                            "codes": codes
                        }
                    color_usage[closest_hex]["count"] += 1
                    raw_colors.append(rgb)

            row_data.append({
                "x": gx,
                "y": gy,
                "color": closest_hex,
                "codes": codes
            })
        grid_data.append(row_data)

    # 颜色量化
    if color_quantize > 0 and raw_colors:
        unique_colors = list(set(raw_colors))
        total = len(unique_colors)
        keep_ratio = (100 - clamp_param(color_quantize, 0, 100)) / 100.0
        keep_count = max(2, int(total * keep_ratio))
        keep_count = min(keep_count, total, 256)

        if keep_count < total:
            main_colors = unique_colors[:keep_count]
            main_arr = np.array(main_colors, dtype=np.float32)

            for row in grid_data:
                for cell in row:
                    if cell["color"] != "transparent":
                        from utils import hex_to_rgb
                        rgb = hex_to_rgb(cell["color"])
                        dists = np.sqrt(np.sum((main_arr - np.array(rgb, dtype=np.float32)) ** 2, axis=1))
                        new_rgb = tuple(main_arr[dists.argmin()].astype(np.uint8))
                        new_hex = '#{:02x}{:02x}{:02x}'.format(new_rgb[0], new_rgb[1], new_rgb[2])
                        if new_hex != cell["color"]:
                            cell["color"] = new_hex
                            cell["codes"] = color_mapping.get(new_hex, {})

            color_usage = {}
            for row in grid_data:
                for cell in row:
                    if cell["color"] != "transparent":
                        h = cell["color"]
                        if h not in color_usage:
                            color_usage[h] = {
                                "hex": h,
                                "count": 0,
                                "codes": cell["codes"]
                            }
                        color_usage[h]["count"] += 1

    color_list = list(color_usage.values())

    return {
        "grid_size": max(cols, rows),
        "cols": cols,
        "rows": rows,
        "grid_data": grid_data,
        "color_list": color_list,
        "detected": {
            "pixel_size": pixel_size,
            "pixel_size_w": ps_w,
            "pixel_size_h": ps_h,
            "offset_x": offset_x,
            "offset_y": offset_y
        }
    }
