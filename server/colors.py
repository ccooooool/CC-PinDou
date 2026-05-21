"""颜色数据库管理与最近色匹配。"""
import json
import os
import sqlite3
import threading

import numpy as np
from scipy.spatial import cKDTree

from config import DB_PATH, JSON_PATH
from utils import hex_to_rgb, logger

# 线程锁：保护数据库初始化和全局变量加载
_init_lock = threading.Lock()


def _rgb_to_oklab(r, g, b):
    """sRGB → OKLab 感知均匀颜色空间（前端 PerlerEngine.ts 的 Python 移植）。
    参考: https://bottosson.github.io/posts/oklab/
    """
    # 1. sRGB → linear RGB
    lr = r / 3294.6 if r <= 10 else ((r / 255 + 0.055) / 1.055) ** 2.4
    lg = g / 3294.6 if g <= 10 else ((g / 255 + 0.055) / 1.055) ** 2.4
    lb = b / 3294.6 if b <= 10 else ((b / 255 + 0.055) / 1.055) ** 2.4

    # 2. linear RGB → XYZ (D65)
    x = 0.8189330101 * lr + 0.3618667424 * lg - 0.1288597137 * lb
    y = 0.0329845436 * lr + 0.9293118715 * lg + 0.0361456387 * lb
    z = 0.0482003018 * lr + 0.2643662691 * lg + 0.6338517070 * lb

    # 3. XYZ → LMS → OKLab
    l_ = np.cbrt(x)
    m_ = np.cbrt(y)
    s_ = np.cbrt(z)

    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, A, B


def init_db():
    """从 JSON 初始化 SQLite 数据库（若不存在）。线程安全。"""
    if os.path.exists(DB_PATH):
        return

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS colors (
            hex TEXT,
            brand TEXT,
            code TEXT,
            PRIMARY KEY (hex, brand)
        )
    ''')
    for hex_color, brands in data.items():
        for brand, code in brands.items():
            cursor.execute(
                'INSERT OR IGNORE INTO colors (hex, brand, code) VALUES (?, ?, ?)',
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

# OKLab 预计算数组（与前端对齐）
_OKLAB_ARRAY_FULL = None
_OKLAB_ARRAY_221 = None

# cKDTree 加速最近邻搜索（OKLab 空间）
_tree_full = None
_tree_221 = None


def _ensure_initialized():
    """确保颜色数据已初始化（线程安全，可重复调用）。"""
    global _color_mapping, _HEX_LIST_FULL, _RGB_ARRAY_FULL, _HEX_LIST_221, _RGB_ARRAY_221
    if _color_mapping is not None:
        return

    with _init_lock:
        # 双重检查，避免锁竞争后重复初始化
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

    # 预计算 OKLab 数组（与前端 OKLab 颜色匹配对齐）
    global _OKLAB_ARRAY_FULL, _OKLAB_ARRAY_221
    _OKLAB_ARRAY_FULL = np.array(
        [_rgb_to_oklab(*rgb) for rgb in _RGB_ARRAY_FULL], dtype=np.float32
    )
    _OKLAB_ARRAY_221 = np.array(
        [_rgb_to_oklab(*rgb) for rgb in _RGB_ARRAY_221], dtype=np.float32
    ) if len(_RGB_ARRAY_221) > 0 else None

    # 构建 cKDTree（OKLab 空间），将最近邻搜索从 O(N*M) 降至 O(N log M)
    global _tree_full, _tree_221
    _tree_full = cKDTree(_OKLAB_ARRAY_FULL)
    _tree_221 = cKDTree(_OKLAB_ARRAY_221) if _OKLAB_ARRAY_221 is not None and len(_OKLAB_ARRAY_221) > 0 else None


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
    """根据模式返回对应的颜色数组（RGB）。"""
    _ensure_initialized()
    if mode == '221':
        return _HEX_LIST_221, _RGB_ARRAY_221
    return _HEX_LIST_FULL, _RGB_ARRAY_FULL


def _get_tree(mode='full'):
    """根据模式返回对应的 OKLab cKDTree 和 hex 列表。"""
    _ensure_initialized()
    if mode == '221':
        return _HEX_LIST_221, _tree_221
    return _HEX_LIST_FULL, _tree_full


def _batch_rgb_to_oklab(pixels):
    """批量 RGB → OKLab。pixels: ndarray of shape (N, 3)。"""
    p = pixels.astype(np.float32)
    # sRGB → linear RGB (向量化)
    lr = np.where(p[:, 0] <= 10, p[:, 0] / 3294.6,
                  ((p[:, 0] / 255 + 0.055) / 1.055) ** 2.4)
    lg = np.where(p[:, 1] <= 10, p[:, 1] / 3294.6,
                  ((p[:, 1] / 255 + 0.055) / 1.055) ** 2.4)
    lb = np.where(p[:, 2] <= 10, p[:, 2] / 3294.6,
                  ((p[:, 2] / 255 + 0.055) / 1.055) ** 2.4)

    # linear RGB → XYZ (D65)
    x = 0.8189330101 * lr + 0.3618667424 * lg - 0.1288597137 * lb
    y = 0.0329845436 * lr + 0.9293118715 * lg + 0.0361456387 * lb
    z = 0.0482003018 * lr + 0.2643662691 * lg + 0.6338517070 * lb

    # XYZ → LMS → OKLab
    l_ = np.cbrt(x)
    m_ = np.cbrt(y)
    s_ = np.cbrt(z)

    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return np.column_stack([L, A, B])


def find_closest_color(rgb, mode='full'):
    """对单个 RGB 元组查找最近拼豆色（OKLab 感知均匀空间）。mode: 'full' | '221'"""
    results = find_closest_colors_batch(np.array([rgb], dtype=np.float32), mode=mode)
    return results[0] if results else "#FFFFFF"


def find_closest_colors_batch(pixels, mode='full'):
    """
    批量查找最近拼豆色（OKLab 感知均匀空间）。mode: 'full' | '221'
    pixels: ndarray of shape (N, 3) uint8 or float
    使用 OKLab cKDTree 将复杂度从 O(N*M) 降至 O(N log M)。
    """
    hex_list, tree = _get_tree(mode)
    if tree is None:
        return []
    oklab_pixels = _batch_rgb_to_oklab(pixels)
    _, indices = tree.query(oklab_pixels)
    return [hex_list[int(i)] for i in indices]
