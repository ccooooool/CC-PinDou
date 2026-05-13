/**
 * 前端降级算法模块
 * 当后端不可用时，提供基础的前端图像处理能力，
 * 保证用户仍可进行基本的拼豆图案生成和编辑。
 */

// =============================================================================
// 颜色简化
// =============================================================================

export function simplifyColorsFrontend(
  imageData: ImageData,
  level: number
): ImageData {
  if (level <= 0) return imageData;

  const { data, width, height } = imageData;
  const pixels: Uint8ClampedArray = new Uint8ClampedArray(data);

  // 1. 收集所有颜色频率（4-bit 量化抗噪）
  const colorMap = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue;

    // 4-bit 量化
    const r = (pixels[i] >> 4) << 4;
    const g = (pixels[i + 1] >> 4) << 4;
    const b = (pixels[i + 2] >> 4) << 4;
    const key = (r << 16) | (g << 8) | b;

    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r, g, b, count: 1 });
    }
  }

  if (colorMap.size === 0) return imageData;

  // 2. 按频率排序，保留前 K 色
  const colors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
  const keepRatio = (100 - level) / 100;
  const keepCount = Math.max(2, Math.ceil(colors.length * keepRatio));
  const mainColors = colors.slice(0, keepCount);

  // 3. 替换每个像素为最近的主要颜色
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let j = 0; j < mainColors.length; j++) {
      const c = mainColors[j];
      const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = j;
      }
    }

    pixels[i] = mainColors[bestIdx].r;
    pixels[i + 1] = mainColors[bestIdx].g;
    pixels[i + 2] = mainColors[bestIdx].b;
  }

  return new ImageData(pixels as any, width, height);
}

// =============================================================================
// 背景移除（降级版：边框主色检测）
// =============================================================================

export function removeBgFrontend(
  imageData: ImageData,
  threshold: number = 40
): ImageData {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);

  // 采样边框颜色（4-bit 量化，合并肉眼难以区分的相近颜色）
  const borderColors = new Map<number, number>();
  const samplePixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const r = (out[idx] >> 4) << 4;
    const g = (out[idx + 1] >> 4) << 4;
    const b = (out[idx + 2] >> 4) << 4;
    const key = (r << 16) | (g << 8) | b;
    borderColors.set(key, (borderColors.get(key) || 0) + 1);
  };

  // 采样四边
  for (let x = 0; x < width; x++) {
    samplePixel(x, 0);
    samplePixel(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    samplePixel(0, y);
    samplePixel(width - 1, y);
  }

  // 找出最常见的边框颜色
  let bgColor = { r: 255, g: 255, b: 255 };
  let maxCount = 0;
  for (const [key, count] of borderColors) {
    if (count > maxCount) {
      maxCount = count;
      bgColor = {
        r: (key >> 16) & 0xff,
        g: (key >> 8) & 0xff,
        b: key & 0xff,
      };
    }
  }

  const totalBorder = Array.from(borderColors.values()).reduce((a, b) => a + b, 0);
  const bgRatio = maxCount / totalBorder;

  // 边框颜色统一时用小容差精确移除；不够统一时用大容差宽松移除，绝不直接返回原图
  const isUniform = bgRatio * 100 >= threshold;
  const tolerance = isUniform ? 30 : 60;
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const dist = Math.abs(r - bgColor.r) + Math.abs(g - bgColor.g) + Math.abs(b - bgColor.b);
    if (dist < tolerance * 3) {
      out[i + 3] = 0;
    }
  }

  return new ImageData(out, width, height);
}

// =============================================================================
// 线条增强（降级版）
// =============================================================================

export function enhanceLinesFrontend(
  imageData: ImageData,
  strength: number
): ImageData {
  if (strength <= 0) return imageData;

  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(data);

  // 灰度化 + 阈值
  const threshold = Math.max(20, 110 - strength * 10);
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // 简单的 MinFilter（腐蚀）效果
  const iterations = Math.min(strength, 5);
  let mask = new Uint8Array(gray);

  for (let iter = 0; iter < iterations; iter++) {
    const newMask = new Uint8Array(mask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        let minVal = mask[idx];
        minVal = Math.min(minVal, mask[idx - 1]);
        minVal = Math.min(minVal, mask[idx + 1]);
        minVal = Math.min(minVal, mask[idx - width]);
        minVal = Math.min(minVal, mask[idx + width]);
        newMask[idx] = minVal;
      }
    }
    mask = newMask;
  }

  // 将暗色区域增强为黑色
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < threshold) {
      const idx = i * 4;
      out[idx] = 0;
      out[idx + 1] = 0;
      out[idx + 2] = 0;
    }
  }

  return new ImageData(out, width, height);
}

// =============================================================================
// 像素块检测（降级版）
// =============================================================================

