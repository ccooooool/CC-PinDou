"""
测试背景移除功能，支持模型切换和参数调节

用法:
    python test_remove_bg.py <输入图片> [选项]

模式:
    单图测试        默认模式，使用指定模型和参数生成单张结果
    --models        批量对比所有可用模型（同一张图，不同模型）
    --compare       批量对比不同 threshold（同一张图，不同阈值）

选项:
    -o, --output <路径>     单图模式输出路径 (默认: output_removed_bg.png)
    -t, --threshold <数值>  edge_threshold 10~100 (默认: 30)
    -m, --model <名称>      指定模型 (默认: u2net)
    --models                批量对比所有可用模型
    --compare               批量对比不同 threshold (10/30/50/70/90)
    --list-models           列出所有可用模型
    --alpha-matting         强制启用 alpha matting
    --fg <数值>             alpha matting 前景阈值 1~255
    --bg <数值>             alpha matting 背景阈值 1~255
    --erode <数值>          alpha matting 腐蚀大小 >=1

示例:
    # 默认测试 (u2net + threshold=30)
    python test_remove_bg.py input.jpg

    # 指定模型
    python test_remove_bg.py input.jpg -m isnet-anime

    # 批量对比所有模型
    python test_remove_bg.py input.jpg --models

    # 批量对比不同 threshold
    python test_remove_bg.py input.jpg --compare

    # 调节 threshold
    python test_remove_bg.py input.jpg -t 70

    # 手动指定 alpha matting
    python test_remove_bg.py input.jpg --alpha-matting --fg 100 --bg 50 --erode 3

    # 列出模型
    python test_remove_bg.py --list-models
"""

import sys
import os
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from PIL import Image
from app import remove_background, AVAILABLE_MODELS, DEFAULT_MODEL
from rembg import remove, new_session


def list_models():
    print("可用模型列表:")
    print("-" * 60)
    for m in AVAILABLE_MODELS:
        tags = " ".join([f"[{t}]" for t in m.get("tags", [])])
        print(f"  {m['name']:20s} {m['label']:15s} {m['size_mb']:10s} {tags}")
        print(f"                       {m['desc']}")
    print("-" * 60)
    print(f"默认模型: {DEFAULT_MODEL}")


def get_transparent_stats(result):
    if result.mode != 'RGBA':
        return None
    alpha = np.array(result.split()[3])
    transparent = np.sum(alpha < 128)
    total = result.size[0] * result.size[1]
    return transparent, total, transparent / total * 100


