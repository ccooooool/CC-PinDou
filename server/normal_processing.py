"""普通图片处理流程：主导色提取 -> 颜色匹配 -> BFS 合并。"""
import numpy as np
from PIL import Image

from colors import color_mapping, find_closest_color
from image_processing import enhance_lines, remove_background, simplify_colors
from utils import hex_to_rgb, logger


def _color_dist_rgb(hex_a, hex_b):
    """计算两个 hex 颜色在 RGB 空间的欧氏距离。"""
    if hex_a == hex_b:
        return 0.0
    if hex_a == 'transparent' or hex_b == 'transparent':
        return float('inf')
    r1, g1, b1 = hex_to_rgb(hex_a)
    r2, g2, b2 = hex_to_rgb(hex_b)
    return ((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) ** 0.5


def _bfs_merge(grid_data, threshold=25):
    """
    BFS 连通区域检测与合并。
    将颜色距离小于 threshold 的相邻格子聚合为同一颜色（区域内最高频色）。
    与前端 PerlerEngine.bfsMerge() 逻辑一致。
    """
    rows = len(grid_data)
    if rows == 0:
        return grid_data
    cols = len(grid_data[0])

    visited = [[False] * cols for _ in range(rows)]
    new_grid = [[dict(cell) for cell in row] for row in grid_data]
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]

    for y in range(rows):
        for x in range(cols):
            if visited[y][x]:
                continue

            base_color = grid_data[y][x]['color']
            region = []
            queue = [(x, y)]
            visited[y][x] = True

            while queue:
                cx, cy = queue.pop(0)
                region.append((cx, cy))

                for dx, dy in directions:
                    nx, ny = cx + dx, cy + dy
                    if nx < 0 or nx >= cols or ny < 0 or ny >= rows:
                        continue
                    if visited[ny][nx]:
                        continue
                    if _color_dist_rgb(base_color, grid_data[ny][nx]['color']) < threshold:
                        visited[ny][nx] = True
                        queue.append((nx, ny))

            # 统计区域内最高频颜色
            freq = {}
            for rx, ry in region:
                c = grid_data[ry][rx]['color']
                freq[c] = freq.get(c, 0) + 1

            max_color = base_color
            max_count = 0
            for c, count in freq.items():
                if count > max_count:
                    max_count = count
                    max_color = c

            # 应用合并后的颜色
            for rx, ry in region:
                new_grid[ry][rx]['color'] = max_color
                new_grid[ry][rx]['codes'] = (
                    color_mapping.get(max_color, {}) if max_color != 'transparent' else {}
                )

    return new_grid


def _find_connected_regions(grid_data):
    """检测所有连通区域（四邻域，颜色严格相同），返回 [(color, cells, area), ...]。"""
    rows = len(grid_data)
    if rows == 0:
        return []
    cols = len(grid_data[0])
    visited = [[False] * cols for _ in range(rows)]
    regions = []
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]

    for y in range(rows):
        for x in range(cols):
            if visited[y][x]:
                continue
            color = grid_data[y][x]['color']
            cells = []
            queue = [(x, y)]
            visited[y][x] = True
            while queue:
                cx, cy = queue.pop(0)
                cells.append((cx, cy))
                for dx, dy in directions:
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < cols and 0 <= ny < rows and not visited[ny][nx]:
                        if grid_data[ny][nx]['color'] == color:
                            visited[ny][nx] = True
                            queue.append((nx, ny))
            regions.append((color, cells, len(cells)))
    return regions


def _adaptive_merge(grid_data, base_threshold=25, min_area=4):
    """
    自适应 BFS 合并：
    1. 先做标准 BFS 合并（threshold=base_threshold）
    2. 检测所有连通区域
    3. 面积 < min_area 的区域视为"孤岛"，强制合并到最大邻居
    """
    # 步骤 1：标准 BFS 合并
    merged = _bfs_merge(grid_data, threshold=base_threshold)
    rows = len(merged)
    if rows == 0:
        return merged
    cols = len(merged[0])

    # 步骤 2：检测严格连通区域
    regions = _find_connected_regions(merged)

    # 步骤 3：处理孤岛
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    for color, cells, area in regions:
        if area >= min_area or color == 'transparent':
            continue

        # 找到邻居中面积最大的颜色
        neighbor_colors = {}
        for cx, cy in cells:
            for dx, dy in directions:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < cols and 0 <= ny < rows:
                    nc = merged[ny][nx]['color']
                    if nc != color and nc != 'transparent':
                        # 统计该邻居颜色对应的区域面积
                        neighbor_colors[nc] = neighbor_colors.get(nc, 0) + 1

        if neighbor_colors:
            best_neighbor = max(neighbor_colors.items(), key=lambda x: x[1])[0]
            for cx, cy in cells:
                merged[cy][cx]['color'] = best_neighbor
                merged[cy][cx]['codes'] = color_mapping.get(best_neighbor, {})

    return merged


