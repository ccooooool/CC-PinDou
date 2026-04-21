"""拼豆图案 PNG 导出生成。"""
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont, ImageColor

from utils import get_text_size, draw_checkerboard, logger


def generate_export_image(grid_data, color_list, brand='MARD', show_code=False):
    """
    根据网格数据和颜色列表生成拼豆图案 PNG。
    返回 BytesIO 对象。
    """
    if not grid_data:
        raise ValueError("grid_data is empty")

    bead_size = 20
    margin = 35
    rows = len(grid_data)
    cols = len(grid_data[0]) if rows > 0 else 0

    canvas_width = cols * bead_size + 2 * margin
    canvas_height = rows * bead_size + 2 * margin

    img = Image.new('RGB', (canvas_width, canvas_height), 'white')
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("arial.ttf", 14)
        code_font = ImageFont.truetype("arial.ttf", 10)
        legend_font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
        code_font = ImageFont.load_default()
        legend_font = ImageFont.load_default()

    # 绘制坐标轴数字
    for i in range(cols):
        text = str(i + 1)
        text_w, text_h = get_text_size(draw, text, font)
        cx = margin + i * bead_size + bead_size / 2
        cy = margin / 2
        draw.text((cx - text_w / 2, cy - text_h / 2), text, fill='#333', font=font)
    for i in range(rows):
        text = str(i + 1)
        text_w, text_h = get_text_size(draw, text, font)
        cy = margin + i * bead_size + bead_size / 2
        draw.text((margin / 2 - text_w / 2, cy - text_h / 2), text, fill='#333', font=font)

    # 绘制格子
    for y in range(rows):
        for x in range(cols):
            cell = grid_data[y][x]
            px = margin + x * bead_size
            py = margin + y * bead_size
            color = cell.get('color', '#FFFFFF')

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
        draw.line(
            [(margin, margin + i * bead_size), (margin + cols * bead_size, margin + i * bead_size)],
            fill='#999', width=1
        )
    for i in range(cols + 1):
        draw.line(
            [(margin + i * bead_size, margin), (margin + i * bead_size, margin + rows * bead_size)],
            fill='#999', width=1
        )

    # 绘制图例
    if color_list:
        items_per_row = max(1, (canvas_width - 20) // 100)
        rows = (len(color_list) + items_per_row - 1) // items_per_row
        legend_height = max(60, rows * 30 + 20)

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
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf
