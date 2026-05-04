"""普通图片处理流程：缩放 → 颜色匹配。"""
import numpy as np
from PIL import Image

from colors import color_mapping, find_closest_colors_batch
from image_processing import enhance_lines, remove_background, simplify_colors
from utils import logger


def generate_perler_bead_data(
        input_path,
        grid_size=50,
        remove_bg=True,
        color_simplify=0,
        remove_bg_threshold=30,
        enhance_lines_strength=0,
        bg_model=None,
        color_mode='full'
):
    """普通图片模式完整处理流程。"""
    img = Image.open(input_path).convert("RGBA")

    if enhance_lines_strength > 0:
        img = enhance_lines(img, enhance_lines_strength)

    if remove_bg:
        img = remove_background(img, edge_threshold=remove_bg_threshold, model_name=bg_model)

    if color_simplify > 0:
        img = simplify_colors(img, color_simplify)

    img_w, img_h = img.size
    scale = min(grid_size / img_w, grid_size / img_h)
    new_w = max(1, int(img_w * scale))
    new_h = max(1, int(img_h * scale))
    img_small = img.resize((new_w, new_h), Image.NEAREST)

    offset_x = (grid_size - new_w) // 2
    offset_y = (grid_size - new_h) // 2

    # 统一按 RGBA 处理：即使原图是 RGB，alpha 也默认全不透明
    img_arr = np.array(img_small.convert('RGBA'))
    pixels = img_arr.reshape(-1, 4)
    alphas = pixels[:, 3]
    rgb_pixels = pixels[:, :3].astype(np.float32)
    closest_hexes = find_closest_colors_batch(rgb_pixels, mode=color_mode)

    grid_data = []
    color_usage = {}

    for gy in range(grid_size):
        row_data = []
        for gx in range(grid_size):
            pixel_x = gx - offset_x
            pixel_y = gy - offset_y

            if 0 <= pixel_x < new_w and 0 <= pixel_y < new_h:
                idx = pixel_y * new_w + pixel_x
                if alphas[idx] < 128:
                    row_data.append({
                        "color": "transparent",
                        "codes": {}
                    })
                else:
                    closest_hex = closest_hexes[idx]
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

    return {
        "grid_size": grid_size,
        "grid_data": grid_data,
        "color_list": color_list
    }
