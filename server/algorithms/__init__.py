"""替代量化算法统一入口。

提供与现有 dominant 方案等价的接口，支持 K-Means、SLIC、Mean-Shift 等实验性算法。
所有算法返回统一格式：{"grid_size", "grid_data", "color_list"}

依赖说明：
- scikit-learn: K-Means, Mean-Shift
- scikit-image: SLIC
未安装时对应算法自动降级并返回友好错误。
"""

import numpy as np
from PIL import Image

from colors import color_mapping, find_closest_colors_batch
from utils import logger


def _resize_to_grid(img_arr, grid_size):
    """将图像数组缩放到 grid_size x grid_size，使用最近邻插值。"""
    h, w = img_arr.shape[:2]
    # 使用 PIL 做最近邻缩放（与拼豆网格对应）
    pil_img = Image.fromarray(img_arr)
    resized = pil_img.resize((grid_size, grid_size), Image.NEAREST)
    return np.array(resized)


def _quantize_to_perler(pixel_colors, mode='full'):
    """将像素颜色数组批量映射到拼豆色号。"""
    # pixel_colors: ndarray (N, 3) uint8
    if pixel_colors.size == 0:
        return []
    return find_closest_colors_batch(pixel_colors, mode=mode)


def _build_grid_data(label_map, color_map, grid_size, mode='full'):
    """
    根据标签图和颜色映射构建 grid_data 和 color_list。
    label_map: ndarray (grid_size, grid_size)，每个格子的聚类标签/超像素ID
    color_map: dict {label_id -> hex_color}，标签到拼豆色号的映射
    """
    from colors import color_mapping

    grid_data = []
    usage = {}

    for y in range(grid_size):
        row = []
        for x in range(grid_size):
            label = int(label_map[y, x])
            hex_color = color_map.get(label, 'transparent')

            if hex_color != 'transparent':
                if hex_color not in usage:
                    usage[hex_color] = {
                        'hex': hex_color,
                        'count': 0,
                        'codes': color_mapping.get(hex_color, {})
                    }
                usage[hex_color]['count'] += 1

            row.append({
                'color': hex_color,
                'codes': color_mapping.get(hex_color, {}) if hex_color != 'transparent' else {}
            })
        grid_data.append(row)

    color_list = list(usage.values())
    return grid_data, color_list


def dominant_grid(img, grid_size=50, color_mode='full', **kwargs):
    """
    现有方案：逐格主导色提取（Baseline）。
    内部直接委托 normal_processing.generate_perler_bead_data 的等效逻辑。
    但这里我们直接在传入的 PIL Image 上操作，避免文件 IO。
    """
    from normal_processing import _dominant_color

    img = img.convert('RGBA')
    img_w, img_h = img.size
    img_arr = np.array(img)

    # 保持原比例
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

    grid_data = []
    usage = {}

    for gy in range(grid_size):
        row = []
        for gx in range(grid_size):
            if gx < offset_x or gx >= offset_x + draw_w or gy < offset_y or gy >= offset_y + draw_h:
                row.append({'color': 'transparent', 'codes': {}})
                continue

            local_x = gx - offset_x
            local_y = gy - offset_y

            sx = round((local_x * img_w) / draw_w)
            sy = round((local_y * img_h) / draw_h)
            sx_next = round(((local_x + 1) * img_w) / draw_w)
            sy_next = round(((local_y + 1) * img_h) / draw_h)
            sw = max(1, sx_next - sx)
            sh = max(1, sy_next - sy)

            sx = min(sx, img_w - 1)
            sy = min(sy, img_h - 1)

            dominant = _dominant_color(img_arr, sx, sy, sw, sh)

            if dominant:
                from colors import find_closest_color
                closest_hex = find_closest_color(dominant, mode=color_mode)
                codes = color_mapping.get(closest_hex, {})
                if closest_hex not in usage:
                    usage[closest_hex] = {'hex': closest_hex, 'count': 0, 'codes': codes}
                usage[closest_hex]['count'] += 1
                row.append({'color': closest_hex, 'codes': codes})
            else:
                row.append({'color': 'transparent', 'codes': {}})
        grid_data.append(row)

    # 应用 BFS 合并和自适应合并
    from normal_processing import _adaptive_merge, _limit_global_colors

    adaptive_merge = kwargs.get('adaptive_merge', True)
    min_area = kwargs.get('min_area', 4)
    bfs_threshold = kwargs.get('bfs_threshold', 25)
    max_colors = kwargs.get('max_colors', None)

    if adaptive_merge:
        grid_data = _adaptive_merge(grid_data, base_threshold=bfs_threshold, min_area=min_area)
    else:
        from normal_processing import _bfs_merge
        grid_data = _bfs_merge(grid_data, threshold=bfs_threshold)

    if max_colors and max_colors > 0:
        color_list = list(usage.values())
        grid_data, color_list = _limit_global_colors(grid_data, color_list, max_colors)
        from normal_processing import _bfs_merge
        grid_data = _bfs_merge(grid_data, threshold=bfs_threshold)
    else:
        # 重新统计（BFS 后颜色可能变化）
        usage2 = {}
        for row in grid_data:
            for cell in row:
                c = cell['color']
                if c != 'transparent':
                    if c not in usage2:
                        usage2[c] = {'hex': c, 'count': 0, 'codes': color_mapping.get(c, {})}
                    usage2[c]['count'] += 1
        color_list = list(usage2.values())

    return {
        'grid_size': grid_size,
        'grid_data': grid_data,
        'color_list': color_list
    }


