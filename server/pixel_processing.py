"""像素图处理：自动检测、块采样、像素图完整流程。"""
import math

import numpy as np
from PIL import Image

from colors import color_mapping, find_closest_color
from utils import logger, clamp_param


def detect_pixel_size_and_alignment(img, max_size=200):
    """
    自动检测像素图的像素块大小和对齐偏移。
    使用边缘间隔直方图 + 梯度归一化 + 块内一致性三重评分，
    避免大 ps 的 harmonic false positive（如将 32 误判为 63/156）。
    返回 (pixel_size, offset_x, offset_y)
    """
    from collections import Counter
    img_w, img_h = img.size
    scale = min(max_size / img_w, max_size / img_h, 1.0)

    def _compute_uniformity(arr_u, ps, ox, oy, threshold=50):
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

    # ---------- Phase 1: downscaled coarse search ----------
    if scale < 1.0:
        small = img.resize((int(img_w * scale), int(img_h * scale)), Image.LANCZOS)
    else:
        small = img.copy()
    arr_s = np.array(small.convert('RGB')).astype(np.float32)
    h_s, w_s = arr_s.shape[:2]

    dx_s = np.zeros((h_s, w_s), dtype=np.float32)
    dx_s[:, 1:] = np.sum(np.abs(arr_s[:, 1:] - arr_s[:, :-1]), axis=2)
    dy_s = np.zeros((h_s, w_s), dtype=np.float32)
    dy_s[1:, :] = np.sum(np.abs(arr_s[1:, :] - arr_s[:-1, :]), axis=2)

    # Edge interval histograms (fast indicator of true pixel size)
    edge_thresh_s = 50
    strong_x_s = dx_s > edge_thresh_s
    strong_y_s = dy_s > edge_thresh_s

    # 向量化：收集所有边缘间隔（替代 Python 级双重循环）
    interval_counts = Counter()
    diffs_x = []
    for y in range(h_s):
        xs = np.where(strong_x_s[y, :])[0]
        if len(xs) >= 2:
            diffs_x.append(np.diff(xs))
    if diffs_x:
        all_diffs_x = np.concatenate(diffs_x)
        valid_x = all_diffs_x[(all_diffs_x >= 2) & (all_diffs_x <= 128)]
        for d in valid_x:
            interval_counts[int(d)] += 1

    diffs_y = []
    for x in range(w_s):
        ys = np.where(strong_y_s[:, x])[0]
        if len(ys) >= 2:
            diffs_y.append(np.diff(ys))
    if diffs_y:
        all_diffs_y = np.concatenate(diffs_y)
        valid_y = all_diffs_y[(all_diffs_y >= 2) & (all_diffs_y <= 128)]
        for d in valid_y:
            interval_counts[int(d)] += 1

    # 预收集强边缘坐标，用于后续向量化 mod 计算
    strong_x_coords = np.argwhere(strong_x_s)  # shape (N, 2), 每行 (y, x)
    strong_y_coords = np.argwhere(strong_y_s)  # shape (N, 2), 每行 (y, x)
    x_vals = strong_x_coords[:, 1] if strong_x_coords.size > 0 else np.array([], dtype=int)
    y_vals = strong_y_coords[:, 0] if strong_y_coords.size > 0 else np.array([], dtype=int)

    # Score each candidate ps on downscaled image
    candidates = []
    for ps in range(4, min(65, max(w_s, h_s) // 2 + 1)):
        # Use mod-distribution peak as offset (covers large offsets efficiently)
        # 向量化：np.bincount 替代 Python 级双重循环
        if x_vals.size > 0:
            x_mod_counts = np.bincount(x_vals % ps, minlength=ps)
            best_ox = int(x_mod_counts.argmax())
        else:
            best_ox = 0

        if y_vals.size > 0:
            y_mod_counts = np.bincount(y_vals % ps, minlength=ps)
            best_oy = int(y_mod_counts.argmax())
        else:
            best_oy = 0

        x_lines = list(range(best_ox, w_s, ps))
        y_lines = list(range(best_oy, h_s, ps))
        grad = 0
        if len(x_lines) >= 2:
            grad += np.sum(dx_s[:, x_lines])
        if len(y_lines) >= 2:
            grad += np.sum(dy_s[y_lines, :])
        tp = len(x_lines) * h_s + len(y_lines) * w_s
        avg_grad = grad / tp if tp > 0 else 0
        uni = _compute_uniformity(arr_s, ps, best_ox, best_oy)
        edge_support = interval_counts.get(ps, 0) + interval_counts.get(ps - 1, 0) + interval_counts.get(ps + 1, 0)
        num_lines = len(x_lines) + len(y_lines)
        line_penalty = min(1.0, num_lines / 10.0)
        # Edge support is primary; avg_grad + uniformity secondary
        score = edge_support * 0.1 + avg_grad * (0.5 + uni * 2.0) * line_penalty
        candidates.append((ps, score))

    candidates.sort(key=lambda x: x[1], reverse=True)

    # ---------- Phase 2: verify on original image ----------
    arr = np.array(img.convert('RGB')).astype(np.float32)
    h, w = arr.shape[:2]

    dx = np.zeros((h, w), dtype=np.float32)
    dx[:, 1:] = np.sum(np.abs(arr[:, 1:] - arr[:, :-1]), axis=2)
    dy = np.zeros((h, w), dtype=np.float32)
    dy[1:, :] = np.sum(np.abs(arr[1:, :] - arr[:-1, :]), axis=2)

    edge_thresh = 100
    strong_x = dx > edge_thresh
    strong_y = dy > edge_thresh

    # 预收集原图强边缘坐标
    strong_x_coords_orig = np.argwhere(strong_x)
    strong_y_coords_orig = np.argwhere(strong_y)
    x_vals_orig = strong_x_coords_orig[:, 1] if strong_x_coords_orig.size > 0 else np.array([], dtype=int)
    y_vals_orig = strong_y_coords_orig[:, 0] if strong_y_coords_orig.size > 0 else np.array([], dtype=int)

    def _evaluate_on_original(ps):
        if x_vals_orig.size > 0:
            x_mod_counts = np.bincount(x_vals_orig % ps, minlength=ps)
            best_ox = int(x_mod_counts.argmax())
        else:
            best_ox = 0

        if y_vals_orig.size > 0:
            y_mod_counts = np.bincount(y_vals_orig % ps, minlength=ps)
            best_oy = int(y_mod_counts.argmax())
        else:
            best_oy = 0

        # Fine-tune offset ±2 around mod peak
        best_grad = -1
        best_ox_f = best_ox
        best_oy_f = best_oy
        for ox in range(max(0, best_ox - 2), min(best_ox + 3, ps)):
            x_lines = list(range(ox, w, ps))
            if len(x_lines) < 2:
                continue
            score_x = np.sum(dx[:, x_lines])
            for oy in range(max(0, best_oy - 2), min(best_oy + 3, ps)):
                y_lines = list(range(oy, h, ps))
                if len(y_lines) < 2:
                    continue
                score_y = np.sum(dy[y_lines, :])
                score = score_x + score_y
                if score > best_grad:
                    best_grad = score
                    best_ox_f = ox
                    best_oy_f = oy

        x_lines = list(range(best_ox_f, w, ps))
        y_lines = list(range(best_oy_f, h, ps))
        tp = len(x_lines) * h + len(y_lines) * w
        avg_grad = best_grad / tp if tp > 0 else 0
        uni = _compute_uniformity(arr, ps, best_ox_f, best_oy_f)

        # Edge support on original (count intervals close to ps or 2*ps)
        interval_orig = Counter()
        diffs_x_o = []
        for y in range(h):
            xs = np.where(strong_x[y, :])[0]
            if len(xs) >= 2:
                diffs_x_o.append(np.diff(xs))
        if diffs_x_o:
            all_dxo = np.concatenate(diffs_x_o)
            valid_dxo = all_dxo[(np.abs(all_dxo - ps) <= 1) | (np.abs(all_dxo - 2 * ps) <= 1)]
            for d in valid_dxo:
                interval_orig[int(d)] += 1

        diffs_y_o = []
        for x in range(w):
            ys = np.where(strong_y[:, x])[0]
            if len(ys) >= 2:
                diffs_y_o.append(np.diff(ys))
        if diffs_y_o:
            all_dyo = np.concatenate(diffs_y_o)
            valid_dyo = all_dyo[(np.abs(all_dyo - ps) <= 1) | (np.abs(all_dyo - 2 * ps) <= 1)]
            for d in valid_dyo:
                interval_orig[int(d)] += 1

        edge_support = sum(interval_orig.values())

        num_lines = len(x_lines) + len(y_lines)
        line_penalty = min(1.0, num_lines / 10.0)
        score = edge_support * 0.05 + avg_grad * (0.5 + uni * 2.0) * line_penalty
        # Slight preference for common pixel-art sizes to break ties
        if ps in (16, 24, 32, 48, 64):
            score *= 1.05
        return score, best_ox_f, best_oy_f

    checked = set()
    results = []
    for ps_s, _ in candidates[:5]:
        ps_base = int(ps_s / scale) if scale < 1.0 else ps_s
        for delta in range(-3, 4):
            ps = ps_base + delta
            if ps < 4 or ps > min(img_w, img_h) // 2:
                continue
            if ps in checked:
                continue
            checked.add(ps)
            score, ox, oy = _evaluate_on_original(ps)
            results.append((score, ps, ox, oy))

    results.sort(key=lambda x: x[0], reverse=True)
    best_score, best_ps, best_ox, best_oy = results[0]

    # Prefer common pixel-art sizes (16,24,32,48,64) when scores are close (< 5% gap)
    common_sizes = {16, 24, 32, 48, 64}
    if best_ps not in common_sizes:
        for score, ps, ox, oy in results[1:]:
            if ps in common_sizes and score > best_score * 0.95:
                best_ps, best_ox, best_oy = ps, ox, oy
                break

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

    # mode (default): 众数采样（只编码 RGB，opaque_mask 已保证 alpha ≥ 128）
    pixels = block.reshape(-1, 4)
    opaque_mask = pixels[:, 3] >= 128
    if not opaque_mask.any():
        return None
    opaque_pixels = pixels[opaque_mask]
    encoded = (opaque_pixels[:, 0].astype(np.uint32) * 256 * 256 +
               opaque_pixels[:, 1].astype(np.uint32) * 256 +
               opaque_pixels[:, 2].astype(np.uint32))
    unique, counts = np.unique(encoded, return_counts=True)
    most_common = unique[counts.argmax()]
    b = most_common & 0xFF
    most_common >>= 8
    g = most_common & 0xFF
    most_common >>= 8
    r = most_common & 0xFF
    return (r, g, b, 255)


def generate_pixel_data(img, pixel_size, pixel_size_w=None, pixel_size_h=None,
                        offset_x=0, offset_y=0,
                        sampling_mode='mode', remove_bg=False, bg_threshold=80,
                        color_quantize=0, color_mode='full'):
    """
    处理像素风格图片，支持多种采样方式和预处理。
    img: PIL.Image 对象（RGBA 模式）
    pixel_size: 0=自动检测（当 pixel_size_w/h 未指定时作为默认值）
    pixel_size_w/pixel_size_h: 可分别指定宽/高方向像素块大小，实现长宽不一致网格
    offset_x/offset_y: -1=自动检测
    """
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
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

    # 支持长宽不一致的像素块
    ps_w = pixel_size_w if pixel_size_w is not None else pixel_size
    ps_h = pixel_size_h if pixel_size_h is not None else pixel_size
    ps_w = max(1, int(ps_w))
    ps_h = max(1, int(ps_h))

    # 偏移量取模，避免超过 pixel_size 导致丢弃整列/整行
    offset_x = max(0, int(offset_x)) % ps_w
    offset_y = max(0, int(offset_y)) % ps_h

    # 偏移量优化：当 offset 接近 ps 时，尝试 offset=0，选择覆盖更多像素的方案
    # 这修复了检测算法返回接近 ps 的偏移量导致最左侧/顶部像素被跳过的问题
    def _optimize_offset(img_dim, offset, ps):
        if offset <= ps / 2:
            return offset
        cols_orig = max(1, math.ceil((img_dim - offset) / ps))
        covered_orig = sum(min(ps, img_dim - (offset + gx * ps)) for gx in range(cols_orig))
        cols_zero = max(1, math.ceil(img_dim / ps))
        covered_zero = sum(min(ps, img_dim - gx * ps) for gx in range(cols_zero))
        if covered_zero >= covered_orig:
            return 0
        return offset

    offset_x = _optimize_offset(img_w, offset_x, ps_w)
    offset_y = _optimize_offset(img_h, offset_y, ps_h)

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
                rgb = (int(color[0]), int(color[1]), int(color[2]))
                if bg_color is not None and max(
                    abs(rgb[0] - int(bg_color[0])),
                    abs(rgb[1] - int(bg_color[1])),
                    abs(rgb[2] - int(bg_color[2]))
                ) < 10:
                    closest_hex = "transparent"
                    codes = {}
                else:
                    closest_hex = find_closest_color(rgb, mode=color_mode)
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
        from collections import Counter
        # 按出现频率排序，保留最主要的颜色（修复原 set() 无序切片导致结果随机的问题）
        color_counter = Counter(raw_colors)
        unique_colors = [color for color, _ in color_counter.most_common()]
        total = len(unique_colors)
        keep_ratio = (100 - clamp_param(color_quantize, 0, 100)) / 100.0
        keep_count = max(1, int(total * keep_ratio))
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
