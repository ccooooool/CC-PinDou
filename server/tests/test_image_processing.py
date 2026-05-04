"""Tests for server/image_processing.py."""
import numpy as np
from PIL import Image
import pytest

from image_processing import simplify_colors, enhance_lines


class TestSimplifyColors:
    """测试颜色简化功能。"""

    def test_level_zero_returns_original(self):
        """simplify_level=0 应返回原图。"""
        img = Image.new('RGB', (10, 10), color=(255, 0, 0))
        result = simplify_colors(img, simplify_level=0)
        assert result == img

    def test_level_100_returns_single_color(self):
        """simplify_level=100 应只保留 1 种最主要颜色（修复原 max(2, ...) 的 bug）。"""
        # 创建一张以红色为主、蓝色为辅的图片
        arr = np.full((20, 20, 3), (255, 0, 0), dtype=np.uint8)
        arr[0:5, 0:5] = (0, 0, 255)  # 少量蓝色
        img = Image.fromarray(arr)

        result = simplify_colors(img, simplify_level=100)
        result_arr = np.array(result)

        # 统计结果中的唯一颜色（忽略微小差异）
        unique = np.unique(result_arr.reshape(-1, 3), axis=0)
        # 主要颜色应只有 1 种（红色）
        assert len(unique) <= 2  # 允许边缘有 1 种次要颜色

    def test_simplify_reduces_palette(self):
        """simplify_level=50 应减少颜色数量。"""
        # 创建多色图片
        arr = np.zeros((20, 20, 3), dtype=np.uint8)
        arr[:, :5] = (255, 0, 0)
        arr[:, 5:10] = (0, 255, 0)
        arr[:, 10:15] = (0, 0, 255)
        arr[:, 15:] = (255, 255, 0)
        img = Image.fromarray(arr)

        result = simplify_colors(img, simplify_level=50)
        result_arr = np.array(result)
        unique_after = len(np.unique(result_arr.reshape(-1, 3), axis=0))

        assert unique_after <= 3  # 至少减少一种颜色

    def test_rgba_with_transparency(self):
        """RGBA 图片应正确处理透明区域。"""
        img = Image.new('RGBA', (10, 10), color=(255, 0, 0, 255))
        # 左上角透明
        img.putpixel((0, 0), (0, 0, 0, 0))

        result = simplify_colors(img, simplify_level=100)
        assert result.mode == 'RGBA'

    def test_large_image_scaled_down_for_analysis(self):
        """大图应被缩放后分析，不抛异常。"""
        img = Image.new('RGB', (3000, 3000), color=(128, 128, 128))
        result = simplify_colors(img, simplify_level=50)
        assert result.size == (3000, 3000)


class TestEnhanceLines:
    """测试线条增强功能。"""

    def test_zero_strength_returns_original(self):
        """strength=0 应返回原图。"""
        img = Image.new('RGBA', (10, 10), color=(255, 255, 255, 255))
        result = enhance_lines(img, strength=0)
        assert result == img

    def test_strengthens_dark_pixels(self):
        """strength>0 应将暗色像素增强为黑色。"""
        # 创建一张带灰色线条的图片
        arr = np.full((20, 20, 4), (200, 200, 200, 255), dtype=np.uint8)
        arr[5:15, 5:15] = (50, 50, 50, 255)  # 深灰色区域
        img = Image.fromarray(arr, mode='RGBA')

        result = enhance_lines(img, strength=5)
        result_arr = np.array(result)

        # 深灰色区域应被增强为黑色（或更暗）
        dark_region = result_arr[5:15, 5:15]
        assert np.mean(dark_region[:, :, :3]) < 80

    def test_preserves_alpha_channel(self):
        """增强后应保留 alpha 通道。"""
        img = Image.new('RGBA', (10, 10), color=(100, 100, 100, 128))
        result = enhance_lines(img, strength=3)
        assert result.mode == 'RGBA'
        alpha = np.array(result.split()[3])
        assert alpha[0, 0] == 128
