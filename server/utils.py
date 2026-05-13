"""通用工具函数与健壮性辅助。"""
import logging
import os
from io import BytesIO
from PIL import Image

from config import ALLOWED_EXTENSIONS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


def hex_to_rgb(hex_color):
    """将 #RRGGBB 字符串转为 (R, G, B) 元组。"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def safe_remove(path):
    """静默删除文件，不抛异常。"""
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
            logger.debug("Removed temp file: %s", path)
    except Exception as e:
        logger.warning("Failed to remove %s: %s", path, e)


# MIME type 白名单
ALLOWED_MIME_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'
}


def validate_image_file(file_storage):
    """
    验证上传文件是否为允许的图片格式（扩展名 + MIME type），并尝试用 PIL 校验。
    返回 (is_valid: bool, error_msg: str, file_ext: str)
    """
    if not file_storage or not file_storage.filename:
        return False, "未提供文件", ""

    file_ext = os.path.splitext(file_storage.filename.lower())[1]
    if file_ext not in ALLOWED_EXTENSIONS:
        return False, f"不支持的文件格式: {file_ext}，请上传图片文件", file_ext

    # MIME type 校验
    mime_type = getattr(file_storage, 'content_type', '') or ''
    if mime_type and mime_type.lower() not in ALLOWED_MIME_TYPES:
        return False, f"不支持的文件类型: {mime_type}，请上传图片文件", file_ext

    return True, "", file_ext


def verify_image_bytes(raw_bytes):
    """
    用 PIL 校验字节流是否为有效图片。
    返回 (is_valid: bool, error_msg: str)
    """
    try:
        with Image.open(BytesIO(raw_bytes)) as test_img:
            test_img.verify()
        return True, ""
    except Exception as e:
        return False, f"无法识别图片文件，请确保上传的是有效的图片: {e}"


def clamp_param(value, min_val, max_val):
    """将数值钳制在 [min_val, max_val] 范围内。"""
    return max(min_val, min(max_val, value))


def parse_form_param(form, key, default, cast=int, min_val=None, max_val=None):
    """
    从 request.form 解析参数，支持类型转换和边界钳制。
    """
    try:
        raw = form.get(key, default)
        if raw == '' and default is not None:
            raw = default
        value = cast(raw)
    except (ValueError, TypeError):
        value = default

    if min_val is not None:
        value = max(min_val, value)
    if max_val is not None:
        value = min(max_val, value)
    return value


def get_text_size(draw_ctx, text, font_obj):
    """跨 Pillow 版本兼容的文本尺寸获取。优先使用 textbbox（Pillow 10+ 推荐）。"""
    if hasattr(draw_ctx, 'textbbox'):
        bbox = draw_ctx.textbbox((0, 0), text, font=font_obj)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    elif hasattr(font_obj, 'getbbox'):
        bbox = font_obj.getbbox(text)
        return bbox[2] - bbox[0], bbox[3] - bbox[1]
    else:
        return len(text) * 7, 14


def draw_checkerboard(draw_ctx, x, y, size, cell=4):
    """在画布指定位置绘制棋盘格透明背景。"""
    for dy in range(0, size, cell):
        for dx in range(0, size, cell):
            c = (255, 255, 255) if ((dx // cell + dy // cell) % 2 == 0) else (221, 221, 221)
            draw_ctx.rectangle([x + dx, y + dy, x + dx + cell - 1, y + dy + cell - 1], fill=c)