def process_single(img_path, output_path, edge_threshold=30, model_name=None,
                   force_alpha=False, fg=None, bg=None, erode=None):
    img = Image.open(img_path)
    model_label = model_name if model_name else DEFAULT_MODEL

    if force_alpha or (fg is not None):
        session = new_session(model_name or DEFAULT_MODEL)
        alpha_cfg = {
            "session": session,
            "alpha_matting": True,
            "alpha_matting_foreground_threshold": fg if fg is not None else max(1, 200 - (edge_threshold - 50) * 3),
            "alpha_matting_background_threshold": bg if bg is not None else min(239, 20 + (edge_threshold - 50) * 2),
            "alpha_matting_erode_size": erode if erode is not None else max(1, (edge_threshold - 50) // 10 + 1),
        }
        result = remove(img, **alpha_cfg)
    else:
        result = remove_background(img, edge_threshold=edge_threshold, model_name=model_name)

    result.save(output_path)
    stats = get_transparent_stats(result)
    return result, stats, model_label


def run_single(args):
    print(f"[单图模式] 模型={args.model or DEFAULT_MODEL}, threshold={args.threshold}")
    _, stats, _ = process_single(
        args.input, args.output,
        edge_threshold=args.threshold,
        model_name=args.model,
        force_alpha=args.alpha_matting,
        fg=args.fg, bg=args.bg, erode=args.erode
    )
    if stats:
        print(f"输出: {args.output}")
        print(f"透明像素: {stats[0]}/{stats[1]} ({stats[2]:.1f}%)")
    else:
        print(f"输出: {args.output}")


def run_models_compare(args):
    base_name = os.path.splitext(os.path.basename(args.input))[0]
    out_dir = f"{base_name}_models_compare"
    os.makedirs(out_dir, exist_ok=True)

    print(f"[模型对比模式] 输出目录: {out_dir}/")
    print(f"{'模型':20s} {'标签':15s} {'耗时':8s} {'透明像素':>12s} {'说明'}")
    print("-" * 80)

    results = []
    for model_info in AVAILABLE_MODELS:
        model_name = model_info['name']
        out_path = os.path.join(out_dir, f"{base_name}_{model_name}.png")

        start = time.time()
        _, stats, _ = process_single(
            args.input, out_path,
            edge_threshold=args.threshold,
            model_name=model_name
        )
        elapsed = time.time() - start

        if stats:
            stats_str = f"{stats[0]}/{stats[1]} ({stats[2]:.1f}%)"
        else:
            stats_str = "N/A"

        tag_str = ",".join(model_info.get("tags", []))
        print(f"{model_name:20s} {model_info['label']:15s} {elapsed:6.2f}s  {stats_str:>12s}  {tag_str}")
        results.append({
            "model": model_name,
            "label": model_info['label'],
            "path": out_path,
            "time": elapsed,
            "stats": stats
        })

    print("-" * 80)
    print(f"对比完成，共 {len(results)} 个模型，查看 {out_dir}/ 目录")
    return out_dir, results


def run_threshold_compare(args):
    base_name = os.path.splitext(os.path.basename(args.input))[0]
    out_dir = f"{base_name}_threshold_compare"
    os.makedirs(out_dir, exist_ok=True)

    thresholds = [10, 30, 50, 70, 90]
    model_label = args.model or DEFAULT_MODEL

    print(f"[Threshold 对比模式] 模型={model_label}, 输出目录: {out_dir}/")
    print(f"{'Threshold':>10s} {'Alpha':8s} {'耗时':8s} {'透明像素':>12s}")
    print("-" * 50)

    results = []
    for t in thresholds:
        out_path = os.path.join(out_dir, f"{base_name}_t{t}.png")

        start = time.time()
        _, stats, _ = process_single(
            args.input, out_path,
            edge_threshold=t,
            model_name=args.model
        )
        elapsed = time.time() - start

        alpha_status = "ON" if t > 50 else "OFF"
        if stats:
            stats_str = f"{stats[0]}/{stats[1]} ({stats[2]:.1f}%)"
        else:
            stats_str = "N/A"

        print(f"{t:>10d} {alpha_status:8s} {elapsed:6.2f}s  {stats_str:>12s}")
        results.append({"threshold": t, "path": out_path, "time": elapsed, "stats": stats})

    print("-" * 50)
    print(f"对比完成，共 {len(results)} 个 threshold，查看 {out_dir}/ 目录")
    return out_dir, results


def main():
    parser = argparse.ArgumentParser(
        description="测试 rembg 背景移除 - 支持模型切换和批量对比",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python test_remove_bg.py test.jpg              # 单图测试
  python test_remove_bg.py test.jpg --models     # 批量对比所有模型
  python test_remove_bg.py test.jpg --compare    # 批量对比不同 threshold
  python test_remove_bg.py test.jpg -m isnet-anime -t 50   # 指定模型+阈值
  python test_remove_bg.py --list-models         # 列出模型
        """
    )
    parser.add_argument("input", nargs="?", help="输入图片路径")
    parser.add_argument("-o", "--output", default="output_removed_bg.png", help="单图输出路径")
    parser.add_argument("-t", "--threshold", type=int, default=30, help="edge_threshold (10~100)")
    parser.add_argument("-m", "--model", default=None, help="指定模型名称")
    parser.add_argument("--models", action="store_true", help="批量对比所有可用模型")
    parser.add_argument("--compare", action="store_true", help="批量对比不同 threshold")
    parser.add_argument("--list-models", action="store_true", help="列出可用模型")
    parser.add_argument("--alpha-matting", action="store_true", help="强制启用 alpha matting")
    parser.add_argument("--fg", type=int, default=None, help="alpha matting 前景阈值")
    parser.add_argument("--bg", type=int, default=None, help="alpha matting 背景阈值")
    parser.add_argument("--erode", type=int, default=None, help="alpha matting 腐蚀大小")
    args = parser.parse_args()

    if args.list_models:
        list_models()
        return

    if not args.input:
        parser.print_help()
        sys.exit(1)

    if not os.path.exists(args.input):
        print(f"错误: 文件不存在: {args.input}")
        sys.exit(1)

    if args.models and args.compare:
        print("错误: --models 和 --compare 不能同时使用")
        sys.exit(1)

    if args.models:
        run_models_compare(args)
    elif args.compare:
        run_threshold_compare(args)
    else:
        run_single(args)


if __name__ == "__main__":
    main()
