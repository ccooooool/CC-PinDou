"""Tests for server/colors.py (pure functions only, no DB)."""
import numpy as np
import pytest

from colors import find_closest_color, find_closest_colors_batch


class TestFindClosestColor:
    def test_exact_match(self):
        """当传入的颜色恰好在拼豆色板中时，应返回自身。"""
        # #FFFFFF (white) 在色板中
        result = find_closest_color((255, 255, 255))
        assert result == "#FFFFFF"

    def test_returns_valid_hex(self):
        """应始终返回有效的 #RRGGBB 格式字符串。"""
        result = find_closest_color((128, 128, 128))
        assert result.startswith("#")
        assert len(result) == 7
        # 验证是有效的 hex
        int(result[1:], 16)

    def test_black(self):
        result = find_closest_color((0, 0, 0))
        assert result == "#000000"

    def test_mode_221(self):
        """221 模式下应只返回 A-M 开头的 MARD 颜色。"""
        result = find_closest_color((255, 255, 255), mode="221")
        assert result.startswith("#")


class TestFindClosestColorsBatch:
    def test_batch_matches_individual(self):
        """批量查找的结果应与逐个查找一致。"""
        pixels = np.array([
            [255, 255, 255],
            [0, 0, 0],
            [255, 0, 0],
        ], dtype=np.uint8)

        batch_results = find_closest_colors_batch(pixels)
        individual_results = [find_closest_color(tuple(p)) for p in pixels]

        assert batch_results == individual_results

    def test_empty_array(self):
        """空数组应返回空列表。"""
        pixels = np.array([], dtype=np.uint8).reshape(0, 3)
        result = find_closest_colors_batch(pixels)
        assert result == []

    def test_single_pixel(self):
        """单个像素的批量查找。"""
        pixels = np.array([[255, 255, 255]], dtype=np.uint8)
        result = find_closest_colors_batch(pixels)
        assert result == ["#FFFFFF"]
