"""CC-PinDou 前后端联合构建脚本。

用法:
    python build.py              # 完整构建（含测试）
    python build.py --skip-tests # 跳过测试，快速构建
    python build.py --check-only # 仅检查环境
"""

import argparse
import os
import shutil
import subprocess
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')
SERVER_DIR = os.path.join(PROJECT_ROOT, 'server')
MODELS_DIR = os.path.join(PROJECT_ROOT, 'models')

REQUIRED_MODELS = ['u2net.onnx']


def run_command(cmd, cwd=None, description=None):
    """运行 shell 命令并实时输出。"""
    if description:
        print(f'\n▶ {description}')
    print(f'  $ {" ".join(cmd)}')
    result = subprocess.run(cmd, cwd=cwd, shell=False)
    if result.returncode != 0:
        print(f'❌ 命令失败: {" ".join(cmd)}')
        sys.exit(result.returncode)
    return result


def check_python():
    """检查 Python 版本 >= 3.12。"""
    version = sys.version_info
    if version < (3, 12):
        print(f'⚠️  Python {version.major}.{version.minor} 检测到，建议 >= 3.12')
        return False
    print(f'✅ Python {version.major}.{version.minor}.{version.micro}')
    return True


def check_nodejs():
    """检查 Node.js 版本 >= 18。"""
    try:
        result = subprocess.run(
            ['node', '--version'],
            capture_output=True, text=True, check=True
        )
        version_str = result.stdout.strip().lstrip('v')
        major = int(version_str.split('.')[0])
        if major < 18:
            print(f'⚠️  Node.js {version_str} 检测到，需要 >= 18')
            return False
        print(f'✅ Node.js {version_str}')
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print('❌ Node.js 未安装')
        return False


def check_models():
    """检查 ONNX 模型文件是否存在。"""
    missing = []
    for model in REQUIRED_MODELS:
        path = os.path.join(MODELS_DIR, model)
        if not os.path.exists(path):
            missing.append(model)
    if missing:
        print(f'⚠️  缺失模型文件（首次使用时会自动下载）: {", ".join(missing)}')
        return False
    print(f'✅ 模型文件已就绪')
    return True


def install_python_deps():
    """安装 Python 依赖。"""
    req_file = os.path.join(PROJECT_ROOT, 'requirements.txt')
    if not os.path.exists(req_file):
        print('⚠️  requirements.txt 不存在，跳过 Python 依赖安装')
        return
    run_command(
        [sys.executable, '-m', 'pip', 'install', '-r', req_file],
        description='安装 Python 依赖'
    )


def install_node_deps():
    """安装 Node.js 依赖。"""
    if not os.path.exists(os.path.join(FRONTEND_DIR, 'package.json')):
        print('⚠️  frontend/package.json 不存在，跳过 Node 依赖安装')
        return
    run_command(
        ['npm', 'ci'],
        cwd=FRONTEND_DIR,
        description='安装 Node.js 依赖'
    )


def run_backend_tests():
    """运行后端 pytest 测试。"""
    run_command(
        [sys.executable, '-m', 'pytest', 'tests/', '-v'],
        cwd=SERVER_DIR,
        description='运行后端测试'
    )


def run_frontend_tests():
    """运行前端 Vitest 测试。"""
    run_command(
        ['npm', 'test'],
        cwd=FRONTEND_DIR,
        description='运行前端测试'
    )


def build_frontend():
    """构建前端生产包。"""
    run_command(
        ['npm', 'run', 'build'],
        cwd=FRONTEND_DIR,
        description='构建前端生产包'
    )
    dist_dir = os.path.join(FRONTEND_DIR, 'dist')
    if os.path.exists(dist_dir):
        print(f'✅ 前端构建完成: {dist_dir}')
    else:
        print('❌ 前端构建输出目录不存在')
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description='CC-PinDou 构建脚本')
    parser.add_argument('--skip-tests', action='store_true', help='跳过前后端测试')
    parser.add_argument('--check-only', action='store_true', help='仅检查环境，不执行构建')
    args = parser.parse_args()

    print('🔧 CC-PinDou 构建脚本')
    print('=' * 50)

    # 环境检查
    print('\n📋 环境检查')
    python_ok = check_python()
    node_ok = check_nodejs()
    models_ok = check_models()

    if args.check_only:
        if python_ok and node_ok:
            print('\n✅ 环境检查通过')
        else:
            print('\n⚠️  环境检查未完全通过')
        return

    # 安装依赖
    install_python_deps()
    install_node_deps()

    # 运行测试
    if not args.skip_tests:
        run_backend_tests()
        run_frontend_tests()
    else:
        print('\n⏭ 跳过测试')

    # 构建前端
    build_frontend()

    print('\n' + '=' * 50)
    print('🎉 构建完成！')
    print(f'   启动命令: python run.py')


if __name__ == '__main__':
    main()
