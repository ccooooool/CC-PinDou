"""CC-PinDou 生产启动入口。

使用 waitress 作为 WSGI 服务器，自动 serve 前端构建产物。
"""

import os
import sys

# 确保 server/ 目录在路径中
SERVER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server')
sys.path.insert(0, SERVER_DIR)

from waitress import serve
from app import app

PORT = 5678

if __name__ == '__main__':
    print(f'🚀 CC-PinDou 生产服务器启动于 http://localhost:{PORT}')
    print(f'📁 静态文件目录: {app.static_folder}')
    serve(app, host='0.0.0.0', port=PORT, threads=8)
