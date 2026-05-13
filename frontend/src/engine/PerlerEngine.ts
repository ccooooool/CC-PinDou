/**
 * 拼豆图案前端处理引擎
 * 承担原后端 Python 的网格生成、颜色匹配等轻量计算
 *
 * 核心算法（借鉴 perler-beads）：
 * 1. 主导色提取（Dominant Color）— 避免 NEAREST 缩放的灰色毛边
 * 2. 最近色匹配 — RGB 欧氏距离 / CIEDE2000
 * 3. BFS 连通区域合并 — 清理杂色
 */

import type { GridCell, ColorInfo, ColorMapping } from '../types/perler';

interface RGB {
  r: number;
  g: number;
  b: number;
}

export class PerlerEngine {
  private hexList: string[];
  private rgbArray: Float32Array; // N x 3 扁平数组，加速计算
  private oklabArray: Float32Array; // N x 3 扁平数组 (L, a, b)
  private colorMapping: ColorMapping;

  constructor(colorMapping: ColorMapping, mode: 'full' | '221' = 'full') {
    this.colorMapping = colorMapping;
    let hexes = Object.keys(colorMapping);

    // 221 色模式：只保留 MARD A-M 开头的色号
    if (mode === '221') {
      hexes = hexes.filter((h) => {
        const code = colorMapping[h]?.MARD || '';
        return code && code[0] >= 'A' && code[0] <= 'M';
      });
    }

    this.hexList = hexes;
    this.rgbArray = new Float32Array(hexes.length * 3);
    this.oklabArray = new Float32Array(hexes.length * 3);

    for (let i = 0; i < hexes.length; i++) {
      const rgb = this.hexToRgb(hexes[i]);
      this.rgbArray[i * 3] = rgb.r;
      this.rgbArray[i * 3 + 1] = rgb.g;
      this.rgbArray[i * 3 + 2] = rgb.b;
      const oklab = this.rgbToOklab(rgb.r, rgb.g, rgb.b);
      this.oklabArray[i * 3] = oklab[0];
      this.oklabArray[i * 3 + 1] = oklab[1];
      this.oklabArray[i * 3 + 2] = oklab[2];
    }
  }

  // ========================================================================
  // 颜色工具
  // ========================================================================

