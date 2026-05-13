"""图像处理：背景移除、线条增强、颜色简化。"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

from config import DEFAULT_MODEL
from models_manager import get_rembg_session
from rembg import remove
from utils import logger


def remove_background(img, edge_threshold=30, model_name=None):
    """
    使用 rembg 自动移除背景，并对 mask 做连通区域后处理修复主体内部孔洞。

    edge_threshold 控制 alpha matting:
      - 10~50: 不启用 alpha matting（速度快，主体最完整）
      - 51~100: 启用 alpha matting（边缘更精细）
    """
    if img.mode != 'RGBA':
        img = img.convert("RGBA")

    model = model_name if model_name else DEFAULT_MODEL
    session = get_rembg_session(model)

    # 1. rembg 分割
    if edge_threshold > 50:
        intensity = edge_threshold - 50
        fg = max(1, 200 - intensity * 3)
        bg = min(239, 20 + intensity * 2)
        # 确保 fg > bg + 1，避免 alpha_matting 参数冲突
        if fg <= bg:
            fg = bg + 1
        erode = max(1, intensity // 10 + 1)
        result = remove(
            img,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=fg,
            alpha_matting_background_threshold=bg,
            alpha_matting_erode_size=erode
        )
    else:
        result = remove(img, session=session)

    # 2. 连通区域后处理：填充主体内部透明孔洞
    # 对超大图跳过此步骤，避免 ndimage.label 内存溢出
    MAX_HOLE_FILL_SIZE = 4096
    if result.mode == 'RGBA':
        r, g, b, a = result.split()
        w, h = result.size
        if max(w, h) <= MAX_HOLE_FILL_SIZE:
            mask_arr = np.array(a)
            binary = mask_arr > 128
            inverted = ~binary
            labeled, num_features = ndimage.label(inverted)
            if num_features > 0:
                hh, ww = labeled.shape
                border_mask = np.zeros_like(labeled, dtype=bool)
                border_mask[0, :] = True
                border_mask[-1, :] = True
                border_mask[:, 0] = True
                border_mask[:, -1] = True
                for i in range(1, num_features + 1):
                    region = labeled == i
                    if not (region & border_mask).any():
                        mask_arr[region] = 255
                a_fixed = Image.fromarray(mask_arr)
                result = Image.merge('RGBA', (r, g, b, a_fixed))
        else:
            logger.info("Image size %dx%d exceeds MAX_HOLE_FILL_SIZE, skipping hole fill", w, h)

    return result


def enhance_lines(img, strength=0):
    """增强黑色线条连续性。"""
    if strength <= 0:
        return img
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    rgb_img = Image.merge("RGB", (r, g, b))

    gray = rgb_img.convert("L")
    threshold = max(20, 110 - strength * 10)
    mask = gray.point(lambda p: 0 if p < threshold else 255, mode="L")

    iterations = max(1, strength)
    for _ in range(iterations):
        mask = mask.filter(ImageFilter.MinFilter(size=3))

    mask_arr = np.array(mask)
    rgb_arr = np.array(rgb_img)
    rgb_arr[mask_arr == 0] = [0, 0, 0]
    rgb_img = Image.fromarray(rgb_arr)

    r, g, b = rgb_img.split()
    return Image.merge("RGBA", (r, g, b, a))


def simplify_colors(img, simplify_level=0):
    """
    颜色简化：根据 simplify_level 控制保留的颜色数量。
    simplify_level=0 保留所有颜色，100 只保留最主要的颜色。
    透明像素会被排除在颜色分析之外。
    """
    if simplify_level <= 0:
        return img

    has_alpha = img.mode == 'RGBA'
    if has_alpha:
        r, g, b, a = img.split()
        rgb_img = Image.merge('RGB', (r, g, b))
        alpha_arr = np.array(a)
    else:
        rgb_img = img.convert('RGB')
        alpha_arr = None

    # 缩小图像加速颜色分析
    max_analysis_size = 200
    w, h = rgb_img.size
    if max(w, h) > max_analysis_size:
        scale = max_analysis_size / max(w, h)
        analysis_img = rgb_img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    else:
        analysis_img = rgb_img

    # 排除透明像素后再分析主色
    if has_alpha:
        analysis_alpha = np.array(a.resize(analysis_img.size, Image.LANCZOS))
        analysis_arr = np.array(analysis_img)
        opaque_pixels = analysis_arr[analysis_alpha >= 128]
        if opaque_pixels.size == 0:
            return img
        unique, counts = np.unique(opaque_pixels.reshape(-1, 3), axis=0, return_counts=True)
        colors = list(zip(counts.tolist(), [tuple(c) for c in unique]))
    else:
        colors = analysis_img.getcolors(maxcolors=200000)

    if not colors:
        return img

    color_freq = sorted(colors, key=lambda x: x[0], reverse=True)
    total_colors = len(color_freq)

    keep_ratio = (100 - simplify_level) / 100.0
    keep_count = max(1, int(total_colors * keep_ratio))
    MAX_PALETTE_SIZE = 256
    keep_count = min(keep_count, MAX_PALETTE_SIZE, total_colors)

    main_colors = [color for count, color in color_freq[:keep_count]]

    if keep_count >= total_colors:
        return img

    main_arr = np.array(main_colors, dtype=np.float32)

    # 在原图上应用颜色替换
    img_arr = np.array(rgb_img)
    h, w, _ = img_arr.shape
    pixels = img_arr.reshape(-1, 3)

    # 整数编码 + np.isin 避免大量 Python tuple
    pixels_int = pixels[:, 0].astype(np.uint32) * 65536 + pixels[:, 1].astype(np.uint32) * 256 + pixels[:, 2]
    main_ints = np.array([int(c[0]) * 65536 + int(c[1]) * 256 + int(c[2]) for c in main_colors], dtype=np.uint32)
    need_replace = ~np.isin(pixels_int, main_ints)

    if has_alpha:
        need_replace &= (alpha_arr.reshape(-1) >= 128)

    if not need_replace.any():
        return img

    need_pixels = pixels[need_replace].astype(np.float32)
    total_need = need_pixels.shape[0]
    batch_size = 50000
    replaced = np.empty_like(need_pixels)

    for start in range(0, total_need, batch_size):
        end = min(start + batch_size, total_need)
        batch = need_pixels[start:end]
        dists = np.sqrt(np.sum((batch[:, None, :] - main_arr[None, :, :]) ** 2, axis=2))
        replaced[start:end] = main_arr[dists.argmin(axis=1)]

    pixels[need_replace] = replaced.astype(np.uint8)
    img_arr = pixels.reshape(h, w, 3)
    rgb_img = Image.fromarray(img_arr)

    if has_alpha:
        r, g, b = rgb_img.split()
        return Image.merge('RGBA', (r, g, b, a))
    return rgb_img
