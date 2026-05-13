"""拼豆图案 PNG/JPG 导出生成。"""
import os
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont, ImageColor

from utils import get_text_size, draw_checkerboard, logger


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


def generate_export_image(grid_data, color_list, brand='MARD', show_code=False,
                          show_legend=True, circle_mode=False, show_mark_lines=False,
                          mark_interval=5, fmt='png'):
    """
    根据网格数据和颜色列表生成拼豆图案。
    返回 BytesIO 对象。
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
