import { useRef, useCallback, useEffect } from 'react';
import { useEditorStore, useConfigStore, useUIStore } from '../store/usePerlerStore';
import type { GridCell, PerlerLayer } from '../types/perler';

export function useCanvasRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  // 使用精确 selector 订阅，避免单字段更新触发整个 hook 重执行
  const gridData = useEditorStore((s) => s.gridData);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const isolatedCells = useEditorStore((s) => s.isolatedCells);
  const unstableCells = useEditorStore((s) => s.unstableCells);
  const selectedCells = useEditorStore((s) => s.selectedCells);
  const brand = useConfigStore((s) => s.brand);
  const canvasConfig = useConfigStore((s) => s.canvasConfig);
  const mode = useUIStore((s) => s.mode);
  const symmetryMode = useUIStore((s) => s.symmetryMode);
  const previewMode = useUIStore((s) => s.previewMode);

  const { beadSize, margin, zoomLevel, showCode, circleMode, showMarkLines, markInterval } = canvasConfig;

  const drawGridPendingRef = useRef(false);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // Shape 预览（line/rect/circle）
  const shapePreviewRef = useRef<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    tool: string;
    enabled: boolean;
  }>({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, tool: 'line', enabled: false });

  // 画笔大小预览（pen/eraser/replace）
  const brushPreviewRef = useRef<{
    x: number;
    y: number;
    size: number;
    enabled: boolean;
  }>({ x: 0, y: 0, size: 1, enabled: false });

  // 缓存透明 pattern，避免每次 drawGrid 都重新创建
  const patternCacheRef = useRef<{
    pattern: CanvasPattern | null;
    ctx: CanvasRenderingContext2D | null;
  }>({ pattern: null, ctx: null });

  // 缓存已加载的图片，避免每帧重新加载
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const getTransparentPattern = useCallback((context: CanvasRenderingContext2D) => {
    if (patternCacheRef.current.pattern && patternCacheRef.current.ctx === context) {
      return patternCacheRef.current.pattern;
    }
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 8;
    pCanvas.height = 8;
    const pCtx = pCanvas.getContext('2d')!;
    pCtx.fillStyle = '#FFFFFF';
    pCtx.fillRect(0, 0, 8, 8);
    pCtx.fillStyle = '#f3f4f6';
    pCtx.fillRect(0, 0, 4, 4);
    pCtx.fillRect(4, 4, 4, 4);
    const pattern = context.createPattern(pCanvas, 'repeat')!;
    patternCacheRef.current = { pattern, ctx: context };
    return pattern;
  }, []);

  // 缓存亮度计算结果
  const brightnessCacheRef = useRef<Map<string, number>>(new Map());

  const getBrightness = useCallback((hexColor: string): number => {
    const cached = brightnessCacheRef.current.get(hexColor);
    if (cached !== undefined) return cached;

    let brightness: number;
    if (hexColor === 'transparent') {
      brightness = 255;
    } else {
      const r = parseInt(hexColor.substr(1, 2), 16);
      const g = parseInt(hexColor.substr(3, 2), 16);
      const b = parseInt(hexColor.substr(5, 2), 16);
      brightness = (r + g + b) / 3;
    }
    brightnessCacheRef.current.set(hexColor, brightness);
    return brightness;
  }, []);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 确定尺寸来源：优先 gridData（激活图层视图），否则从 layers 找第一个可见 bead 图层
    const sizeSource = gridData || (layers.find((l) => l.type === 'bead' && l.visible) as import('../types/perler').BeadLayer | undefined)?.gridData;
    if (!sizeSource) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = sizeSource.length;
    const cols = sizeSource[0]?.length || 0;
    const width = cols * beadSize + margin * 2;
    const height = rows * beadSize + margin * 2;

    const sizeChanged = canvasSizeRef.current.width !== width || canvasSizeRef.current.height !== height;
    if (sizeChanged) {
      canvas.width = width;
      canvas.height = height;
      canvasSizeRef.current = { width, height };
      // 尺寸变化时清空缓存
      patternCacheRef.current = { pattern: null, ctx: null };
      brightnessCacheRef.current.clear();
    }
    canvas.style.width = width * zoomLevel + 'px';
    canvas.style.height = height * zoomLevel + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const transparentPattern = getTransparentPattern(ctx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Arial';
    ctx.fillStyle = '#6b7280';

    // 坐标轴标签
    for (let i = 0; i < cols; i++) {
      ctx.fillText(String(i + 1), margin + i * beadSize + beadSize / 2, margin / 2);
    }
    for (let i = 0; i < rows; i++) {
      ctx.fillText(String(i + 1), margin / 2, margin + i * beadSize + beadSize / 2);
    }

    // 棋盘格背景（bead 区域，供透明格子透出下方图层）
    ctx.fillStyle = transparentPattern;
    ctx.fillRect(margin, margin, cols * beadSize, rows * beadSize);

    // ========== 多图层渲染 ==========
    const visibleLayers = [...layers].filter((l) => l.visible).sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of visibleLayers) {
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;

      if (layer.type === 'bead' && layer.gridData) {
        if (previewMode === '3d') {
          draw3DBeads(ctx, layer.gridData, beadSize, margin, showCode, brand, getBrightness);
        } else {
          drawNormalBeads(ctx, layer.gridData, beadSize, margin, circleMode, showCode, brand, getBrightness);
        }
      } else if (layer.type === 'image') {
        drawImageLayer(ctx, layer, margin, imageCacheRef.current);
      }

      ctx.restore();

      // 激活图层高亮边框（仅 bead 图层）
      if (layer.id === activeLayerId && layer.type === 'bead' && layer.gridData) {
        const lRows = layer.gridData.length;
        const lCols = layer.gridData[0]?.length || 0;
        ctx.save();
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(margin - 1, margin - 1, lCols * beadSize + 2, lRows * beadSize + 2);
        ctx.restore();
      }
    }

    // 网格线
    drawGridLines(ctx, rows, cols, beadSize, margin, showMarkLines, markInterval);

    // 标记孤立像素
    if (isolatedCells.length > 0) {
      ctx.fillStyle = '#ef4444';
      for (const { x, y } of isolatedCells) {
        const cx = margin + x * beadSize + beadSize / 2;
        const cy = margin + y * beadSize + beadSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, beadSize / 6), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 标记不稳定结构
    if (unstableCells.length > 0) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      const marked = new Set<string>();
      for (const { x, y } of unstableCells) {
        const key = `${x},${y}`;
        if (marked.has(key)) continue;
        marked.add(key);
        const px = margin + x * beadSize;
        const py = margin + y * beadSize;
        ctx.strokeRect(px + 1, py + 1, beadSize - 2, beadSize - 2);
      }
    }

    // 对称轴标识线（仅在自由绘制模式下显示）
    if (mode === 'draw' && symmetryMode !== 'none') {
      drawSymmetryLines(ctx, rows, cols, beadSize, margin, symmetryMode);
    }

    // 魔法棒选区高亮
    if (selectedCells.length > 0) {
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      for (const { x, y } of selectedCells) {
        const px = margin + x * beadSize;
        const py = margin + y * beadSize;
        ctx.strokeRect(px + 1, py + 1, beadSize - 2, beadSize - 2);
      }
      ctx.setLineDash([]);
    }

    // 绘制 Shape 预览（line/rect/circle）
    if (shapePreviewRef.current.enabled) {
      const { start, end, tool } = shapePreviewRef.current;
      ctx.save();
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      if (tool === 'line') {
        const x1 = margin + start.x * beadSize + beadSize / 2;
        const y1 = margin + start.y * beadSize + beadSize / 2;
        const x2 = margin + end.x * beadSize + beadSize / 2;
        const y2 = margin + end.y * beadSize + beadSize / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      } else if (tool === 'rect') {
        const x0 = Math.min(start.x, end.x);
        const x1 = Math.max(start.x, end.x);
        const y0 = Math.min(start.y, end.y);
        const y1 = Math.max(start.y, end.y);
        const px = margin + x0 * beadSize;
        const py = margin + y0 * beadSize;
        const pw = (x1 - x0 + 1) * beadSize;
        const ph = (y1 - y0 + 1) * beadSize;
        ctx.strokeRect(px - 0.5, py - 0.5, pw + 1, ph + 1);
      } else if (tool === 'circle') {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const rPx = Math.round(Math.sqrt(dx * dx + dy * dy)) * beadSize;
        const cx = margin + start.x * beadSize + beadSize / 2;
        const cy = margin + start.y * beadSize + beadSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 画笔大小预览（pen/eraser/replace brush）
    if (brushPreviewRef.current.enabled) {
      const { x, y, size } = brushPreviewRef.current;
      const half = Math.floor(size / 2);
      const px = margin + (x - half) * beadSize;
      const py = margin + (y - half) * beadSize;
      const pw = size * beadSize;
      const ph = size * beadSize;

      ctx.save();
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);

      if (canvasConfig.circleMode) {
        const cx = px + pw / 2;
        const cy = py + ph / 2;
        const r = Math.min(pw, ph) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      }

      // 中心十字
      const cx = margin + x * beadSize + beadSize / 2;
      const cy = margin + y * beadSize + beadSize / 2;
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx + 4, cy);
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy + 4);
      ctx.stroke();

      ctx.restore();
    }
  }, [gridData, layers, activeLayerId, canvasConfig, brand, isolatedCells, unstableCells, selectedCells, previewMode, mode, symmetryMode, canvasRef, getTransparentPattern, getBrightness]);

  const scheduleDrawGrid = useCallback(() => {
    if (drawGridPendingRef.current) return;
    drawGridPendingRef.current = true;
    requestAnimationFrame(() => {
      drawGridPendingRef.current = false;
      drawGrid();
    });
  }, [drawGrid]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  // 预加载 Image 图层中的图片
  useEffect(() => {
    let changed = false;
    for (const layer of layers) {
      if (layer.type === 'image' && !imageCacheRef.current.has(layer.imageUrl)) {
        const img = new Image();
        img.src = layer.imageUrl;
        img.onload = () => {
          imageCacheRef.current.set(layer.imageUrl, img);
          scheduleDrawGrid();
        };
        img.onerror = () => {
          imageCacheRef.current.set(layer.imageUrl, img);
        };
        imageCacheRef.current.set(layer.imageUrl, img);
        changed = true;
      }
    }
    if (changed) scheduleDrawGrid();
  }, [layers, scheduleDrawGrid]);

  const getGridXY = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!gridData || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const x = Math.floor((canvasX - margin) / beadSize);
    const y = Math.floor((canvasY - margin) / beadSize);
    if (x >= 0 && x < (gridData[0]?.length || 0) && y >= 0 && y < gridData.length) {
      return { x, y };
    }
    return null;
  }, [gridData, beadSize, margin, canvasRef]);

  const setShapePreview = useCallback(
    (preview: { start: { x: number; y: number }; end: { x: number; y: number }; tool: string; enabled: boolean }) => {
      shapePreviewRef.current = preview;
      scheduleDrawGrid();
    },
    [scheduleDrawGrid],
  );

  const setBrushPreview = useCallback(
    (preview: { x: number; y: number; size: number; enabled: boolean }) => {
      brushPreviewRef.current = preview;
      scheduleDrawGrid();
    },
    [scheduleDrawGrid],
  );

  return { scheduleDrawGrid, getGridXY, setShapePreview, setBrushPreview };
}

