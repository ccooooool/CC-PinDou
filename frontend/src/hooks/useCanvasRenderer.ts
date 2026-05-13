import { useRef, useCallback, useEffect, useMemo } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import { useUIStore } from '../store/useUIStore';
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

  const { beadSize, margin, zoomLevel, showCode, circleMode, showMarkLines, markInterval } = canvasConfig;

  // ========== 缓存 Refs ==========
  const drawGridPendingRef = useRef(false);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;

  // 将频繁变化但不影响 drawGrid 函数引用稳定性的状态改为 ref 读取
  // 避免 isolatedCells/unstableCells/selectedCells 变化时触发全量重绘
  const isolatedCellsRef = useRef(isolatedCells);
  isolatedCellsRef.current = isolatedCells;
  const unstableCellsRef = useRef(unstableCells);
  unstableCellsRef.current = unstableCells;
  const selectedCellsRef = useRef(selectedCells);
  selectedCellsRef.current = selectedCells;

  // 圆形 bead 离屏缓存：key = `${beadSize}-${color}`
  const beadCircleCacheRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  // 透明 pattern 缓存
  const patternCacheRef = useRef<{
    pattern: CanvasPattern | null;
    ctx: CanvasRenderingContext2D | null;
  }>({ pattern: null, ctx: null });
  // 亮度缓存
  const brightnessCacheRef = useRef<Map<string, number>>(new Map());
  // 图片缓存
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

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

  // ========== 缓存清理：beadSize 变化时清空形状缓存，限制缓存大小 ==========
  const lastBeadSizeRef = useRef(beadSize);
  if (lastBeadSizeRef.current !== beadSize) {
    lastBeadSizeRef.current = beadSize;
    beadCircleCacheRef.current.clear();
  }
  // 限制圆形 bead 缓存数量，防止内存无限增长
  const MAX_BEAD_CIRCLE_CACHE = 512;
  if (beadCircleCacheRef.current.size > MAX_BEAD_CIRCLE_CACHE) {
    beadCircleCacheRef.current.clear();
  }

  // ========== 可见图层缓存 ==========
  const visibleLayers = useMemo(
    () => [...layers].filter((l) => l.visible).sort((a, b) => a.zIndex - b.zIndex),
    [layers],
  );

  // ========== 辅助函数 ==========
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

  const getBrightness = useCallback((hexColor: string): number => {
    const cached = brightnessCacheRef.current.get(hexColor);
    if (cached !== undefined) return cached;
    let brightness: number;
    if (hexColor === 'transparent') {
      brightness = 255;
    } else {
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      brightness = (r + g + b) / 3;
    }
    brightnessCacheRef.current.set(hexColor, brightness);
    return brightness;
  }, []);

  // ========== 圆形 Bead 离屏缓存 ==========
  const getCircleBeadCanvas = useCallback(
    (size: number, color: string): HTMLCanvasElement => {
      const key = `${size}-${color}`;
      let canvas = beadCircleCacheRef.current.get(key);
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2 - 1;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.beginPath();
        ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.fillStyle = '#f3f4f6';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        beadCircleCacheRef.current.set(key, canvas);
      }
      return canvas;
    },
    [],
  );

  // ========== 主绘制函数 ==========
  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sizeSource =
      gridData ||
      (layers.find((l) => l.type === 'bead' && l.visible) as import('../types/perler').BeadLayer | undefined)?.gridData;
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
      patternCacheRef.current = { pattern: null, ctx: null };
      brightnessCacheRef.current.clear();
    }
    // zoomLevel 用 ref 读取，避免 zoom 变化触发重绘
    canvas.style.width = width * zoomLevelRef.current + 'px';
    canvas.style.height = height * zoomLevelRef.current + 'px';

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const transparentPattern = getTransparentPattern(ctx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "12px 'WenYuanRounded', 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = '#6b7280';

    // 坐标轴标签
    for (let i = 0; i < cols; i++) {
      ctx.fillText(String(i + 1), margin + i * beadSize + beadSize / 2, margin / 2);
    }
    for (let i = 0; i < rows; i++) {
      ctx.fillText(String(i + 1), margin / 2, margin + i * beadSize + beadSize / 2);
    }

    // 棋盘格背景
    ctx.fillStyle = transparentPattern;
    ctx.fillRect(margin, margin, cols * beadSize, rows * beadSize);

    // ========== 多图层渲染 ==========
    for (const layer of visibleLayers) {
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;

      if (layer.type === 'bead' && layer.gridData) {
        drawNormalBeads({
          ctx,
          gridData: layer.gridData,
          beadSize,
          margin,
          circleMode,
          showCode,
          brand,
          getBrightness,
          getCircleBeadCanvas,
        });
      } else if (layer.type === 'image') {
        drawImageLayer(ctx, layer, margin, imageCacheRef.current);
      }

      ctx.restore();

      // 激活图层高亮边框
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

    // 孤立像素标记
    const _isolatedCells = isolatedCellsRef.current;
    if (_isolatedCells.length > 0) {
      ctx.fillStyle = '#ef4444';
      for (const { x, y } of _isolatedCells) {
        const cx = margin + x * beadSize + beadSize / 2;
        const cy = margin + y * beadSize + beadSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, beadSize / 6), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 不稳定结构标记
    const _unstableCells = unstableCellsRef.current;
    if (_unstableCells.length > 0) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      const marked = new Set<string>();
      for (const { x, y } of _unstableCells) {
        const key = `${x},${y}`;
        if (marked.has(key)) continue;
        marked.add(key);
        const px = margin + x * beadSize;
        const py = margin + y * beadSize;
        ctx.strokeRect(px + 1, py + 1, beadSize - 2, beadSize - 2);
      }
    }

    // 对称轴标识线
    if (mode === 'draw' && symmetryMode !== 'none') {
      drawSymmetryLines(ctx, rows, cols, beadSize, margin, symmetryMode);
    }

    // 魔法棒选区高亮
    const _selectedCells = selectedCellsRef.current;
    if (_selectedCells.length > 0) {
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      for (const { x, y } of _selectedCells) {
        const px = margin + x * beadSize;
        const py = margin + y * beadSize;
        ctx.strokeRect(px + 1, py + 1, beadSize - 2, beadSize - 2);
      }
      ctx.setLineDash([]);
    }

    // Shape 预览
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

    // 画笔大小预览
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

      if (circleMode) {
        const cx = px + pw / 2;
        const cy = py + ph / 2;
        const r = Math.min(pw, ph) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      }

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
  }, [
    gridData,
    layers,
    visibleLayers,
    activeLayerId,
    beadSize,
    margin,
    showCode,
    circleMode,
    showMarkLines,
    markInterval,
    brand,
    mode,
    symmetryMode,
    canvasRef,
    getTransparentPattern,
    getBrightness,
    getCircleBeadCanvas,
  ]);

  const scheduleDrawGrid = useCallback(() => {
    if (drawGridPendingRef.current) return;
    drawGridPendingRef.current = true;
    requestAnimationFrame(() => {
      drawGridPendingRef.current = false;
      drawGrid();
    });
  }, [drawGrid]);

  // 数据变化时自动重绘
  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  // zoomLevel 变化时只更新 CSS 尺寸，不触发重绘
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sizeSource =
      gridData ||
      (layers.find((l) => l.type === 'bead' && l.visible) as import('../types/perler').BeadLayer | undefined)?.gridData;
    if (!sizeSource) return;
    const rows = sizeSource.length;
    const cols = sizeSource[0]?.length || 0;
    const width = cols * beadSize + margin * 2;
    const height = rows * beadSize + margin * 2;
    canvas.style.width = width * zoomLevel + 'px';
    canvas.style.height = height * zoomLevel + 'px';
  }, [zoomLevel, beadSize, margin, gridData, layers, canvasRef]);

  // 预加载 Image 图层中的图片，并清理已删除图层的缓存
  useEffect(() => {
    const activeImageUrls = new Set(
      layers.filter((l) => l.type === 'image').map((l) => l.imageUrl)
    );
    // 清理已不在图层中的图片缓存
    for (const url of imageCacheRef.current.keys()) {
      if (!activeImageUrls.has(url)) {
        imageCacheRef.current.delete(url);
      }
    }
    let changed = false;
    for (const layer of layers) {
      if (layer.type === 'image' && !imageCacheRef.current.has(layer.imageUrl)) {
        const url = layer.imageUrl;
        const img = new Image();
        img.src = url;
        img.onload = () => {
          // 验证该 URL 仍属于当前活跃图层，避免 stale closure 写入错误缓存
          const stillActive = layers.some((l) => l.type === 'image' && l.imageUrl === url);
          if (stillActive) {
            imageCacheRef.current.set(url, img);
            scheduleDrawGrid();
          }
        };
        img.onerror = () => {
          const stillActive = layers.some((l) => l.type === 'image' && l.imageUrl === url);
          if (stillActive) {
            imageCacheRef.current.set(url, img);
          }
        };
        imageCacheRef.current.set(url, img);
        changed = true;
      }
    }
    if (changed) scheduleDrawGrid();
  }, [layers, scheduleDrawGrid]);

  const getGridXY = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
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
    },
    [gridData, beadSize, margin, canvasRef],
  );

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

