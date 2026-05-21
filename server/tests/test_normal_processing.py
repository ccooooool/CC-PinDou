"""Tests for server/normal_processing.py (BFS merge, adaptive merge, global color limit)."""
import numpy as np
import pytest

from normal_processing import (
    _bfs_merge,
    _adaptive_merge,
    _limit_global_colors,
    _color_dist_rgb,
)


class TestColorDistRgb:
    def test_same_color(self):
        assert _color_dist_rgb('#FF0000', '#FF0000') == 0.0

    def test_transparent(self):
        assert _color_dist_rgb('transparent', '#FF0000') == float('inf')
        assert _color_dist_rgb('#FF0000', 'transparent') == float('inf')

    def test_red_vs_black(self):
        # (255, 0, 0) vs (0, 0, 0) = sqrt(255^2) = 255
        assert abs(_color_dist_rgb('#FF0000', '#000000') - 255.0) < 0.1


class TestBfsMerge:
    def test_merge_similar_colors(self):
        """颜色相近的相邻格子应被合并为同一颜色。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#FF0101', 'codes': {}},
            ],
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#FF0101', 'codes': {}},
            ],
        ]
        merged = _bfs_merge(grid, threshold=50)
        first = merged[0][0]['color']
        assert merged[0][1]['color'] == first
        assert merged[1][0]['color'] == first
        assert merged[1][1]['color'] == first

    def test_no_merge_different_colors(self):
        """颜色差异大的格子不应被合并。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#0000FF', 'codes': {}},
            ],
        ]
        merged = _bfs_merge(grid, threshold=10)
        assert merged[0][0]['color'] == '#FF0000'
        assert merged[0][1]['color'] == '#0000FF'

    def test_skip_transparent(self):
        """透明格子不应参与合并。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': 'transparent', 'codes': {}},
            ],
        ]
        merged = _bfs_merge(grid, threshold=100)
        assert merged[0][0]['color'] == '#FF0000'
        assert merged[0][1]['color'] == 'transparent'

    def test_majority_color_wins(self):
        """区域内最高频色应成为合并后的颜色。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#FF0000', 'codes': {}},
            ],
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#FF0101', 'codes': {}},
            ],
        ]
        merged = _bfs_merge(grid, threshold=50)
        assert merged[0][0]['color'] == '#FF0000'

    def test_empty_grid(self):
        assert _bfs_merge([]) == []


class TestAdaptiveMerge:
    def test_island_merge(self):
        """面积 < min_area 的孤岛应被合并到邻居。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#FF0000', 'codes': {}},
            ],
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#00FF00', 'codes': {}},  # 孤岛（面积=1）
            ],
        ]
        merged = _adaptive_merge(grid, base_threshold=5, min_area=2)
        # 绿色孤岛应被合并到红色邻居
        assert merged[1][1]['color'] == '#FF0000'

    def test_large_area_preserved(self):
        """大面积区域不应被强制合并。"""
        grid = [
            [{'color': '#FF0000', 'codes': {}} for _ in range(4)],
            [{'color': '#FF0000', 'codes': {}} for _ in range(4)],
        ]
        merged = _adaptive_merge(grid, base_threshold=5, min_area=4)
        for row in merged:
            for cell in row:
                assert cell['color'] == '#FF0000'

    def test_transparent_not_merged(self):
        """透明格子不应被当作孤岛处理。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': 'transparent', 'codes': {}},
            ],
        ]
        merged = _adaptive_merge(grid, base_threshold=5, min_area=1)
        assert merged[0][1]['color'] == 'transparent'


class TestLimitGlobalColors:
    def test_limit_reduces_colors(self):
        """全局色号限制应减少色号数量。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#00FF00', 'codes': {}},
            ],
            [
                {'color': '#0000FF', 'codes': {}},
                {'color': '#FFFF00', 'codes': {}},
            ],
        ]
        color_list = [
            {'hex': '#FF0000', 'count': 1, 'codes': {}},
            {'hex': '#00FF00', 'count': 1, 'codes': {}},
            {'hex': '#0000FF', 'count': 1, 'codes': {}},
            {'hex': '#FFFF00', 'count': 1, 'codes': {}},
        ]
        new_grid, new_list = _limit_global_colors(grid, color_list, max_colors=2)
        assert len(new_list) <= 2
        # 所有格子颜色应在保留色号中
        hexes = {c['hex'] for c in new_list}
        for row in new_grid:
            for cell in row:
                assert cell['color'] in hexes

    def test_no_limit_returns_all(self):
        """不限制时应返回所有颜色。"""
        grid = [
            [{'color': '#FF0000', 'codes': {}}],
        ]
        color_list = [{'hex': '#FF0000', 'count': 1, 'codes': {}}]
        new_grid, new_list = _limit_global_colors(grid, color_list, max_colors=None)
        assert len(new_list) == 1
        assert new_grid[0][0]['color'] == '#FF0000'

    def test_limit_higher_than_count(self):
        """max_colors 大于现有色号数时不应删除颜色。"""
        grid = [
            [{'color': '#FF0000', 'codes': {}}],
        ]
        color_list = [{'hex': '#FF0000', 'count': 1, 'codes': {}}]
        new_grid, new_list = _limit_global_colors(grid, color_list, max_colors=10)
        assert len(new_list) == 1

    def test_remap_low_freq_colors(self):
        """低频色应被替换为最近的高频色。"""
        grid = [
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#FF0000', 'codes': {}},
            ],
            [
                {'color': '#FF0000', 'codes': {}},
                {'color': '#00FF00', 'codes': {}},  # 低频
            ],
        ]
        color_list = [
            {'hex': '#FF0000', 'count': 3, 'codes': {}},
            {'hex': '#00FF00', 'count': 1, 'codes': {}},
        ]
        new_grid, new_list = _limit_global_colors(grid, color_list, max_colors=1)
        assert len(new_list) == 1
        # 低频绿色应被替换为红色
        assert new_grid[1][1]['color'] == '#FF0000'