export function detectPixelSizeFrontend(
  imageData: ImageData
): { pixelSize: number; offsetX: number; offsetY: number } {
  const { data, width, height } = imageData;

  // 缩小到 max 200px 以加速
  const maxSize = 200;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const sw = Math.floor(width * scale);
  const sh = Math.floor(height * scale);

  // 创建缩小后的 RGB 数组
  const arr = new Float32Array(sw * sh * 3);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      const sIdx = (sy * width + sx) * 4;
      const dIdx = (y * sw + x) * 3;
      arr[dIdx] = data[sIdx];
      arr[dIdx + 1] = data[sIdx + 1];
      arr[dIdx + 2] = data[sIdx + 2];
    }
  }

  // 计算边缘
  const dx = new Float32Array(sh * sw);
  const dy = new Float32Array(sh * sw);
  for (let y = 0; y < sh; y++) {
    for (let x = 1; x < sw; x++) {
      const idx = y * sw + x;
      const pIdx = idx * 3;
      const prevIdx = (y * sw + x - 1) * 3;
      dx[idx] = Math.abs(arr[pIdx] - arr[prevIdx]) +
                Math.abs(arr[pIdx + 1] - arr[prevIdx + 1]) +
                Math.abs(arr[pIdx + 2] - arr[prevIdx + 2]);
    }
  }
  for (let y = 1; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = y * sw + x;
      const pIdx = idx * 3;
      const prevIdx = ((y - 1) * sw + x) * 3;
      dy[idx] = Math.abs(arr[pIdx] - arr[prevIdx]) +
                Math.abs(arr[pIdx + 1] - arr[prevIdx + 1]) +
                Math.abs(arr[pIdx + 2] - arr[prevIdx + 2]);
    }
  }

  const edgeThresh = 50;
  const strongX: boolean[] = Array.from(dx).map((v) => v > edgeThresh);
  const strongY: boolean[] = Array.from(dy).map((v) => v > edgeThresh);

  // 收集边缘间隔
  const intervalCounts = new Map<number, number>();
  for (let y = 0; y < sh; y++) {
    let lastX = -1;
    for (let x = 0; x < sw; x++) {
      if (strongX[y * sw + x]) {
        if (lastX >= 0) {
          const d = x - lastX;
          if (d >= 2 && d <= 128) {
            intervalCounts.set(d, (intervalCounts.get(d) || 0) + 1);
          }
        }
        lastX = x;
      }
    }
  }
  for (let x = 0; x < sw; x++) {
    let lastY = -1;
    for (let y = 0; y < sh; y++) {
      if (strongY[y * sw + x]) {
        if (lastY >= 0) {
          const d = y - lastY;
          if (d >= 2 && d <= 128) {
            intervalCounts.set(d, (intervalCounts.get(d) || 0) + 1);
          }
        }
        lastY = y;
      }
    }
  }

  // 找最可能的 pixelSize
  let bestSize = 16;
  let bestScore = 0;
  for (const [size, count] of intervalCounts) {
    const score = count + (intervalCounts.get(size - 1) || 0) + (intervalCounts.get(size + 1) || 0);
    if (score > bestScore) {
      bestScore = score;
      bestSize = size;
    }
  }

  // 缩放回原始尺寸
  const pixelSize = Math.max(4, Math.round(bestSize / scale));

  // 简单偏移检测：尝试 0 到 pixelSize-1，找边缘最多的
  let bestOffsetX = 0;
  let bestOffsetY = 0;
  let bestEdgeCount = 0;

  for (let ox = 0; ox < Math.min(pixelSize, 8); ox++) {
    for (let oy = 0; oy < Math.min(pixelSize, 8); oy++) {
      let edgeCount = 0;
      for (let y = oy; y < height; y += pixelSize) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const belowIdx = ((y + 1) * width + x) * 4;
          if (y + 1 < height) {
            const diff = Math.abs(data[idx] - data[belowIdx]) +
                        Math.abs(data[idx + 1] - data[belowIdx + 1]) +
                        Math.abs(data[idx + 2] - data[belowIdx + 2]);
            if (diff > edgeThresh) edgeCount++;
          }
        }
      }
      for (let x = ox; x < width; x += pixelSize) {
        for (let y = 0; y < height; y++) {
          const idx = (y * width + x) * 4;
          const rightIdx = (y * width + x + 1) * 4;
          if (x + 1 < width) {
            const diff = Math.abs(data[idx] - data[rightIdx]) +
                        Math.abs(data[idx + 1] - data[rightIdx + 1]) +
                        Math.abs(data[idx + 2] - data[rightIdx + 2]);
            if (diff > edgeThresh) edgeCount++;
          }
        }
      }
      if (edgeCount > bestEdgeCount) {
        bestEdgeCount = edgeCount;
        bestOffsetX = ox;
        bestOffsetY = oy;
      }
    }
  }

  return { pixelSize, offsetX: bestOffsetX, offsetY: bestOffsetY };
}

// =============================================================================
// 前端导出（Canvas 降级）
// =============================================================================

