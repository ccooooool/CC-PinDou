"""Flask 入口：仅负责应用初始化和路由注册。"""

import inspect

import os

import uuid

from flask import Flask, jsonify, request, send_file, send_from_directory

from flask_cors import CORS

from config import PARAM_LIMITS, UPLOAD_FOLDER

from colors import color_mapping

from export_generator import generate_export_image

from image_processing import enhance_lines, remove_background, simplify_colors

from models_manager import AVAILABLE_MODELS, DEFAULT_MODEL

from normal_processing import generate_perler_bead_data

from pixel_processing import detect_pixel_size_and_alignment, generate_pixel_data

from utils import (

    logger, parse_form_param, safe_remove, validate_image_file, verify_image_bytes

)

app = Flask(__name__, static_folder='../web', static_url_path='')

CORS(app)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# ========================================================================

# 辅助函数

# ========================================================================


def _save_upload(file_storage):
    """保存上传文件到临时目录，返回文件路径。"""

    file_ext = os.path.splitext(file_storage.filename.lower())[1]

    safe_name = f"{uuid.uuid4().hex}{file_ext}"

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_name)

    file_storage.save(file_path)

    return file_path


def _cleanup(file_path):
    """安全清理临时文件。"""

    safe_remove(file_path)


# ========================================================================

# 路由端点

# ========================================================================


@app.route('/upload', methods=['POST'])
def upload_image():
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

            is_valid_img, verify_msg = verify_image_bytes(f.read())

        if not is_valid_img:
            return jsonify({"error": verify_msg}), 400

        grid_size = parse_form_param(request.form, 'grid_size', 50, int, *PARAM_LIMITS['grid_size'][:2])

        remove_bg = request.form.get('remove_bg', 'true').lower() == 'true'

        color_simplify = parse_form_param(request.form, 'color_simplify', 0, int, *PARAM_LIMITS['color_simplify'][:2])

        remove_bg_threshold = parse_form_param(

            request.form, 'remove_bg_threshold', 30, int, *PARAM_LIMITS['remove_bg_threshold'][:2]

        )

        enhance_lines_strength = parse_form_param(

            request.form, 'enhance_lines_strength', 0, int, *PARAM_LIMITS['enhance_lines_strength'][:2]

        )

        bg_model = request.form.get('bg_model', None)

        if bg_model == '':
            bg_model = None

        result = generate_perler_bead_data(

            file_path,

            grid_size=grid_size,

            remove_bg=remove_bg,

            color_simplify=color_simplify,

            remove_bg_threshold=remove_bg_threshold,

            enhance_lines_strength=enhance_lines_strength,

            bg_model=bg_model

        )

        return jsonify({"success": True, "result": result})



    except Exception as e:

        logger.exception("Error in /upload")

        return jsonify({"error": str(e)}), 500

    finally:

        _cleanup(file_path)


@app.route('/api/detect-pixel', methods=['POST'])
def detect_pixel():
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

            is_valid_img, verify_msg = verify_image_bytes(f.read())

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

        logger.exception("Error in /api/detect-pixel")

        return jsonify({"error": str(e)}), 500

    finally:

        _cleanup(file_path)


@app.route('/upload-pixel', methods=['POST'])
def upload_pixel_image():
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

            is_valid_img, verify_msg = verify_image_bytes(f.read())

        if not is_valid_img:
            return jsonify({"error": verify_msg}), 400

        pixel_size = parse_form_param(request.form, 'pixel_size', 16, int, *PARAM_LIMITS['pixel_size'][:2])

        pixel_size_w = request.form.get('pixel_size_w', type=int)
        pixel_size_h = request.form.get('pixel_size_h', type=int)

        offset_x = parse_form_param(request.form, 'offset_x', 0, int, *PARAM_LIMITS['offset_x'][:2])

        offset_y = parse_form_param(request.form, 'offset_y', 0, int, *PARAM_LIMITS['offset_y'][:2])

        sampling_mode = request.form.get('sampling_mode', 'mode')

        remove_bg = request.form.get('remove_bg', 'false').lower() == 'true'

        bg_threshold = parse_form_param(request.form, 'bg_threshold', 80, int, *PARAM_LIMITS['bg_threshold'][:2])

        color_quantize = parse_form_param(request.form, 'color_quantize', 0, int, *PARAM_LIMITS['color_quantize'][:2])

        result = generate_pixel_data(

            file_path,

            pixel_size=pixel_size,

            pixel_size_w=pixel_size_w,

            pixel_size_h=pixel_size_h,

            offset_x=offset_x,

            offset_y=offset_y,

            sampling_mode=sampling_mode,

            remove_bg=remove_bg,

            bg_threshold=bg_threshold,

            color_quantize=color_quantize

        )

        return jsonify({"success": True, "result": result})



    except Exception as e:

        logger.exception("Error in /upload-pixel")

        return jsonify({"error": str(e)}), 500

    finally:

        _cleanup(file_path)


@app.route('/export', methods=['POST'])
def export_image():
    data = request.get_json()

    grid_data = data.get('grid_data', [])

    color_list = data.get('color_list', [])

    brand = data.get('brand', 'MARD')

    show_code = data.get('show_code', False)

    show_legend = data.get('show_legend', True)

    show_mark_lines = data.get('show_mark_lines', False)

    mark_interval = data.get('mark_interval', 5)

    fmt = data.get('format', 'png')

    if not grid_data:
        return jsonify({"error": "No grid data"}), 400

    try:

        buf = generate_export_image(
            grid_data, color_list, brand=brand, show_code=show_code,
            show_legend=show_legend, show_mark_lines=show_mark_lines,
            mark_interval=mark_interval, fmt=fmt
        )

        mime = 'image/jpeg' if fmt.lower() in ('jpg', 'jpeg') else 'image/png'

        if 'download_name' in inspect.signature(send_file).parameters:

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

        logger.exception("Error in /export")

        return jsonify({"error": str(e)}), 500


@app.route('/colors', methods=['GET'])
def get_colors():
    return jsonify(color_mapping)


@app.route('/api/models', methods=['GET'])
def get_models():
    return jsonify({

        "models": AVAILABLE_MODELS,

        "default": DEFAULT_MODEL

    })


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html', mimetype='text/html; charset=utf-8')