  private hexToRgb(hex: string): RGB {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 0xff,
      g: (num >> 8) & 0xff,
      b: num & 0xff,
    };
  }

  /**
   * sRGB → OKLab 感知均匀颜色空间
   * 参考: https://bottosson.github.io/posts/oklab/
   */
  private rgbToOklab(r: number, g: number, b: number): [number, number, number] {
    // 1. sRGB → linear RGB
    const lr = r <= 10 ? r / 3294.6 : ((r / 255 + 0.055) / 1.055) ** 2.4;
    const lg = g <= 10 ? g / 3294.6 : ((g / 255 + 0.055) / 1.055) ** 2.4;
    const lb = b <= 10 ? b / 3294.6 : ((b / 255 + 0.055) / 1.055) ** 2.4;

    // 2. linear RGB → XYZ (D65)
    const x = 0.8189330101 * lr + 0.3618667424 * lg - 0.1288597137 * lb;
    const y = 0.0329845436 * lr + 0.9293118715 * lg + 0.0361456387 * lb;
    const z = 0.0482003018 * lr + 0.2643662691 * lg + 0.6338517070 * lb;

    // 3. XYZ → LMS（使用 Math.cbrt 处理负值，避免负数分数次幂返回 NaN）
    const l_ = Math.cbrt(x);
    const m_ = Math.cbrt(y);
    const s_ = Math.cbrt(z);

    // 4. LMS → OKLab
    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

    return [L, A, B];
  }



  // ========================================================================
  // 主导色提取（借鉴 perler-beads）
  // ========================================================================

  /**
   * 从 ImageData 的指定区域提取主导色（出现频率最高的颜色）。
   * 对颜色做 4-bit 量化后统计频率，既加速又具有抗噪能力。
   */
  dominantColor(
    imageData: ImageData,
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ): [number, number, number] | null {
    const data = imageData.data;
    const width = imageData.width;
    const freq = new Map<number, number>();

    for (let y = sy; y < sy + sh; y++) {
      for (let x = sx; x < sx + sw; x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a < 128) continue; // 跳过透明

        // 4-bit 量化：将 0-255 压缩到 0-15
        const r = data[idx] >> 4;
        const g = data[idx + 1] >> 4;
        const b = data[idx + 2] >> 4;
        const key = (r << 8) | (g << 4) | b;
        freq.set(key, (freq.get(key) || 0) + 1);
      }
    }

    if (freq.size === 0) return null;

    let maxKey = 0;
    let maxCount = 0;
    for (const [key, count] of freq) {
      if (count > maxCount) {
        maxCount = count;
        maxKey = key;
      }
    }

    // 还原到 8-bit
    return [
      (maxKey >> 8) << 4,
      ((maxKey >> 4) & 0xf) << 4,
      (maxKey & 0xf) << 4,
    ];
  }

  // ========================================================================
  // 最近色匹配
  // ========================================================================

  /**
   * OKLab 感知均匀空间最近色匹配。
   * 比 RGB 欧氏距离更符合人眼感知，对近似色的区分更精确。
   */
  nearestColor(rgb: [number, number, number]): string {
    const [L, A, B] = this.rgbToOklab(rgb[0], rgb[1], rgb[2]);
    let minDist = Infinity;
    let bestIdx = 0;
    const n = this.hexList.length;

    for (let i = 0; i < n; i++) {
      const dL = L - this.oklabArray[i * 3];
      const dA = A - this.oklabArray[i * 3 + 1];
      const dB = B - this.oklabArray[i * 3 + 2];
      const dist = dL * dL + dA * dA + dB * dB;
      if (dist < minDist) {
        minDist = dist;
        bestIdx = i;
      }
    }

    return this.hexList[bestIdx];
  }

  /**
   * 批量最近色匹配（用于整图处理）
   * pixels: Float32Array of shape (N, 3) in RGB
   */
  nearestColorBatch(pixels: Float32Array): string[] {
    const n = pixels.length / 3;
    const paletteN = this.hexList.length;
    const result: string[] = new Array(n);

    // 预先将所有像素批量转为 OKLab，避免在匹配循环中重复调用 rgbToOklab
    const pixelOklab = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const oklab = this.rgbToOklab(pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]);
      pixelOklab[i * 3] = oklab[0];
      pixelOklab[i * 3 + 1] = oklab[1];
      pixelOklab[i * 3 + 2] = oklab[2];
    }

    for (let i = 0; i < n; i++) {
      const L = pixelOklab[i * 3];
      const A = pixelOklab[i * 3 + 1];
      const B = pixelOklab[i * 3 + 2];
      let minDist = Infinity;
      let bestIdx = 0;

      for (let j = 0; j < paletteN; j++) {
        const dL = L - this.oklabArray[j * 3];
        const dA = A - this.oklabArray[j * 3 + 1];
        const dB = B - this.oklabArray[j * 3 + 2];
        const dist = dL * dL + dA * dA + dB * dB;
        if (dist < minDist) {
          minDist = dist;
          bestIdx = j;
        }
      }

      result[i] = this.hexList[bestIdx];
    }

    return result;
  }

  // ========================================================================
  // 像素块采样
  // ========================================================================

  /**
   * 从 ImageData 的指定区域采样一个像素块的颜色。
   * method: 'center' | 'mode' | 'mean'
   */
  private sampleBlock(
    imageData: ImageData,
    x0: number,
    y0: number,
    bw: number,
    bh: number,
    method: 'center' | 'mode' | 'mean'
  ): [number, number, number] | null {
    const { data, width, height } = imageData;

    if (method === 'center') {
      const cx = Math.min(x0 + Math.floor(bw / 2), width - 1);
      const cy = Math.min(y0 + Math.floor(bh / 2), height - 1);
      const idx = (cy * width + cx) * 4;
      const a = data[idx + 3];
      if (a < 128) return null;
      return [data[idx], data[idx + 1], data[idx + 2]];
    }

    if (method === 'mean') {
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = y0; y < y0 + bh && y < height; y++) {
        for (let x = x0; x < x0 + bw && x < width; x++) {
          const idx = (y * width + x) * 4;
          const a = data[idx + 3];
          if (a < 128) continue;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          count++;
        }
      }
      if (count === 0) return null;
      return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
    }

    // mode (default): 4-bit 量化众数
    const freq = new Map<number, number>();
    for (let y = y0; y < y0 + bh && y < height; y++) {
      for (let x = x0; x < x0 + bw && x < width; x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        if (a < 128) continue;
        const r = data[idx] >> 4;
        const g = data[idx + 1] >> 4;
        const b = data[idx + 2] >> 4;
        const key = (r << 8) | (g << 4) | b;
        freq.set(key, (freq.get(key) || 0) + 1);
      }
    }
    if (freq.size === 0) return null;
    let maxKey = 0, maxCount = 0;
    for (const [key, count] of freq) {
      if (count > maxCount) {
        maxCount = count;
        maxKey = key;
      }
    }
    return [(maxKey >> 8) << 4, ((maxKey >> 4) & 0xf) << 4, (maxKey & 0xf) << 4];
  }

  // ========================================================================
  // 像素图网格生成
  // ========================================================================

  /**
   * 从像素风格图片生成拼豆网格。
   * 按 pixelSize 间隔采样，支持 center/mode/mean 三种采样方式。
   */
  generatePixelGrid(
    imageData: ImageData,
    pixelSize: number,
    offsetX: number,
    offsetY: number,
    sampleMethod: 'center' | 'mode' | 'mean'
  ): { grid: GridCell[][]; colorMap: Map<string, ColorInfo>; cols: number; rows: number } {
    const { width, height } = imageData;
    const ps = Math.max(1, pixelSize);

    const ox = offsetX % ps;
    const oy = offsetY % ps;

    const cols = Math.max(1, Math.ceil((width - ox) / ps));
    const rows = Math.max(1, Math.ceil((height - oy) / ps));

    const grid: GridCell[][] = [];
    const colorMap = new Map<string, ColorInfo>();

    for (let gy = 0; gy < rows; gy++) {
      const row: GridCell[] = [];
      for (let gx = 0; gx < cols; gx++) {
        const x0 = ox + gx * ps;
        const y0 = oy + gy * ps;
        const bw = Math.min(ps, width - x0);
        const bh = Math.min(ps, height - y0);

        const color = this.sampleBlock(imageData, x0, y0, bw, bh, sampleMethod);
        let hex: string;

        if (color) {
          hex = this.nearestColor(color);
        } else {
          hex = 'transparent';
        }

        if (hex !== 'transparent') {
          if (!colorMap.has(hex)) {
            colorMap.set(hex, {
              hex,
              count: 0,
              codes: { ...this.colorMapping[hex] },
            });
          }
          colorMap.get(hex)!.count++;
        }

        row.push({
          x: gx,
          y: gy,
          color: hex,
          codes: hex === 'transparent' ? {} : { ...this.colorMapping[hex] },
        });
      }
      grid.push(row);
    }

    return { grid, colorMap, cols, rows };
  }

  // ========================================================================
  // 普通图片网格生成
  // ========================================================================

  /**
   * 从 ImageData 生成拼豆网格
   */
  generateGrid(
    imageData: ImageData,
    gridSize: number
  ): { grid: GridCell[][]; colorMap: Map<string, ColorInfo> } {
    const { width, height } = imageData;

    const grid: GridCell[][] = [];
    const colorMap = new Map<string, ColorInfo>();

    for (let gy = 0; gy < gridSize; gy++) {
      const row: GridCell[] = [];
      for (let gx = 0; gx < gridSize; gx++) {
        // 使用 Math.round 精确划分像素边界，避免浮点数累积误差导致采样偏移
        const sx = Math.round(gx * width / gridSize);
        const sy = Math.round(gy * height / gridSize);
        const sxNext = Math.round((gx + 1) * width / gridSize);
        const syNext = Math.round((gy + 1) * height / gridSize);
        const sw = Math.max(1, sxNext - sx);
        const sh = Math.max(1, syNext - sy);

        const dominant = this.dominantColor(imageData, sx, sy, sw, sh);
        let hex: string;

        if (dominant) {
          hex = this.nearestColor(dominant);
        } else {
          hex = 'transparent';
        }

        if (hex !== 'transparent') {
          if (!colorMap.has(hex)) {
            colorMap.set(hex, {
              hex,
              count: 0,
              codes: { ...this.colorMapping[hex] },
            });
          }
          colorMap.get(hex)!.count++;
        }

        row.push({
          x: gx,
          y: gy,
          color: hex,
          codes: hex === 'transparent' ? {} : { ...this.colorMapping[hex] },
        });
      }
      grid.push(row);
    }

    return { grid, colorMap };
  }

  // ========================================================================
  // BFS 连通区域合并（借鉴 perler-beads）
  // ========================================================================

  /**
   * BFS 连通区域检测与合并。
   * 将颜色距离小于 threshold 的相邻格子聚合为同一颜色（区域内最高频色）。
   */
  bfsMerge(grid: GridCell[][], threshold: number): GridCell[][] {
    const rows = grid.length;
    if (rows === 0) return grid;
    const cols = grid[0].length;

    const visited = new Set<string>();
    const newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));
    const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];

    const getRgb = (hex: string): RGB => {
      if (hex === 'transparent') return { r: 255, g: 255, b: 255 };
      return this.hexToRgb(hex);
    };

    const colorDist = (a: string, b: string): number => {
      const ca = getRgb(a);
      const cb = getRgb(b);
      return Math.sqrt(
        (ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2
      );
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        const baseColor = grid[y][x].color;
        const region: Array<{ x: number; y: number }> = [];
        const queue: Array<{ x: number; y: number }> = [{ x, y }];
        visited.add(key);

        while (queue.length > 0) {
          const { x: cx, y: cy } = queue.shift()!;
          region.push({ x: cx, y: cy });

          for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

            const nKey = `${nx},${ny}`;
            if (visited.has(nKey)) continue;

            if (colorDist(baseColor, grid[ny][nx].color) < threshold) {
              visited.add(nKey);
              queue.push({ x: nx, y: ny });
            }
          }
        }

        // 统计区域内最高频颜色
        const freq = new Map<string, number>();
        for (const { x: rx, y: ry } of region) {
          const c = grid[ry][rx].color;
          freq.set(c, (freq.get(c) || 0) + 1);
        }

        let maxColor = baseColor;
        let maxCount = 0;
        for (const [c, count] of freq) {
          if (count > maxCount) {
            maxCount = count;
            maxColor = c;
          }
        }

        // 应用合并后的颜色
        for (const { x: rx, y: ry } of region) {
          newGrid[ry][rx].color = maxColor;
          newGrid[ry][rx].codes =
            maxColor === 'transparent'
              ? {}
              : { ...this.colorMapping[maxColor] };
        }
      }
    }

    return newGrid;
  }
}