# =============================================================================
# 以下为实验性算法，依赖 scikit-learn / scikit-image
# =============================================================================

def kmeans_grid(img, grid_size=50, color_mode='full', **kwargs):
    """
    K-Means 颜色量化方案。

    步骤：
    1. 收集所有不透明像素
    2. 在 OKLab 空间做 K-Means 聚类（K = 目标色号数，默认 50）
    3. 每个聚类中心映射到最近拼豆色号
    4. 每个像素分配到最近中心 → 拼豆色号
    5. 最近邻缩放到 grid_size
    """
    try:
        from sklearn.cluster import KMeans
    except ImportError:
        logger.warning("scikit-learn 未安装，K-Means 算法降级到 dominant")
        return dominant_grid(img, grid_size=grid_size, color_mode=color_mode, **kwargs)

    k = kwargs.get('kmeans_k', 50)
    k = max(2, min(k, 200))  # 限制合理范围

    img = img.convert('RGBA')
    img_arr = np.array(img)
    h, w = img_arr.shape[:2]

    # 收集不透明像素
    pixels = img_arr.reshape(-1, 4)
    opaque_mask = pixels[:, 3] >= 128
    opaque_rgb = pixels[opaque_mask][:, :3].astype(np.float32)

    if len(opaque_rgb) == 0:
        return dominant_grid(img, grid_size=grid_size, color_mode=color_mode, **kwargs)

    # RGB → OKLab
    from colors import _batch_rgb_to_oklab
    opaque_oklab = _batch_rgb_to_oklab(opaque_rgb)

    # K-Means 聚类（OKLab 空间）
    sample_size = min(50000, len(opaque_oklab))
    if sample_size < len(opaque_oklab):
        indices = np.random.choice(len(opaque_oklab), sample_size, replace=False)
        sample_oklab = opaque_oklab[indices]
    else:
        sample_oklab = opaque_oklab

    kmeans = KMeans(n_clusters=min(k, sample_size), random_state=42, n_init=10)
    kmeans.fit(sample_oklab)
    centers_oklab = kmeans.cluster_centers_.astype(np.float32)

    # 聚类中心映射到拼豆色号
    # OKLab → RGB 的逆变换较复杂，这里直接在 RGB 空间近似：
    # 用聚类中心的 OKLab 找最近拼豆色（find_closest_colors_batch 需要 RGB 输入）
    # 简化：直接用聚类中心对应的样本平均 RGB
    center_rgbs = []
    labels = kmeans.predict(opaque_oklab)
    for i in range(len(centers_oklab)):
        cluster_pixels = opaque_rgb[labels == i]
        if len(cluster_pixels) > 0:
            center_rgbs.append(cluster_pixels.mean(axis=0))
        else:
            center_rgbs.append(opaque_rgb[labels == i][:1].mean(axis=0) if np.any(labels == i) else opaque_rgb[0])
    center_rgbs = np.array(center_rgbs, dtype=np.float32)

    perler_centers = find_closest_colors_batch(center_rgbs, mode=color_mode)

    # 为每个像素分配拼豆色号
    label_to_hex = {i: h for i, h in enumerate(perler_centers)}
    perler_labels = np.array([label_to_hex[l] for l in labels])

    # 重建彩色图像（拼豆色号对应的 RGB）
    hex_to_rgb_map = {h: tuple(int(h.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)) for h in set(perler_centers)}
    result_rgb = np.zeros((h * w, 3), dtype=np.uint8)
    result_rgb[opaque_mask] = [hex_to_rgb_map[h] for h in perler_labels]
    result_rgb = result_rgb.reshape(h, w, 3)

    # 最近邻缩放到 grid_size
    resized = _resize_to_grid(result_rgb, grid_size)

    # 构建 grid_data
    # 将 RGB 映射回拼豆色号
    flat_rgb = resized.reshape(-1, 3).astype(np.float32)
    flat_hex = find_closest_colors_batch(flat_rgb, mode=color_mode)
    hex_grid = np.array(flat_hex).reshape(grid_size, grid_size)

    # 构建输出
    color_map = {}
    for i, h in enumerate(set(flat_hex)):
        color_map[i] = h

    # 需要将 hex_grid 转为 label_map（每个 hex 给一个唯一 label）
    unique_hexes = list(set(flat_hex))
    hex_to_label = {h: i for i, h in enumerate(unique_hexes)}
    label_map = np.array([[hex_to_label[hex_grid[y, x]] for x in range(grid_size)] for y in range(grid_size)])
    color_map = {i: h for i, h in enumerate(unique_hexes)}

    grid_data, color_list = _build_grid_data(label_map, color_map, grid_size, mode=color_mode)

    return {
        'grid_size': grid_size,
        'grid_data': grid_data,
        'color_list': color_list
    }