// --- module-level helpers (no React deps) ---

function draw3DBeads(
  ctx: CanvasRenderingContext2D,
  gridData: GridCell[][],
  beadSize: number,
  margin: number,
  showCode: boolean,
  brand: string,
  getBrightness: (hex: string) => number,
) {
  const rows = gridData.length;
  const cols = gridData[0].length;
  const holeRatio = 0.35; // 孔径占外径的比例，模拟真实拼豆空心圆柱体

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = gridData[y][x];
      const px = margin + x * beadSize;
      const py = margin + y * beadSize;
      const cx = px + beadSize / 2;
      const cy = py + beadSize / 2;
      const outerR = beadSize / 2 - 1;
      const innerR = outerR * holeRatio;

      if (cell.color === 'transparent') {
        continue; // 透明格子不绘制，透出下方图层或棋盘格背景
      }

      // 绘制外圆（bead 顶面），使用径向渐变模拟 3D 圆柱体效果
      const grad = ctx.createRadialGradient(
        cx - outerR * 0.25,
        cy - outerR * 0.25,
        innerR,
        cx,
        cy,
        outerR
      );
      grad.addColorStop(0, lightenColor(cell.color, 30));
      grad.addColorStop(0.6, cell.color);
      grad.addColorStop(1, darkenColor(cell.color, 20));

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // 外圆边缘描边，增加立体感
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = darkenColor(cell.color, 30);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 绘制内孔（空心圆柱体的开口）
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();

      // 孔的内边缘高光（模拟圆柱体内壁反光）
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 孔的左上方额外高光（模拟光源方向）
      ctx.beginPath();
      ctx.arc(cx - innerR * 0.15, cy - innerR * 0.15, innerR * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      if (showCode && cell.codes[brand]) {
        const code = cell.codes[brand];
        const brightness = getBrightness(cell.color);
        ctx.fillStyle = brightness > 128 ? '#374151' : '#FFFFFF';
        ctx.fillText(code, cx, cy);
      }
    }
  }
}