def _limit_global_colors(grid_data, color_list, max_colors):
    """
    全局色号限制优化：
    1. 统计所有色号频率
    2. 保留 Top-N 高频色号（N = max_colors）
    3. 低频色号替换为最近保留色（OKLab 距离，限制在保留色集合内）
    """
    if not max_colors or max_colors <= 0 or len(color_list) <= max_colors:
        return grid_data, color_list

    # 按频率排序，保留 Top-N
    sorted_colors = sorted(color_list, key=lambda c: c['count'], reverse=True)
    keep_hexes = set(c['hex'] for c in sorted_colors[:max_colors])

    rows = len(grid_data)
    cols = len(grid_data[0]) if rows > 0 else 0

    # 收集所有需要替换的低频色
    replace_map = {}
    for row in grid_data:
        for cell in row:
            c = cell['color']
            if c != 'transparent' and c not in keep_hexes:
                if c not in replace_map:
                    replace_map[c] = None

    if replace_map:
        # 仅在保留色集合内查找最近替代色（OKLab 距离）
        from colors import _batch_rgb_to_oklab

        keep_list = list(keep_hexes)
        keep_rgb = np.array([hex_to_rgb(h) for h in keep_list], dtype=np.float32)
        keep_oklab = _batch_rgb_to_oklab(keep_rgb)

        low_colors = list(replace_map.keys())
        low_rgb = np.array([hex_to_rgb(h) for h in low_colors], dtype=np.float32)
        low_oklab = _batch_rgb_to_oklab(low_rgb)

        # 向量化距离计算: (N_low, 1, 3) - (1, N_keep, 3) → (N_low, N_keep)
        diff = low_oklab[:, np.newaxis, :] - keep_oklab[np.newaxis, :, :]
        dists = np.sum(diff ** 2, axis=2)
        best_indices = dists.argmin(axis=1)

        for old, idx in zip(low_colors, best_indices):
            replace_map[old] = keep_list[int(idx)]

    # 替换
    for y in range(rows):
        for x in range(cols):
            c = grid_data[y][x]['color']
            if c != 'transparent' and c not in keep_hexes:
                new_color = replace_map.get(c, c)
                grid_data[y][x]['color'] = new_color
                grid_data[y][x]['codes'] = color_mapping.get(new_color, {})

    # 重新统计 color_list
    new_usage = {}
    for row in grid_data:
        for cell in row:
            c = cell['color']
            if c != 'transparent':
                if c not in new_usage:
                    new_usage[c] = {
                        'hex': c,
                        'count': 0,
                        'codes': color_mapping.get(c, {})
                    }
                new_usage[c]['count'] += 1

    new_color_list = list(new_usage.values())
    return grid_data, new_color_list


def _dominant_color(img_arr, sx, sy, sw, sh):
    """
    从指定区域提取主导色（出现频率最高的颜色）。
    对颜色做 4-bit 量化后统计频率，既加速又具有抗噪能力。
    与前端 PerlerEngine.dominantColor() 逻辑保持一致。
    """
    h, w, _ = img_arr.shape
    freq = {}

    for y in range(sy, min(sy + sh, h)):
        for x in range(sx, min(sx + sw, w)):
            a = img_arr[y, x, 3]
            if a < 128:
                continue  # 跳过透明

            # 4-bit 量化：将 0-255 压缩到 0-15
            r = img_arr[y, x, 0] >> 4
            g = img_arr[y, x, 1] >> 4
            b = img_arr[y, x, 2] >> 4
            key = (r, g, b)
            freq[key] = freq.get(key, 0) + 1

    if not freq:
        return None

    # 取频率最高的颜色
    best = max(freq.items(), key=lambda item: item[1])[0]
    # 还原到 8-bit
    return (best[0] << 4, best[1] << 4, best[2] << 4)


