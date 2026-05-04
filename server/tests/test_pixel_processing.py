"""Tests for server/pixel_processing.py."""
import os
import tempfile

import numpy as np
from PIL import Image
import pytest

from pixel_processing import generate_pixel_data


class TestGeneratePixelData:
    """测试像素图生成流程。"""

    def _create_pixel_art(self, pixel_size=8, colors=None):
        """Helper: 创建简单的像素风图片。"""
        if colors is None:
            colors = [(255, 0, 0, 255), (0, 255, 0, 255), (0, 0, 255, 255)]

        # 创建 3x3 的像素块，每个块 pixel_size x pixel_size
        w, h = pixel_size * 3, pixel_size * 3
        arr = np.zeros((h, w, 4), dtype=np.uint8)
        for gy in range(3):
            for gx in range(3):
                color = colors[(gy * 3 + gx) % len(colors)]
                y0, x0 = gy * pixel_size, gx * pixel_size
                arr[y0:y0 + pixel_size, x0:x0 + pixel_size] = color

        img = Image.fromarray(arr, mode='RGBA')
        fd, path = tempfile.mkstemp(suffix='.png')
        os.close(fd)
        img.save(path)
        return path

    def test_basic_generation(self):
        """基本生成流程应返回有效的 grid_data。"""
        path = self._create_pixel_art(pixel_size=8)
        try:
            result = generate_pixel_data(
                path, pixel_size=8, offset_x=0, offset_y=0,
                sampling_mode='center'
            )
            assert 'grid_data' in result
            assert 'color_list' in result
            assert len(result['grid_data']) > 0
            assert len(result['color_list']) > 0
        finally:
            os.unlink(path)

    def test_color_quantize_deterministic(self):
        """颜色量化应产生确定性结果（修复原 set() 无序切片的 bug）。"""
        # 创建一张包含多种颜色的像素图
        colors = [
            (255, 0, 0, 255),    # 红色（最多）
            (255, 0, 0, 255),
            (255, 0, 0, 255),
            (0, 255, 0, 255),    # 绿色
            (0, 0, 255, 255),    # 蓝色
        ]
        path = self._create_pixel_art(pixel_size=8, colors=colors)
        try:
            # 多次运行，结果应一致
            results = []
            for _ in range(5):
                result = generate_pixel_data(
                    path, pixel_size=8, offset_x=0, offset_y=0,
                    sampling_mode='center', color_quantize=50
                )
                hex_set = {c['hex'] for c in result['color_list']}
                results.append(hex_set)

            # 所有运行结果应相同
            for r in results[1:]:
                assert r == results[0]
        finally:
            os.unlink(path)

    def test_color_quantize_reduces_colors(self):
        """color_quantize>0 应减少最终颜色数量。"""
        colors = [
            (255, 0, 0, 255),
            (0, 255, 0, 255),
            (0, 0, 255, 255),
            (255, 255, 0, 255),
        ]
        path = self._create_pixel_art(pixel_size=8, colors=colors)
        try:
            result_no_quant = generate_pixel_data(
                path, pixel_size=8, offset_x=0, offset_y=0,
                sampling_mode='center', color_quantize=0
            )
            result_quant = generate_pixel_data(
                path, pixel_size=8, offset_x=0, offset_y=0,
                sampling_mode='center', color_quantize=80
            )

            assert len(result_quant['color_list']) <= len(result_no_quant['color_list'])
        finally:
            os.unlink(path)

    def test_auto_detection(self):
        """pixel_size=0 应触发自动检测。"""
        path = self._create_pixel_art(pixel_size=16)
        try:
            result = generate_pixel_data(
                path, pixel_size=0, offset_x=-1, offset_y=-1,
                sampling_mode='center'
            )
            assert 'detected' in result
            assert result['detected']['pixel_size'] > 0
        finally:
            os.unlink(path)

    def test_remove_bg(self):
        """remove_bg=True 应去除边框主色。"""
        # 创建带红色边框的图
        w, h = 32, 32
        arr = np.full((h, w, 4), (0, 255, 0, 255), dtype=np.uint8)  # 内部绿色
        arr[0:4, :] = (255, 0, 0, 255)  # 顶部红色边框
        arr[-4:, :] = (255, 0, 0, 255)  # 底部红色边框
        arr[:, 0:4] = (255, 0, 0, 255)  # 左边红色边框
        arr[:, -4:] = (255, 0, 0, 255)  # 右边红色边框

        img = Image.fromarray(arr, mode='RGBA')
        fd, path = tempfile.mkstemp(suffix='.png')
        os.close(fd)
        img.save(path)

        try:
            result = generate_pixel_data(
                path, pixel_size=8, offset_x=0, offset_y=0,
                sampling_mode='center', remove_bg=True, bg_threshold=50
            )
            # 边框红色应被移除（变为 transparent）
            red_present = any(
                c['hex'].upper() == '#FF0000'
                for c in result['color_list']
            )
            assert not red_present
        finally:
            os.unlink(path)