/** 调整 hex 颜色亮度：amount > 0 变亮，amount < 0 变暗 */
function adjustColorChannel(channel: number, amount: number): number {
  return Math.max(0, Math.min(255, channel + amount));
}

function lightenColor(hex: string, amount: number): string {
  const r = parseInt(hex.substr(1, 2), 16);
  const g = parseInt(hex.substr(3, 2), 16);
  const b = parseInt(hex.substr(5, 2), 16);
  return `rgb(${adjustColorChannel(r, amount)}, ${adjustColorChannel(g, amount)}, ${adjustColorChannel(b, amount)})`;
}

function darkenColor(hex: string, amount: number): string {
  return lightenColor(hex, -amount);
}

function drawNormalBeads(
  ctx: CanvasRenderingContext2D,
  gridData: GridCell[][],
  beadSize: number,
  margin: number,
  circleMode: boolean,
  showCode: boolean,
  brand: string,
  getBrightness: (hex: string) => number,
) {
  const rows = gridData.length;
  const cols = gridData[0].length;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = gridData[y][x];
      const px = margin + x * beadSize;
      const py = margin + y * beadSize;
      if (cell.color === 'transparent') {
        continue; // 透明格子不绘制，透出下方图层或棋盘格背景
      }

      if (circleMode) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(px, py, beadSize, beadSize);
        const cx = px + beadSize / 2;
        const cy = py + beadSize / 2;
        const r = beadSize / 2 - 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.fillStyle = '#f3f4f6';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = cell.color;
        ctx.fill();
      } else {
        ctx.fillStyle = cell.color;
        ctx.fillRect(px, py, beadSize, beadSize);
      }
      if (showCode && cell.codes[brand]) {
        const code = cell.codes[brand];
        const brightness = getBrightness(cell.color);
        ctx.fillStyle = brightness > 128 ? '#374151' : '#FFFFFF';
        ctx.fillText(code, px + beadSize / 2, py + beadSize / 2);
      }
    }
  }
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  rows: number,
  cols: number,
  beadSize: number,
  margin: number,
  showMarkLines: boolean,
  markInterval: number,
) {
  for (let i = 0; i <= rows; i++) {
    const isMark = showMarkLines && i > 0 && i % markInterval === 0;
    ctx.strokeStyle = isMark ? '#6b7280' : '#e5e7eb';
    ctx.lineWidth = isMark ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(margin, margin + i * beadSize);
    ctx.lineTo(margin + cols * beadSize, margin + i * beadSize);
    ctx.stroke();
  }
  for (let i = 0; i <= cols; i++) {
    const isMark = showMarkLines && i > 0 && i % markInterval === 0;
    ctx.strokeStyle = isMark ? '#6b7280' : '#e5e7eb';
    ctx.lineWidth = isMark ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(margin + i * beadSize, margin);
    ctx.lineTo(margin + i * beadSize, margin + rows * beadSize);
    ctx.stroke();
  }
}

