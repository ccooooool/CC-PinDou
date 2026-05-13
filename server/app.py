"""Flask 入口（精简版）：仅保留 AI 模型服务与高清导出。"""

import inspect
import os
import tempfile
import uuid
from io import BytesIO

import json
import threading
import time

from flask import Flask, jsonify, request, send_file, send_from_directory, Response, stream_with_context
from flask_cors import CORS

from config import PARAM_LIMITS, MAX_EXPORT_GRID_SIZE, MAX_UPLOAD_SIZE_MB, get_upload_folder
from export_generator import generate_export_image
from image_processing import enhance_lines, remove_background
from models_manager import AVAILABLE_MODELS, DEFAULT_MODEL
from pixel_processing import detect_pixel_size_and_alignment
from utils import (
    logger, parse_form_param, safe_remove, validate_image_file, verify_image_bytes
)

# 静态文件目录：优先使用 frontend/dist（新版前端），fallback 到 web（旧版）
_static_folder = '../frontend/dist'
if not os.path.exists(os.path.join(os.path.dirname(__file__), _static_folder)):
    _static_folder = '../web'

app = Flask(__name__, static_folder=_static_folder, static_url_path='')
CORS(app)
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# 模块启动时缓存 send_file 兼容性检查，避免每次请求都反射
_HAS_DOWNLOAD_NAME = 'download_name' in inspect.signature(send_file).parameters

# SSE 并发连接限制
_sse_connections = 0
_sse_conn_lock = threading.Lock()
MAX_SSE_CONNECTIONS = 16

# 全局进度存储: {task_id: {'progress': int, 'status': str, 'done': bool, 'ts': float}}
progress_store = {}
progress_lock = threading.Lock()
PROGRESS_TTL_SECONDS = 300  # 5 分钟过期清理


def set_progress(task_id, progress, status='', done=False):
    with progress_lock:
        progress_store[task_id] = {
            'progress': progress,
            'status': status,
            'done': done,
            'ts': time.time(),
        }


def clear_progress(task_id):
    with progress_lock:
        progress_store.pop(task_id, None)


def _cleanup_expired_progress():
    """后台线程：定期清理过期的 progress 记录。"""
    while True:
        time.sleep(60)
        now = time.time()
        with progress_lock:
            expired = [
                tid for tid, data in progress_store.items()
                if now - data.get('ts', 0) > PROGRESS_TTL_SECONDS
            ]
            for tid in expired:
                progress_store.pop(tid, None)


# 启动后台清理线程（守护线程）
_cleanup_thread = threading.Thread(target=_cleanup_expired_progress, daemon=True)
_cleanup_thread.start()


# ========================================================================
# 辅助函数
# ========================================================================


def _save_upload(file_storage):
    """保存上传文件到上传目录，返回文件路径。"""
    file_ext = os.path.splitext(file_storage.filename.lower())[1]
    upload_dir = get_upload_folder()
    fd, file_path = tempfile.mkstemp(suffix=file_ext, dir=upload_dir)
    os.close(fd)
    file_storage.save(file_path)
    return file_path


def _cleanup(file_path):
    """安全清理临时文件。"""
    safe_remove(file_path)


def _error_response(message, status_code=500, log_exception=False):
    """统一错误响应，避免将内部异常详情暴露给客户端。"""
    if log_exception:
        logger.exception(message)
    return jsonify({"error": message}), status_code


# ========================================================================
# 路由端点
# ========================================================================


