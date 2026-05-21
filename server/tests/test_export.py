"""Tests for server/export_generator (rendering with AA and dithering)."""
import io
import pytest
from PIL import Image

from export_generator import (
    generate_export_image,
    _find_second_best_color,
    _apply_aa,
    _apply_dither,
)


def _make_grid(rows=4, cols=4):
    """创建一个简单的测试网格（红蓝棋盘）。"""
    grid = []
    for y in range(rows):
        row = []
        for x in range(cols):
            color = '#FF0000' if (x + y) % 2 == 0 else '#0000FF'
            row.append({'color': color, 'codes': {}})
        grid.append(row)
    return grid


def _make_color_list():
    return [
        {'hex': '#FF0000', 'count': 8, 'codes': {'MARD': 'A01'}},
        {'hex': '#0000FF', 'count': 8, 'codes': {'MARD': 'A03'}},
    ]


class TestSecondBestColor:
    def test_excludes_given_color(self):
        result = _find_second_best_color((255, 0, 0), '#FF0000')
        assert result != '#FF0000'

    def test_returns_valid_hex(self):
        result = _find_second_best_color((128, 128, 128), '#FFFFFF')
        assert result.startswith('#')
        assert len(result) == 7


class TestGenerateExportImage:
    def test_standard_render(self):
        grid = _make_grid()
        colors = _make_color_list()
        buf = generate_export_image(grid, colors, fmt='png')
        assert isinstance(buf, io.BytesIO)
        assert buf.tell() == 0
        img = Image.open(buf)
        assert img.format == 'PNG'
        assert img.size[0] > 0 and img.size[1] > 0

    def test_jpg_format(self):
        grid = _make_grid()
        colors = _make_color_list()
        buf = generate_export_image(grid, colors, fmt='jpg')
        img = Image.open(buf)
        assert img.format == 'JPEG'

    def test_circle_mode(self):
        grid = _make_grid()
        colors = _make_color_list()
        buf = generate_export_image(grid, colors, circle_mode=True)
        img = Image.open(buf)
        assert img.size[0] > 0

    def test_with_aa_enabled(self):
        grid = _make_grid()
        colors = _make_color_list()
        buf = generate_export_image(grid, colors, aa_enabled=True)
        img = Image.open(buf)
        assert img.size[0] > 0

    def test_with_dither_enabled(self):
        grid = _make_grid()
        colors = _make_color_list()
        buf = generate_export_image(grid, colors, dither_enabled=True, dither_strength=0.5)
        img = Image.open(buf)
        assert img.size[0] > 0

    def test_artistic_mode(self):
        grid = _make_grid()
        colors = _make_color_list()
        buf = generate_export_image(
            grid, colors, aa_enabled=True, dither_enabled=True, dither_strength=0.8
        )
        img = Image.open(buf)
        assert img.size[0] > 0

    def test_empty_grid_raises(self):
        with pytest.raises(ValueError):
            generate_export_image([], [])

    def test_show_code(self):
        grid = _make_grid(2, 2)
        colors = _make_color_list()
        buf = generate_export_image(grid, colors, show_code=True, brand='MARD')
        assert isinstance(buf, io.BytesIO)

    def test_no_legend(self):
        grid = _make_grid()
        colors = _make_color_list()
        buf = generate_export_image(grid, colors, show_legend=False)
        img = Image.open(buf)
        assert img.size[0] > 0


class TestApplyAa:
    def test_aa_on_checkerboard(self):
        grid = _make_grid(4, 4)
        from PIL import Image
        img = Image.new('RGB', (200, 200), 'white')
        result = _apply_aa(img, grid, bead_size=28, margin=45)
        assert result is not None

    def test_aa_empty_grid(self):
        from PIL import Image
        img = Image.new('RGB', (200, 200), 'white')
        result = _apply_aa(img, [], bead_size=28, margin=45)
        assert result == img


class TestApplyDither:
    def test_dither_on_checkerboard(self):
        grid = _make_grid(4, 4)
        from PIL import Image
        img = Image.new('RGB', (200, 200), 'white')
        result = _apply_dither(img, grid, bead_size=28, margin=45, strength=0.5)
        assert result is not None

    def test_dither_empty_grid(self):
        from PIL import Image
        img = Image.new('RGB', (200, 200), 'white')
        result = _apply_dither(img, [], bead_size=28, margin=45)
        assert result == img

    def test_dither_zero_strength(self):
        grid = _make_grid(4, 4)
        from PIL import Image
        img = Image.new('RGB', (200, 200), 'white')
        result = _apply_dither(img, grid, bead_size=28, margin=45, strength=0.0)
        assert result is not None
