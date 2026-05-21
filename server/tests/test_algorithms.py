"""Tests for server/algorithms (alternative quantization algorithms)."""
import numpy as np
import pytest
from PIL import Image

from algorithms import generate_with_algorithm, ALGORITHMS


def _make_test_image(width=100, height=100):
    """创建一个简单的测试图片（红蓝分区）。"""
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    arr[:, :width // 2] = [255, 0, 0, 255]   # 左半红
    arr[:, width // 2:] = [0, 0, 255, 255]   # 右半蓝
    return Image.fromarray(arr, 'RGBA')


def _make_transparent_image(width=100, height=100):
    """创建一个半透明的测试图片。"""
    arr = np.zeros((height, width, 4), dtype=np.uint8)
    arr[:height // 2, :] = [255, 255, 0, 255]   # 上半黄（不透明）
    arr[height // 2:, :] = [0, 255, 0, 0]       # 下半绿（透明）
    return Image.fromarray(arr, 'RGBA')


class TestAlgorithmRegistry:
    def test_all_algorithms_registered(self):
        assert 'dominant' in ALGORITHMS
        assert 'kmeans' in ALGORITHMS
        assert 'slic' in ALGORITHMS
        assert 'meanshift' in ALGORITHMS

    def test_unknown_algorithm_fallback(self):
        img = _make_test_image()
        result = generate_with_algorithm(img, grid_size=8, algorithm='unknown')
        assert 'grid_data' in result
        assert 'color_list' in result


class TestDominantAlgorithm:
    def test_basic_generation(self):
        img = _make_test_image()
        result = generate_with_algorithm(img, grid_size=8, algorithm='dominant')
        assert result['grid_size'] == 8
        assert len(result['grid_data']) == 8
        assert len(result['grid_data'][0]) == 8
        assert len(result['color_list']) > 0

    def test_respects_color_mode(self):
        img = _make_test_image()
        result = generate_with_algorithm(img, grid_size=8, algorithm='dominant', color_mode='221')
        assert len(result['grid_data']) == 8
        # 221 模式下颜色数量应少于 full 模式

    def test_transparent_handling(self):
        img = _make_transparent_image()
        result = generate_with_algorithm(img, grid_size=8, algorithm='dominant')
        # 下半部分应为透明
        has_transparent = any(
            cell['color'] == 'transparent'
            for row in result['grid_data']
            for cell in row
        )
        assert has_transparent

    def test_adaptive_merge_params(self):
        img = _make_test_image()
        result = generate_with_algorithm(
            img, grid_size=8, algorithm='dominant',
            adaptive_merge=True, min_area=2, bfs_threshold=25
        )
        assert len(result['grid_data']) == 8

    def test_max_colors_limit(self):
        img = _make_test_image()
        result = generate_with_algorithm(
            img, grid_size=8, algorithm='dominant', max_colors=1
        )
        assert len(result['color_list']) <= 1


class TestKMeansAlgorithm:
    def test_basic_generation(self):
        img = _make_test_image()
        result = generate_with_algorithm(img, grid_size=8, algorithm='kmeans', kmeans_k=2)
        assert result['grid_size'] == 8
        assert len(result['grid_data']) == 8
        assert len(result['color_list']) > 0

    def test_k_too_large_clamped(self):
        img = _make_test_image(20, 20)
        result = generate_with_algorithm(img, grid_size=8, algorithm='kmeans', kmeans_k=500)
        assert len(result['grid_data']) == 8


class TestSlicAlgorithm:
    def test_basic_generation(self):
        img = _make_test_image()
        result = generate_with_algorithm(
            img, grid_size=8, algorithm='slic',
            slic_segments=50, slic_compactness=10
        )
        assert result['grid_size'] == 8
        assert len(result['grid_data']) == 8
        assert len(result['color_list']) > 0


class TestMeanShiftAlgorithm:
    def test_basic_generation(self):
        img = _make_test_image()
        result = generate_with_algorithm(img, grid_size=8, algorithm='meanshift')
        assert result['grid_size'] == 8
        assert len(result['grid_data']) == 8
        assert len(result['color_list']) > 0

    def test_large_image_sampled(self):
        img = _make_test_image(500, 500)
        result = generate_with_algorithm(img, grid_size=16, algorithm='meanshift')
        assert len(result['grid_data']) == 16
