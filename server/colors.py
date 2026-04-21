"""颜色数据库管理与最近色匹配。"""
import json
import os
import sqlite3

import numpy as np

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


# 启动时初始化并加载
init_db()
color_mapping = load_color_mapping()

# 预计算颜色查找数组，用于向量化最近色搜索
HEX_LIST = list(color_mapping.keys())
RGB_ARRAY = np.array([hex_to_rgb(h) for h in HEX_LIST], dtype=np.float32)


def find_closest_color(rgb):
    """对单个 RGB 元组查找最近拼豆色。"""
    rgb_arr = np.array(rgb, dtype=np.float32)
    dists = np.sqrt(np.sum((RGB_ARRAY - rgb_arr) ** 2, axis=1))
    return HEX_LIST[int(dists.argmin())]


def find_closest_colors_batch(pixels):
    """
    批量查找最近拼豆色。
    pixels: ndarray of shape (N, 3) uint8 or float
    """
    p = pixels.astype(np.float32)
    dists = np.sqrt(np.sum((p[:, None, :] - RGB_ARRAY[None, :, :]) ** 2, axis=2))
    return [HEX_LIST[int(i)] for i in dists.argmin(axis=1)]