export interface FrontendExportOptions {
  fileName: string;
  format: 'png' | 'jpg';
  showCode: boolean;
  showLegend: boolean;
  circleMode: boolean;
  showMarkLines: boolean;
  markInterval: number;
  beadSize?: number;
  margin?: number;
}

export async function exportImageFrontend(
  gridData: Array<Array<{ color: string; codes: Record<string, string> }>>,
  colorList: Array<{ hex: string; count: number; codes: Record<string, string> }>,
  brand: string,
  options: FrontendExportOptions
): Promise<Blob> {
  const {
    showCode,
    showLegend,
    circleMode,
    showMarkLines,
    markInterval,
    beadSize = 28,
    margin = 45,
    format,
  } = options;

  const rows = gridData.length;
  const cols = gridData[0]?.length || 0;

  // 计算图例尺寸（水平排列，下方，自动换行）
  const legendItemWidth = 100;
  const itemsPerRow = showLegend ? Math.max(1, Math.floor((cols * beadSize + margin * 2 - 40) / legendItemWidth)) : 0;
  const legendRows = showLegend ? Math.ceil(colorList.length / itemsPerRow) : 0;
  const legendHeight = showLegend ? legendRows * 30 + 40 : 0;

  const canvasWidth = cols * beadSize + margin * 2;
  const canvasHeight = rows * beadSize + margin * 2 + legendHeight + 20;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 坐标轴标签
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "12px 'WenYuanRounded', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillStyle = '#5D4037';
  for (let i = 0; i < cols; i++) {
    ctx.fillText(String(i + 1), margin + i * beadSize + beadSize / 2, margin / 2);
  }
  for (let i = 0; i < rows; i++) {
    ctx.fillText(String(i + 1), margin / 2, margin + i * beadSize + beadSize / 2);
  }

  // 绘制 beads
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = gridData[y][x];
      const px = margin + x * beadSize;
      const py = margin + y * beadSize;

      if (circleMode) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(px, py, beadSize, beadSize);
        const cx = px + beadSize / 2;
        const cy = py + beadSize / 2;
        const r = beadSize / 2 - 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.fillStyle = '#F3E5D8';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = cell.color === 'transparent' ? '#FFFFFF' : cell.color;
        ctx.fill();
      } else {
        ctx.fillStyle = cell.color === 'transparent' ? '#FFFFFF' : cell.color;
        ctx.fillRect(px, py, beadSize, beadSize);
      }

      if (showCode && cell.codes[brand]) {
        const code = cell.codes[brand];
        const brightness = hexBrightness(cell.color);
        ctx.fillStyle = brightness > 128 ? '#5D4037' : '#FFFFFF';
        ctx.fillText(code, px + beadSize / 2, py + beadSize / 2);
      }
    }
  }

  // 网格线
  ctx.strokeStyle = '#BCAAA4';
  ctx.lineWidth = 1;
  for (let i = 0; i <= rows; i++) {
    const isMark = showMarkLines && i > 0 && i % markInterval === 0;
    ctx.strokeStyle = isMark ? '#5D4037' : '#BCAAA4';
    ctx.lineWidth = isMark ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin + i * beadSize);
    ctx.lineTo(margin + cols * beadSize, margin + i * beadSize);
    ctx.stroke();
  }
  for (let i = 0; i <= cols; i++) {
    const isMark = showMarkLines && i > 0 && i % markInterval === 0;
    ctx.strokeStyle = isMark ? '#5D4037' : '#BCAAA4';
    ctx.lineWidth = isMark ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(margin + i * beadSize, margin);
    ctx.lineTo(margin + i * beadSize, margin + rows * beadSize);
    ctx.stroke();
  }

  // 图例（图片下方，水平排列，自动换行）
  if (showLegend) {
    const legendX = margin;
    const legendY = margin + rows * beadSize + 20;

    ctx.fillStyle = '#5D4037';
    ctx.font = "bold 14px 'WenYuanRounded', 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText('颜色图例', legendX, legendY);

    ctx.font = "12px 'WenYuanRounded', 'PingFang SC', 'Microsoft YaHei', sans-serif";
    let xPos = legendX;
    let yPos = legendY + 30;

    for (const color of colorList) {
      ctx.fillStyle = color.hex;
      ctx.fillRect(xPos, yPos - 10, 18, 18);
      ctx.strokeStyle = '#F3E5D8';
      ctx.lineWidth = 1;
      ctx.strokeRect(xPos, yPos - 10, 18, 18);

      const code = color.codes[brand] || '';
      ctx.fillStyle = '#5D4037';
      ctx.fillText(`${code} × ${color.count}`, xPos + 26, yPos + 2);

      xPos += legendItemWidth;
      if (xPos > canvasWidth - legendItemWidth) {
        xPos = legendX;
        yPos += 30;
      }
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas toBlob 失败'));
        return;
      }
      resolve(blob);
    }, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
  });
}

function hexBrightness(hex: string): number {
  if (hex === 'transparent') return 255;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return (r + g + b) / 3;
}