@app.route('/api/remove-bg', methods=['POST'])
def api_remove_bg():
    """
    独立 AI 背景移除接口。
    接收原始图片，返回去背景后的 PNG 图片。
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    is_valid, error_msg, file_ext = validate_image_file(file)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    task_id = request.form.get('task_id')
    file_path = None
    try:
        if task_id:
            set_progress(task_id, 5, '上传图片...')
        file_path = _save_upload(file)
        with open(file_path, 'rb') as f:
            is_valid_img, verify_msg = verify_image_bytes(f.read(65536))
        if not is_valid_img:
            if task_id:
                set_progress(task_id, 0, f'验证失败: {verify_msg}', done=True)
            return jsonify({"error": verify_msg}), 400

        from PIL import Image
        img = Image.open(file_path).convert("RGBA")

        edge_threshold = parse_form_param(
            request.form, 'edge_threshold', 30, int,
            *PARAM_LIMITS['remove_bg_threshold'][:2]
        )
        model_name = request.form.get('model', None)
        if model_name == '':
            model_name = None

        if task_id:
            set_progress(task_id, 30, 'AI 分割中...')
        result = remove_background(
            img, edge_threshold=edge_threshold, model_name=model_name
        )

        if task_id:
            set_progress(task_id, 80, '后处理中...')
        buf = BytesIO()
        result.save(buf, format='PNG')
        buf.seek(0)
        if task_id:
            set_progress(task_id, 100, '完成', done=True)
        return send_file(buf, mimetype='image/png')

    except Exception as e:
        if task_id:
            set_progress(task_id, 0, '处理出错', done=True)
        return _error_response('背景移除处理失败，请稍后重试或更换图片', 500, log_exception=True)
    finally:
        try:
            _cleanup(file_path)
        except Exception:
            pass


@app.route('/api/progress/<task_id>')
def api_progress(task_id):
    """SSE 进度流。限制最大并发连接数，避免 waitress 线程池耗尽。"""
    global _sse_connections
    with _sse_conn_lock:
        if _sse_connections >= MAX_SSE_CONNECTIONS:
            return jsonify({"error": "Too many concurrent progress streams"}), 503
        _sse_connections += 1

    def event_stream():
        try:
            for _ in range(300):  # 最多轮询 60 秒
                with progress_lock:
                    data = progress_store.get(task_id, {'progress': 0, 'status': '等待中...', 'done': False})
                yield f"data: {json.dumps(data)}\n\n"
                if data.get('done'):
                    break
                time.sleep(0.2)
        finally:
            clear_progress(task_id)
            global _sse_connections
            with _sse_conn_lock:
                _sse_connections = max(0, _sse_connections - 1)
    return Response(stream_with_context(event_stream()), mimetype='text/event-stream')


@app.route('/api/enhance-lines', methods=['POST'])
def api_enhance_lines():
    """
    独立线条增强接口。
    接收图片，返回线条增强后的 PNG 图片。
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    is_valid, error_msg, file_ext = validate_image_file(file)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    file_path = None
    try:
        file_path = _save_upload(file)
        with open(file_path, 'rb') as f:
            is_valid_img, verify_msg = verify_image_bytes(f.read(65536))
        if not is_valid_img:
            return jsonify({"error": verify_msg}), 400

        from PIL import Image
        img = Image.open(file_path).convert("RGBA")

        strength = parse_form_param(
            request.form, 'strength', 0, int,
            *PARAM_LIMITS['enhance_lines_strength'][:2]
        )

        result = enhance_lines(img, strength=strength)

        buf = BytesIO()
        result.save(buf, format='PNG')
        buf.seek(0)
        return send_file(buf, mimetype='image/png')

    except Exception as e:
        return _error_response('线条增强处理失败，请稍后重试', 500, log_exception=True)
    finally:
        try:
            _cleanup(file_path)
        except Exception:
            pass


