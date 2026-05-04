"""测试 /api/remove-bg 使用本地模型"""
import os
import urllib.request

IMAGE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "image", "xiangshu.jpg")
boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"

# 构建 multipart body
parts = []
parts.append(f"--{boundary}")
parts.append('Content-Disposition: form-data; name="edge_threshold"')
parts.append("")
parts.append("30")
parts.append(f"--{boundary}")
parts.append('Content-Disposition: form-data; name="image"; filename="xiangshu.jpg"')
parts.append("Content-Type: image/jpeg")
parts.append("")
body_str = "\r\n".join(parts)
body_bytes = body_str.encode("utf-8")

with open(IMAGE_PATH, "rb") as f:
    file_bytes = f.read()

end_bytes = f"\r\n--{boundary}--\r\n".encode("utf-8")
full_body = body_bytes + b"\r\n" + file_bytes + end_bytes

req = urllib.request.Request(
    "http://localhost:5000/api/remove-bg",
    data=full_body,
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
        print(f"[OK] Status: {resp.status}")
        print(f"     Content-Type: {resp.headers.get('Content-Type')}")
        print(f"     Size: {len(data)} bytes")
except Exception as e:
    print(f"[FAIL] {e}")
