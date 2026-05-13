"""全局配置常量。"""

import os

# Flask 上传目录

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

_upload_folder_initialized = False


def get_upload_folder():
    """惰性初始化上传目录，首次调用时创建。"""
    global _upload_folder_initialized
    if not _upload_folder_initialized:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        _upload_folder_initialized = True
    return UPLOAD_FOLDER

# 数据库与 JSON 路径

DB_PATH = os.path.join(BASE_DIR, '..', 'data', 'colors.db')

JSON_PATH = os.path.join(BASE_DIR, '..', 'data', 'colorSystemMapping.json')

# 文件上传白名单

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}

# rembg 模型目录（优先使用项目本地 models/ 目录，fallback 到用户目录）

U2NET_DIR = os.path.join(BASE_DIR, '..', 'models')

# 模型元数据

MODEL_INFO = {

    'u2net': {

        'name': 'u2net',

        'label': 'U2-Net 通用',

        'desc': '通用场景分割模型，适合大多数图片',

        'size_mb': '~168MB',

        'tags': ['通用', '推荐']

    },

    'u2net_human_seg': {

        'name': 'u2net_human_seg',

        'label': 'U2-Net 人像',

        'desc': '针对人像优化，适合人物照片',

        'size_mb': '~168MB',

        'tags': ['人像']

    },

    'isnet-anime': {

        'name': 'isnet-anime',

        'label': 'ISNet 动漫',

        'desc': '针对动漫、卡通、插画风格优化',

        'size_mb': '~168MB',

        'tags': ['动漫', '卡通', '插画']

    },

    'silueta': {

        'name': 'silueta',

        'label': 'Silueta 轻量',

        'desc': '轻量级模型，速度快，适合简单背景',

        'size_mb': '~42MB',

        'tags': ['轻量', '快速']

    },

    'isnet-general-use': {

        'name': 'isnet-general-use',

        'label': 'ISNet 通用',

        'desc': '高精度通用分割模型',

        'size_mb': '~168MB',

        'tags': ['通用', '高精度']

    },

    'u2netp': {

        'name': 'u2netp',

        'label': 'U2-Netp 便携',

        'desc': 'U2-Net 轻量版，速度更快',

        'size_mb': '~4MB',

        'tags': ['轻量', '快速']

    }

}

DEFAULT_MODEL = 'u2net'

# 导出安全限制

MAX_EXPORT_GRID_SIZE = 200  # grid_data 最大行列数
MAX_UPLOAD_SIZE_MB = 20     # 上传文件大小上限

# 处理参数边界

PARAM_LIMITS = {

    'grid_size': (8, 128, 52),

    'color_simplify': (0, 100, 0),

    'remove_bg_threshold': (10, 100, 30),

    'enhance_lines_strength': (0, 10, 0),

    'pixel_size': (1, 128, 16),

    'offset_x': (0, 500, 0),

    'offset_y': (0, 500, 0),

    'bg_threshold': (0, 100, 80),

    'color_quantize': (0, 100, 0),

}