@app.route('/api/detect-pixel', methods=['POST'])
def detect_pixel():
    """
    像素图自动检测接口。
    接收像素风图片，返回自动检测的像素块大小和对齐偏移。
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    is_valid, error_msg, file_ext = validate_image_file(file)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    file_path = None
    try:
        file_path = _save_upload(file)
        with open(file_path, 'rb') as f:
            is_valid_img, verify_msg = verify_image_bytes(f.read(65536))
        if not is_valid_img:
            return jsonify({"error": verify_msg}), 400

        from PIL import Image
        img = Image.open(file_path).convert("RGBA")
        pixel_size, offset_x, offset_y = detect_pixel_size_and_alignment(img)
        return jsonify({
            "success": True,
            "pixel_size": pixel_size,
            "offset_x": offset_x,
            "offset_y": offset_y
        })

    except Exception as e:
        return _error_response('像素检测失败，请确保上传的是有效的像素风图片', 500, log_exception=True)
    finally:
        try:
            _cleanup(file_path)
        except Exception:
            pass


@app.route('/export', methods=['POST'])
def export_image():
    """
    高清图纸导出接口。
    接收 grid_data 和导出参数，返回 PNG/JPG 图片。
    """
    data = request.get_json() or {}
    grid_data = data.get('grid_data', [])
    color_list = data.get('color_list', [])
    brand = data.get('brand', 'MARD')

    # 明确类型转换和边界检查
    show_code = bool(data.get('show_code', False))
    show_legend = bool(data.get('show_legend', True))
    circle_mode = bool(data.get('circle_mode', False))
    show_mark_lines = bool(data.get('show_mark_lines', False))

    try:
        mark_interval = int(data.get('mark_interval', 5))
    except (ValueError, TypeError):
        mark_interval = 5
    if mark_interval < 1:
        mark_interval = 1

    fmt = str(data.get('format', 'png')).lower()
    if fmt not in ('png', 'jpg', 'jpeg'):
        fmt = 'png'

    if not grid_data or not isinstance(grid_data, list):
        return jsonify({"error": "No grid data"}), 400

    # 安全检查：限制 grid_data 维度，防止 DoS
    rows = len(grid_data)
    cols = len(grid_data[0]) if rows > 0 else 0
    if rows > MAX_EXPORT_GRID_SIZE or cols > MAX_EXPORT_GRID_SIZE:
        return jsonify({
            "error": f"导出尺寸过大 ({cols}×{rows})，最大支持 {MAX_EXPORT_GRID_SIZE}×{MAX_EXPORT_GRID_SIZE}"
        }), 400

    try:
        buf = generate_export_image(
            grid_data, color_list, brand=brand, show_code=show_code,
            show_legend=show_legend, circle_mode=circle_mode,
            show_mark_lines=show_mark_lines,
            mark_interval=mark_interval, fmt=fmt
        )

        mime = 'image/jpeg' if fmt.lower() in ('jpg', 'jpeg') else 'image/png'

        if _HAS_DOWNLOAD_NAME:
            response = send_file(
                buf, mimetype=mime, as_attachment=True,
                download_name='拼豆图案.' + fmt.lower()
            )
        else:
            response = send_file(
                buf, mimetype=mime, as_attachment=True,
                attachment_filename='perler_bead.' + fmt.lower()
            )
            response.headers['Content-Disposition'] = (
                "attachment; filename*=UTF-8''%E6%8B%BC%E8%B1%86%E5%9B%BE%E6%A1%88." + fmt.lower()
            )
        return response

    except Exception as e:
        return _error_response('图纸导出失败，请检查参数后重试', 500, log_exception=True)


@app.route('/api/models', methods=['GET'])
def get_models():
    """获取可用的 rembg 模型列表。"""
    return jsonify({
        "models": AVAILABLE_MODELS,
        "default": DEFAULT_MODEL
    })


@app.route('/')
def index():
    """首页。"""
    response = send_from_directory(app.static_folder, 'index.html', mimetype='text/html; charset=utf-8')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route('/<path:path>')
def catch_all(path):
    """SPA catch-all：未匹配路由返回 index.html，由前端路由处理。"""
    # 排除 API 和静态资源路径
    if path.startswith('api/') or path.startswith('export') or path.startswith('static/'):
        return jsonify({"error": "Not found"}), 404
    response = send_from_directory(app.static_folder, 'index.html', mimetype='text/html; charset=utf-8')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response