// ========== 模块级绘制函数 ==========

interface DrawNormalBeadsOptions {
  ctx: CanvasRenderingContext2D;
  gridData: GridCell[][];
  beadSize: number;
  margin: number;
  circleMode: boolean;
  showCode: boolean;
  brand: string;
  getBrightness: (hex: string) => number;
  getCircleBeadCanvas: (size: number, color: string) => HTMLCanvasElement;
}

function drawNormalBeads(options: DrawNormalBeadsOptions) {
  const { ctx, gridData, beadSize, margin, circleMode, showCode, brand, getBrightness, getCircleBeadCanvas } = options;
  if (!gridData.length || !gridData[0]) return;
  const rows = gridData.length;
  const cols = gridData[0].length;

  if (circleMode) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = gridData[y][x];
        if (cell.color === 'transparent') continue;
        const px = margin + x * beadSize;
        const py = margin + y * beadSize;
        const beadCanvas = getCircleBeadCanvas(beadSize, cell.color);
        ctx.drawImage(beadCanvas, px, py);
        if (showCode && cell.codes[brand]) {
          const code = cell.codes[brand];
          const brightness = getBrightness(cell.color);
          ctx.fillStyle = brightness > 128 ? '#374151' : '#FFFFFF';
          ctx.fillText(code, px + beadSize / 2, py + beadSize / 2);
        }
      }
    }
  } else {
    // 方形模式：fillRect 已经极快，无需缓存
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = gridData[y][x];
        const px = margin + x * beadSize;
        const py = margin + y * beadSize;
        if (cell.color === 'transparent') continue;
        ctx.fillStyle = cell.color;
        ctx.fillRect(px, py, beadSize, beadSize);
        if (showCode && cell.codes[brand]) {
          const code = cell.codes[brand];
          const brightness = getBrightness(cell.color);
          ctx.fillStyle = brightness > 128 ? '#374151' : '#FFFFFF';
          ctx.fillText(code, px + beadSize / 2, py + beadSize / 2);
        }
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
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, bottom);
      ctx.stroke();
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
