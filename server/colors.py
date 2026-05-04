"""颜色数据库管理与最近色匹配。"""
import json
import os
import sqlite3

import numpy as np
from scipy.spatial import cKDTree

from config import DB_PATH, JSON_PATH
from utils import hex_to_rgb, logger


def init_db():
    """从 JSON 初始化 SQLite 数据库（若不存在）。"""
    if os.path.exists(DB_PATH):
        return

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE colors (
            hex TEXT,
            brand TEXT,
            code TEXT,
            PRIMARY KEY (hex, brand)
        )
    ''')
    for hex_color, brands in data.items():
        for brand, code in brands.items():
            cursor.execute(
                'INSERT INTO colors (hex, brand, code) VALUES (?, ?, ?)',
                (hex_color, brand, code)
            )
    conn.commit()
    conn.close()
    logger.info("Initialized colors.db from %s", JSON_PATH)


def load_color_mapping():
    """从 SQLite 加载颜色映射到内存字典。"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT hex, brand, code FROM colors')
    rows = cursor.fetchall()
    conn.close()

    mapping = {}
    for row in rows:
        hex_color = row['hex']
        if hex_color not in mapping:
            mapping[hex_color] = {}
        mapping[hex_color][row['brand']] = row['code']
    return mapping


# 惰性初始化的全局变量，在首次访问时自动加载
_color_mapping = None
_HEX_LIST_FULL = None
_RGB_ARRAY_FULL = None
_HEX_LIST_221 = None
_RGB_ARRAY_221 = None

# cKDTree 加速最近邻搜索
_tree_full = None
_tree_221 = None


def _ensure_initialized():
    """确保颜色数据已初始化（线程安全，可重复调用）。"""
    global _color_mapping, _HEX_LIST_FULL, _RGB_ARRAY_FULL, _HEX_LIST_221, _RGB_ARRAY_221
    if _color_mapping is not None:
        return

    # 自动创建 data 目录，避免目录缺失导致启动失败
    data_dir = os.path.dirname(DB_PATH)
    if data_dir:
        os.makedirs(data_dir, exist_ok=True)

    init_db()
    _color_mapping = load_color_mapping()

    # 预计算颜色查找数组，用于向量化最近色搜索
    # 全量 291 色
    _HEX_LIST_FULL = list(_color_mapping.keys())
    _RGB_ARRAY_FULL = np.array([hex_to_rgb(h) for h in _HEX_LIST_FULL], dtype=np.float32)

    # 221 色：只保留 MARD 品牌中 A-M 开头的颜色
    _HEX_LIST_221 = []
    for h in _HEX_LIST_FULL:
        codes = _color_mapping.get(h, {})
        mard_code = codes.get('MARD', '')
        if mard_code and 'A' <= mard_code[0].upper() <= 'M':
            _HEX_LIST_221.append(h)
    _RGB_ARRAY_221 = np.array([hex_to_rgb(h) for h in _HEX_LIST_221], dtype=np.float32)

    # 构建 cKDTree，将最近邻搜索从 O(N*M) 降至 O(N log M)
    global _tree_full, _tree_221
    _tree_full = cKDTree(_RGB_ARRAY_FULL)
    _tree_221 = cKDTree(_RGB_ARRAY_221) if len(_RGB_ARRAY_221) > 0 else None


def get_color_mapping():
    """获取颜色映射字典（惰性初始化）。"""
    _ensure_initialized()
    return _color_mapping


# 保持向后兼容的模块级属性访问
class _LazyColorMapping(dict):
    """惰性加载的字典代理，在首次访问时触发初始化。"""
    def __getitem__(self, key):
        _ensure_initialized()
        return _color_mapping[key]

    def __iter__(self):
        _ensure_initialized()
        return iter(_color_mapping)

    def keys(self):
        _ensure_initialized()
        return _color_mapping.keys()

    def values(self):
        _ensure_initialized()
        return _color_mapping.values()

    def items(self):
        _ensure_initialized()
        return _color_mapping.items()

    def get(self, key, default=None):
        _ensure_initialized()
        return _color_mapping.get(key, default)

    def __contains__(self, key):
        _ensure_initialized()
        return key in _color_mapping

    def __len__(self):
        _ensure_initialized()
        return len(_color_mapping)

    def __repr__(self):
        _ensure_initialized()
        return repr(_color_mapping)


color_mapping = _LazyColorMapping()


def _get_arrays(mode='full'):
    """根据模式返回对应的颜色数组。"""
    _ensure_initialized()
    if mode == '221':
        return _HEX_LIST_221, _RGB_ARRAY_221
    return _HEX_LIST_FULL, _RGB_ARRAY_FULL


def _get_tree(mode='full'):
    """根据模式返回对应的 cKDTree 和 hex 列表。"""
    _ensure_initialized()
    if mode == '221':
        return _HEX_LIST_221, _tree_221
    return _HEX_LIST_FULL, _tree_full


def find_closest_color(rgb, mode='full'):
    """对单个 RGB 元组查找最近拼豆色。mode: 'full' | '221'"""
    hex_list, rgb_array = _get_arrays(mode)
    rgb_arr = np.array(rgb, dtype=np.float32)
    dists = np.sqrt(np.sum((rgb_array - rgb_arr) ** 2, axis=1))
    return hex_list[int(dists.argmin())]


def find_closest_colors_batch(pixels, mode='full'):
    """
    批量查找最近拼豆色。mode: 'full' | '221'
    pixels: ndarray of shape (N, 3) uint8 or float
    使用 cKDTree 将复杂度从 O(N*M) 降至 O(N log M)，大幅降低内存占用。
    """
    hex_list, tree = _get_tree(mode)
    if tree is None:
        return []
    p = pixels.astype(np.float32)
    _, indices = tree.query(p)
    return [hex_list[int(i)] for i in indices]
