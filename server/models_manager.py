"""rembg 模型扫描与懒加载管理。"""
import os

from rembg import new_session

from config import U2NET_DIR, MODEL_INFO, DEFAULT_MODEL
from utils import logger


def scan_available_models():
    """扫描 ~/.u2net 目录，返回实际存在的模型列表。"""
    available = []
    if not os.path.exists(U2NET_DIR):
        return available
    for key, info in MODEL_INFO.items():
        model_file = os.path.join(U2NET_DIR, f"{key}.onnx")
        if os.path.exists(model_file):
            available.append(info)
    return available


AVAILABLE_MODELS = scan_available_models()

# 懒加载 session 字典
_rembg_sessions = {}


def get_rembg_session(model_name):
    """获取或创建指定模型的 rembg session。"""
    if model_name not in _rembg_sessions:
        logger.info("Loading rembg session: %s", model_name)
        _rembg_sessions[model_name] = new_session(model_name)
    return _rembg_sessions[model_name]