def generate_perler_bead_data(
        input_path,
        grid_size=50,
        remove_bg=True,
        color_simplify=0,
        remove_bg_threshold=30,
        enhance_lines_strength=0,
        bg_model=None,
        color_mode='full',
        adaptive_merge=True,
        min_area=4,
        max_colors=None,
        bfs_threshold=25
):
    """普通图片模式完整处理流程。"""
    img = Image.open(input_path).convert("RGBA")
    img_w, img_h = img.size

    if enhance_lines_strength > 0:
        img = enhance_lines(img, enhance_lines_strength)

    if remove_bg:
        img = remove_background(img, edge_threshold=remove_bg_threshold, model_name=bg_model)
        img_w, img_h = img.size

    # 颜色简化在原图上进行（simplify_colors 内部会缩小到 200px 分析，不会太慢）
    if color_simplify > 0:
        img = simplify_colors(img, color_simplify)

    # 计算保持原比例的绘制区域（横幅水平铺满垂直居中，竖条垂直铺满水平居中）
    if img_w >= img_h:
        draw_w = grid_size
        draw_h = max(1, round(grid_size * img_h / img_w))
        offset_x = 0
        offset_y = (grid_size - draw_h) // 2
    else:
        draw_h = grid_size
        draw_w = max(1, round(grid_size * img_w / img_h))
        offset_y = 0
        offset_x = (grid_size - draw_w) // 2

    # 转为 numpy 数组，直接在原图分辨率上按格子采样
    img_arr = np.array(img.convert('RGBA'))

    grid_data = []
    color_usage = {}

    for gy in range(grid_size):
        row_data = []
        for gx in range(grid_size):
            # 有效绘制区域外的格子设为透明
            if gx < offset_x or gx >= offset_x + draw_w or gy < offset_y or gy >= offset_y + draw_h:
                row_data.append({
                    "color": "transparent",
                    "codes": {}
                })
                continue

            # 在有效区域内，从原图对应位置采样
            local_x = gx - offset_x
            local_y = gy - offset_y

            sx = round((local_x * img_w) / draw_w)
            sy = round((local_y * img_h) / draw_h)
            sx_next = round(((local_x + 1) * img_w) / draw_w)
            sy_next = round(((local_y + 1) * img_h) / draw_h)
            sw = max(1, sx_next - sx)
            sh = max(1, sy_next - sy)

            # 限制在图片边界内
            sx = min(sx, img_w - 1)
            sy = min(sy, img_h - 1)

            dominant = _dominant_color(img_arr, sx, sy, sw, sh)

            if dominant:
                closest_hex = find_closest_color(dominant, mode=color_mode)
                codes = color_mapping.get(closest_hex, {})
                if closest_hex not in color_usage:
                    color_usage[closest_hex] = {
                        "hex": closest_hex,
                        "count": 0,
                        "codes": codes
                    }
                color_usage[closest_hex]["count"] += 1
                row_data.append({
                    "color": closest_hex,
                    "codes": codes
                })
            else:
                row_data.append({
                    "color": "transparent",
                    "codes": {}
                })
        grid_data.append(row_data)

    color_list = list(color_usage.values())

    # Phase 1.2: BFS 连通区域合并
    if adaptive_merge:
        # Phase 3.1: 自适应 BFS 合并（含标准 BFS + 孤岛处理）
        grid_data = _adaptive_merge(grid_data, base_threshold=bfs_threshold, min_area=min_area)
    else:
        grid_data = _bfs_merge(grid_data, threshold=bfs_threshold)

    # Phase 3.2: 全局色号限制优化
    if max_colors and max_colors > 0:
        grid_data, color_list = _limit_global_colors(grid_data, color_list, max_colors)
        # 限制色号后可能产生新的可合并区域，再次 BFS 合并
        grid_data = _bfs_merge(grid_data, threshold=bfs_threshold)
    else:
        # 重新统计 color_usage（BFS 合并后颜色可能变化）
        new_usage = {}
        for row in grid_data:
            for cell in row:
                c = cell['color']
                if c != 'transparent':
                    if c not in new_usage:
                        new_usage[c] = {
                            'hex': c,
                            'count': 0,
                            'codes': color_mapping.get(c, {})
                        }
                    new_usage[c]['count'] += 1
        color_list = list(new_usage.values())

    return {
        "grid_size": grid_size,
        "grid_data": grid_data,
        "color_list": color_list
    }