function drawSymmetryLines(
  ctx: CanvasRenderingContext2D,
  rows: number,
  cols: number,
  beadSize: number,
  margin: number,
  symmetryMode: string,
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(156, 163, 175, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  const left = margin;
  const top = margin;
  const right = margin + cols * beadSize;
  const bottom = margin + rows * beadSize;

  switch (symmetryMode) {
    case 'horizontal': {
      const midY = top + (rows * beadSize) / 2;
      ctx.beginPath();
      ctx.moveTo(left, midY);
      ctx.lineTo(right, midY);
      ctx.stroke();
      break;
    }
    case 'vertical': {
      const midX = left + (cols * beadSize) / 2;
      ctx.beginPath();
      ctx.moveTo(midX, top);
      ctx.lineTo(midX, bottom);
      ctx.stroke();
      break;
    }
    case 'quad': {
      const midX = left + (cols * beadSize) / 2;
      const midY = top + (rows * beadSize) / 2;
      ctx.beginPath();
      ctx.moveTo(left, midY);
      ctx.lineTo(right, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, top);
      ctx.lineTo(midX, bottom);
      ctx.stroke();
      break;
    }
    case 'diagonal': {
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, bottom);
      ctx.stroke();
      break;
    }
    case 'diagonal_anti': {
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(right, top);
      ctx.stroke();
      break;
    }
    case 'diagonal_quad': {
      // 主对角
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, bottom);
      ctx.stroke();
      // 反对角
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(right, top);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  layer: PerlerLayer & { type: 'image' },
  margin: number,
  imageCache: Map<string, HTMLImageElement>,
) {
  const img = imageCache.get(layer.imageUrl);
  if (!img || !img.complete || img.naturalWidth === 0) return;

  ctx.save();
  const centerX = margin + layer.transform.x;
  const centerY = margin + layer.transform.y;
  ctx.translate(centerX, centerY);
  ctx.rotate((layer.transform.rotation * Math.PI) / 180);
  ctx.scale(layer.transform.scale, layer.transform.scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}
