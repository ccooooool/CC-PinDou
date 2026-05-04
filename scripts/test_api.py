"""后端 API 联调测试脚本

测试精简后的新 API：
- GET  /api/models
- POST /api/remove-bg
- POST /api/enhance-lines
- POST /api/detect-pixel
- POST /export
"""

import os
import sys
import json
import time

# 使用 urllib 避免外部依赖
from urllib import request, error, parse

BASE_URL = "http://localhost:5678"
IMAGE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "image", "xiangshu.jpg")


def test_get(path: str) -> dict:
    """发送 GET 请求并解析 JSON。"""
    url = f"{BASE_URL}{path}"
    try:
        with request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            print(f"[OK] GET {path} -> {resp.status}")
            return data
    except error.HTTPError as e:
        print(f"[FAIL] GET {path} -> {e.code}: {e.read().decode()}")
        return {}
    except Exception as e:
        print(f"[FAIL] GET {path} -> {e}")
        return {}


def test_post_multipart(path: str, fields: dict, file_path: str, file_field: str = "image") -> dict | bytes:
    """发送 multipart/form-data POST 请求。"""
    url = f"{BASE_URL}{path}"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

    body_parts = []
    for key, value in fields.items():
        body_parts.append(f"--{boundary}")
        body_parts.append(f'Content-Disposition: form-data; name="{key}"')
        body_parts.append("")
        body_parts.append(str(value))

    filename = os.path.basename(file_path)
    mime_type = "image/jpeg" if filename.endswith(".jpg") else "image/png"
    body_parts.append(f"--{boundary}")
    body_parts.append(f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"')
    body_parts.append(f"Content-Type: {mime_type}")
    body_parts.append("")

    body_str = "\r\n".join(body_parts)
    body_bytes = body_str.encode("utf-8")

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    end_bytes = f"\r\n--{boundary}--\r\n".encode("utf-8")
    full_body = body_bytes + b"\r\n" + file_bytes + end_bytes

    req = request.Request(
        url,
        data=full_body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=60) as resp:
            content_type = resp.headers.get("Content-Type", "")
            data = resp.read()
            if "application/json" in content_type:
                result = json.loads(data.decode())
                print(f"[OK] POST {path} -> {resp.status} (JSON)")
                return result
            else:
                print(f"[OK] POST {path} -> {resp.status} ({content_type}, {len(data)} bytes)")
                return data
    except error.HTTPError as e:
        print(f"[FAIL] POST {path} -> {e.code}: {e.read().decode()}")
        return {}
    except Exception as e:
        print(f"[FAIL] POST {path} -> {e}")
        return {}


def test_export() -> bytes | dict:
    """测试导出接口。"""
    url = f"{BASE_URL}/export"
    payload = {
        "grid_data": [
            [{"x": 0, "y": 0, "color": "#FAF4C8", "codes": {"MARD": "A01"}},
             {"x": 1, "y": 0, "color": "#FFFFD5", "codes": {"MARD": "A02"}}],
            [{"x": 0, "y": 1, "color": "transparent", "codes": {}},
             {"x": 1, "y": 1, "color": "#FEFF8B", "codes": {"MARD": "A03"}}]
        ],
        "color_list": [
            {"hex": "#FAF4C8", "count": 1, "codes": {"MARD": "A01"}},
            {"hex": "#FFFFD5", "count": 1, "codes": {"MARD": "A02"}},
            {"hex": "#FEFF8B", "count": 1, "codes": {"MARD": "A03"}}
        ],
        "brand": "MARD",
        "show_code": True,
        "show_legend": True,
        "circle_mode": False,
        "format": "png"
    }

    req = request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=30) as resp:
            data = resp.read()
            print(f"[OK] POST /export -> {resp.status} ({len(data)} bytes)")
            return data
    except error.HTTPError as e:
        print(f"[FAIL] POST /export -> {e.code}: {e.read().decode()}")
        return {}
    except Exception as e:
        print(f"[FAIL] POST /export -> {e}")
        return {}


def main():
    print("=" * 50)
    print("CC-PinDou 后端 API 联调测试")
    print("=" * 50)
    print(f"测试图片: {IMAGE_PATH}")
    print()

    if not os.path.exists(IMAGE_PATH):
        print(f"[FAIL] 测试图片不存在: {IMAGE_PATH}")
        sys.exit(1)

    # 1. 测试模型列表
    print("[1/5] 测试 GET /api/models")
    models = test_get("/api/models")
    if models.get("models"):
        print(f"   可用模型: {len(models['models'])} 个")
    print()

    # 2. 测试背景移除
    print("[2/5] 测试 POST /api/remove-bg")
    print("   正在处理，请稍候（首次可能需下载模型）...")
    start = time.time()
    bg_result = test_post_multipart(
        "/api/remove-bg",
        {"edge_threshold": 30},
        IMAGE_PATH
    )
    print(f"   耗时: {time.time() - start:.1f}s")
    print()

    # 3. 测试线条增强
    print("[3/5] 测试 POST /api/enhance-lines")
    start = time.time()
    line_result = test_post_multipart(
        "/api/enhance-lines",
        {"strength": 3},
        IMAGE_PATH
    )
    print(f"   耗时: {time.time() - start:.1f}s")
    print()

    # 4. 测试像素图检测
    print("[4/5] 测试 POST /api/detect-pixel")
    start = time.time()
    pixel_result = test_post_multipart(
        "/api/detect-pixel",
        {},
        IMAGE_PATH
    )
    print(f"   耗时: {time.time() - start:.1f}s")
    if pixel_result.get("pixel_size"):
        print(f"   检测结果: pixel_size={pixel_result['pixel_size']}, offset=({pixel_result.get('offset_x')}, {pixel_result.get('offset_y')})")
    print()

    # 5. 测试导出
    print("[5/5] 测试 POST /export")
    export_result = test_export()
    print()

    print("=" * 50)
    print("测试完成")
    print("=" * 50)


if __name__ == "__main__":
    main()