def slic_grid(img, grid_size=50, color_mode='full', **kwargs):
    """
    SLIC 超像素分割方案。

    步骤：
    1. SLIC 分割图片为超像素
    2. 每个超像素提取主导色
    3. 主导色映射到拼豆色号
    4. 最近邻缩放到 grid_size
    """
    try:
        from skimage.segmentation import slic
        from skimage.util import img_as_float
    except ImportError:
        logger.warning("scikit-image 未安装，SLIC 算法降级到 dominant")
        return dominant_grid(img, grid_size=grid_size, color_mode=color_mode, **kwargs)

    n_segments = kwargs.get('slic_segments', 500)
    compactness = kwargs.get('slic_compactness', 10)

    img = img.convert('RGBA')
    img_arr = np.array(img)
    h, w = img_arr.shape[:2]

    # SLIC 在 RGB 通道上做
    rgb = img_arr[:, :, :3]
    segments = slic(rgb, n_segments=n_segments, compactness=compactness, start_label=0)

    # 每个超像素提取主导色
    superpixel_colors = {}
    for seg_id in np.unique(segments):
        mask = segments == seg_id
        pixels = img_arr[mask]
        opaque = pixels[pixels[:, 3] >= 128][:, :3]
        if len(opaque) == 0:
            superpixel_colors[seg_id] = 'transparent'
        else:
            # 4-bit 量化主导色
            from normal_processing import _dominant_color
            # _dominant_color 需要 (h, w, 4) 数组和 sx, sy, sw, sh
            # 这里简化：直接统计频率
            quantized = (opaque // 16) * 16
            unique, counts = np.unique(quantized, axis=0, return_counts=True)
            dominant_rgb = tuple(unique[counts.argmax()])
            from colors import find_closest_color
            superpixel_colors[seg_id] = find_closest_color(dominant_rgb, mode=color_mode)

    # 构建标签图（超像素 ID）
    # 缩放到 grid_size
    seg_pil = Image.fromarray(segments.astype(np.uint16))
    seg_resized = np.array(seg_pil.resize((grid_size, grid_size), Image.NEAREST))

    # 每个格子选择面积最大的超像素
    label_map = np.zeros((grid_size, grid_size), dtype=int)
    for gy in range(grid_size):
        for gx in range(grid_size):
            # 用最近邻的值
            label_map[gy, gx] = seg_resized[gy, gx]

    color_map = superpixel_colors

    # 构建输出
    grid_data, color_list = _build_grid_data(label_map, color_map, grid_size, mode=color_mode)

    return {
        'grid_size': grid_size,
        'grid_data': grid_data,
        'color_list': color_list
    }


def meanshift_grid(img, grid_size=50, color_mode='full', **kwargs):
    """
    Mean-Shift 颜色量化方案。

    步骤：
    1. 收集不透明像素
    2. 估计带宽，在 OKLab 空间做 Mean-Shift 聚类
    3. 每个中心映射到拼豆色号
    4. 最近邻缩放到 grid_size

    注意：Mean-Shift 计算量大，大图会自动采样到最多 20000 像素。
    """
    try:
        from sklearn.cluster import MeanShift, estimate_bandwidth
    except ImportError:
        logger.warning("scikit-learn 未安装，Mean-Shift 算法降级到 dominant")
        return dominant_grid(img, grid_size=grid_size, color_mode=color_mode, **kwargs)

    img = img.convert('RGBA')
    img_arr = np.array(img)
    h, w = img_arr.shape[:2]

    # 收集不透明像素
    pixels = img_arr.reshape(-1, 4)
    opaque_mask = pixels[:, 3] >= 128
    opaque_rgb = pixels[opaque_mask][:, :3].astype(np.float32)

    if len(opaque_rgb) == 0:
        return dominant_grid(img, grid_size=grid_size, color_mode=color_mode, **kwargs)

    # 大图采样以加速
    max_pixels = 20000
    if len(opaque_rgb) > max_pixels:
        indices = np.random.choice(len(opaque_rgb), max_pixels, replace=False)
        sample_rgb = opaque_rgb[indices]
    else:
        sample_rgb = opaque_rgb

    # RGB → OKLab
    from colors import _batch_rgb_to_oklab
    sample_oklab = _batch_rgb_to_oklab(sample_rgb)

    # 估计带宽
    try:
        bandwidth = estimate_bandwidth(sample_oklab, quantile=0.2, n_samples=min(500, len(sample_oklab)))
        if bandwidth <= 0:
            bandwidth = 0.1
    except Exception:
        bandwidth = 0.1

    # Mean-Shift 聚类
    ms = MeanShift(bandwidth=bandwidth, bin_seeding=True, n_jobs=1)
    ms.fit(sample_oklab)
    centers_oklab = ms.cluster_centers_.astype(np.float32)

    # 为每个像素分配标签（使用最近中心）
    all_oklab = _batch_rgb_to_oklab(opaque_rgb)
    # 计算所有像素到所有中心的距离
    # 向量化: (N, 1, 3) - (1, K, 3)
    diff = all_oklab[:, np.newaxis, :] - centers_oklab[np.newaxis, :, :]
    dists = np.sum(diff ** 2, axis=2)
    labels = dists.argmin(axis=1)

    # 聚类中心对应的平均 RGB
    center_rgbs = []
    for i in range(len(centers_oklab)):
        cluster_pixels = opaque_rgb[labels == i]
        if len(cluster_pixels) > 0:
            center_rgbs.append(cluster_pixels.mean(axis=0))
        else:
            center_rgbs.append(sample_rgb[0])
    center_rgbs = np.array(center_rgbs, dtype=np.float32)

    perler_centers = find_closest_colors_batch(center_rgbs, mode=color_mode)

    # 为每个像素分配拼豆色号
    label_to_hex = {i: h for i, h in enumerate(perler_centers)}
    perler_labels = np.array([label_to_hex[l] for l in labels])

    # 重建彩色图像
    hex_to_rgb_map = {h: tuple(int(h.lstrip('#')[i:i+2], 16) for i in (0, 2, 4)) for h in set(perler_centers)}
    result_rgb = np.zeros((h * w, 3), dtype=np.uint8)
    result_rgb[opaque_mask] = [hex_to_rgb_map[h] for h in perler_labels]
    result_rgb = result_rgb.reshape(h, w, 3)

    # 缩放到 grid_size
    resized = _resize_to_grid(result_rgb, grid_size)
    flat_rgb = resized.reshape(-1, 3).astype(np.float32)
    flat_hex = find_closest_colors_batch(flat_rgb, mode=color_mode)
    hex_grid = np.array(flat_hex).reshape(grid_size, grid_size)

    unique_hexes = list(set(flat_hex))
    hex_to_label = {h: i for i, h in enumerate(unique_hexes)}
    label_map = np.array([[hex_to_label[hex_grid[y, x]] for x in range(grid_size)] for y in range(grid_size)])
    color_map = {i: h for i, h in enumerate(unique_hexes)}

    grid_data, color_list = _build_grid_data(label_map, color_map, grid_size, mode=color_mode)

    return {
        'grid_size': grid_size,
        'grid_data': grid_data,
        'color_list': color_list
    }


ALGORITHMS = {
    'dominant': dominant_grid,
    'kmeans': kmeans_grid,
    'slic': slic_grid,
    'meanshift': meanshift_grid,
}


def generate_with_algorithm(img, grid_size, algorithm='dominant', **kwargs):
    """
    统一入口，根据 algorithm 参数选择不同实现。

    Parameters
    ----------
    img : PIL.Image
        输入图片（RGBA）
    grid_size : int
        输出网格尺寸
    algorithm : str
        'dominant' | 'kmeans' | 'slic' | 'meanshift'
    color_mode : str
        'full' | '221'
    **kwargs :
        algorithm_params 中的参数，如 kmeans_k, slic_segments, slic_compactness, meanshift_bandwidth
    """
    if algorithm not in ALGORITHMS:
        logger.warning("未知算法 '%s'，降级到 dominant", algorithm)
        algorithm = 'dominant'

    func = ALGORITHMS[algorithm]
    return func(img, grid_size=grid_size, **kwargs)
