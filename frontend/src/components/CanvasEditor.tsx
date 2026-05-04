import { useRef, useCallback, useState, useEffect } from 'react';
import { useEditorStore, useConfigStore, useUIStore } from '../store/usePerlerStore';
import { Grid3X3 } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { Slider } from './ui/slider';

import { useCanvasRenderer } from '../hooks/useCanvasRenderer';
import { useDrawingTools } from '../hooks/useDrawingTools';
import { usePanZoom } from '../hooks/usePanZoom';

export function CanvasEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 使用精确 selector 订阅，避免 canvasConfig/zoomLevel 等变化触发组件重渲染
  const gridData = useEditorStore((s) => s.gridData);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const activeLayerLocked = useEditorStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.locked ?? false);
  const isImageLayer = useEditorStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.type === 'image');
  const selectedColor = useEditorStore((s) => s.selectedColor);
  const magicWandSelect = useEditorStore((s) => s.magicWandSelect);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const drawGridSize = useUIStore((s) => s.drawGridSize);
  const setDrawGridSize = useUIStore((s) => s.setDrawGridSize);
  const shapeFilled = useUIStore((s) => s.shapeFilled);
  const brushSize = useUIStore((s) => s.brushSize);
  const createBlankGrid = useEditorStore((s) => s.createBlankGrid);
  const replaceColorGlobally = useEditorStore((s) => s.replaceColorGlobally);
  const beadSize = useConfigStore((s) => s.canvasConfig.beadSize);
  const margin = useConfigStore((s) => s.canvasConfig.margin);

  const { scheduleDrawGrid, getGridXY, setShapePreview, setBrushPreview } = useCanvasRenderer(canvasRef);
  const {
    paintCell,
    paintAt,
    getSymmetricPositions,
    bresenhamLine,
    midPointCircle,
    floodFill,
    isDrawMode,
    drawTool,
  } = useDrawingTools();
  const { spacePressed, isDragging, startDrag, onDragMove, stopDrag } = usePanZoom(containerRef);

  // 批量绘制状态
  const [isBatchPainting, setIsBatchPainting] = useState(false);
  const batchPositionsRef = useRef<Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }>>([]);
  const batchPaintedSetRef = useRef(new Set<string>());

  // 绘制模式状态（line/rect/circle）
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(isDrawing);
  isDrawingRef.current = isDrawing;
  const isBatchPaintingRef = useRef(isBatchPainting);
  isBatchPaintingRef.current = isBatchPainting;

  // gridData ref 避免 useCallback 重建
  const gridDataRef = useRef(gridData);
  gridDataRef.current = gridData;

  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Image 图层拖拽状态
  const imageDragStartRef = useRef<{ x: number; y: number; transformX: number; transformY: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const gd = gridDataRef.current;
      if (!gd) return;

      // Space 拖拽
      if (spacePressed && e.button === 0) {
        startDrag(e.clientX, e.clientY);
        e.preventDefault();
        return;
      }

      if (e.button !== 0) return;

      // ===== Image 图层拖拽移动 =====
      if (isImageLayer && !spacePressed) {
        const state = useEditorStore.getState();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (layer && layer.type === 'image') {
          imageDragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            transformX: layer.transform.x,
            transformY: layer.transform.y,
          };
        }
        e.preventDefault();
        return;
      }

      // ===== 图层锁定保护 =====
      if (activeLayerLocked) return;

      const pos = getGridXY(e);
      if (!pos) return;

      // ===== 绘制模式 =====
      if (isDrawMode) {
        if (drawTool === 'wand') {
          magicWandSelect(pos.x, pos.y, e.shiftKey);
          scheduleDrawGrid();
          return;
        }

        if (drawTool === 'fill') {
          const targetColor = gd[pos.y][pos.x].color;
          const replacementColor = selectedColor?.hex || 'transparent';
          if (targetColor === replacementColor) return;
          const fillPositions = floodFill(pos.x, pos.y, targetColor, replacementColor);
          if (fillPositions.length > 0) {
            const records = fillPositions.map((p) => ({
              x: p.x,
              y: p.y,
              oldColor: targetColor,
              oldCodes: { ...gd[p.y][p.x].codes },
              newColor: replacementColor,
              newCodes: selectedColor ? { ...selectedColor.codes } : {},
            }));
            for (const p of fillPositions) {
              gd[p.y][p.x].color = replacementColor;
              gd[p.y][p.x].codes = selectedColor ? { ...selectedColor.codes } : {};
            }
            pushHistory({ type: 'batch_paint', layerId: activeLayerId || 'default', positions: records });
            scheduleDrawGrid();
          }
          return;
        }

        if (drawTool === 'line' || drawTool === 'rect' || drawTool === 'circle') {
          setIsDrawing(true);
          drawStartRef.current = pos;
          return;
        }

        // replace 颜色替换
        if (drawTool === 'replace') {
          if (!selectedColor) return;
          const sourceColor = gd[pos.y][pos.x].color;
          if (sourceColor === 'transparent' || sourceColor === selectedColor.hex) return;
          replaceColorGlobally(sourceColor, selectedColor.hex, selectedColor.codes);
          scheduleDrawGrid();
          e.preventDefault();
          return;
        }

        // pen / eraser
        setIsBatchPainting(true);
        batchPositionsRef.current = [];
        batchPaintedSetRef.current = new Set();
        const forceColor = drawTool === 'eraser' ? 'transparent' : undefined;
        const forceCodes = drawTool === 'eraser' ? {} : undefined;
        const records = paintAt(pos.x, pos.y, forceColor, forceCodes);
        for (const r of records) {
          const key = `${r.x},${r.y}`;
          if (!batchPaintedSetRef.current.has(key)) {
            batchPositionsRef.current.push(r);
            batchPaintedSetRef.current.add(key);
          }
        }
        scheduleDrawGrid();
        e.preventDefault();
        return;
      }

      // ===== 普通像素模式（仅在自由绘制模式下可编辑）====
      if (!isDrawMode || !selectedColor) return;

      // 批量绘制（默认启用，按住拖动连续涂色）
      setIsBatchPainting(true);
      batchPositionsRef.current = [];
      batchPaintedSetRef.current = new Set();
      const key = `${pos.x},${pos.y}`;
      if (!batchPaintedSetRef.current.has(key)) {
        const record = paintCell(pos.x, pos.y);
        if (record) {
          batchPositionsRef.current.push(record);
          batchPaintedSetRef.current.add(key);
          scheduleDrawGrid();
        }
      }
      e.preventDefault();
    },
    [
      selectedColor, spacePressed, activeLayerId,
      isDrawMode, drawTool, getGridXY, paintCell, paintAt, floodFill,
      pushHistory, scheduleDrawGrid, startDrag, replaceColorGlobally,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Space 拖拽
      if (isDragging && spacePressed) {
        onDragMove(e.clientX, e.clientY);
        return;
      }

      // 画笔大小预览（draw 模式 pen/eraser/replace 始终跟踪）
      if (isDrawMode && (drawTool === 'pen' || drawTool === 'eraser' || drawTool === 'replace')) {
        const previewPos = getGridXY(e);
        if (previewPos) {
          setBrushPreview({ x: previewPos.x, y: previewPos.y, size: brushSize, enabled: true });
        }
      }

      // 防御性检查：鼠标左键未按下时不执行绘制
      if (e.buttons !== 1) {
        if (isBatchPainting) {
          setIsBatchPainting(false);
          if (batchPositionsRef.current.length > 0) {
            pushHistory({
              type: 'batch_paint',
              layerId: activeLayerId || 'default',
              positions: batchPositionsRef.current,
            });
          }
          batchPositionsRef.current = [];
          batchPaintedSetRef.current = new Set();
        }
        return;
      }

      const pos = getGridXY(e);
      if (!pos) return;

      // 绘制模式 pen/eraser
      if (isDrawMode && isBatchPainting) {
        const target = e.target as HTMLElement;
        if (target.tagName.toLowerCase() !== 'canvas') return;
        e.preventDefault();
        const forceColor = drawTool === 'eraser' ? 'transparent' : undefined;
        const forceCodes = drawTool === 'eraser' ? {} : undefined;
        const records = paintAt(pos.x, pos.y, forceColor, forceCodes);
        for (const r of records) {
          const key = `${r.x},${r.y}`;
          if (!batchPaintedSetRef.current.has(key)) {
            batchPositionsRef.current.push(r);
            batchPaintedSetRef.current.add(key);
          }
        }
        scheduleDrawGrid();
        return;
      }

      // non-draw mode 批量绘制
      if (!isBatchPainting || !selectedColor) return;
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() !== 'canvas') return;
      e.preventDefault();
      const key = `${pos.x},${pos.y}`;
      if (!batchPaintedSetRef.current.has(key)) {
        const record = paintCell(pos.x, pos.y);
        if (record) {
          batchPositionsRef.current.push(record);
          batchPaintedSetRef.current.add(key);
          scheduleDrawGrid();
        }
      }
    },
    [
      isDragging, spacePressed, isBatchPainting, activeLayerId,
      selectedColor, isDrawMode, drawTool, getGridXY, paintCell, paintAt,
      scheduleDrawGrid, onDragMove, pushHistory, brushSize, setBrushPreview,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    setBrushPreview({ x: 0, y: 0, size: 1, enabled: false });
  }, [setBrushPreview]);

  const handleMouseUp = useCallback(() => {
    stopDrag();

    // Image 图层拖拽结束
    if (imageDragStartRef.current) {
      imageDragStartRef.current = null;
      return;
    }

    // 绘制模式 line/rect/circle 完成
    if (isDrawMode && isDrawingRef.current && drawStartRef.current) {
      setIsDrawing(false);
      const start = drawStartRef.current;
      const end = lastPosRef.current;
      drawStartRef.current = null;

      const gd = gridDataRef.current;
      if (!end || !gd || !selectedColor) return;
      const rows = gd.length;
      const cols = gd[0].length;
      let points: Array<{ x: number; y: number }> = [];

      if (drawTool === 'line') {
        points = bresenhamLine(start.x, start.y, end.x, end.y);
      } else if (drawTool === 'rect') {
        const x0 = Math.min(start.x, end.x);
        const x1 = Math.max(start.x, end.x);
        const y0 = Math.min(start.y, end.y);
        const y1 = Math.max(start.y, end.y);
        if (shapeFilled) {
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) points.push({ x, y });
          }
        } else {
          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              if (y === y0 || y === y1 || x === x0 || x === x1) {
                points.push({ x, y });
              }
            }
          }
        }
      } else if (drawTool === 'circle') {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));
        if (r > 0) {
          if (shapeFilled) {
            for (let y = -r; y <= r; y++) {
              for (let x = -r; x <= r; x++) {
                if (x * x + y * y <= r * r) {
                  const px = start.x + x;
                  const py = start.y + y;
                  if (px >= 0 && px < cols && py >= 0 && py < rows) {
                    points.push({ x: px, y: py });
                  }
                }
              }
            }
          } else {
            const circlePoints = midPointCircle(start.x, start.y, r);
            const visited = new Set<string>();
            for (const p of circlePoints) {
              const key = `${p.x},${p.y}`;
              if (!visited.has(key) && p.x >= 0 && p.x < cols && p.y >= 0 && p.y < rows) {
                visited.add(key);
                points.push(p);
              }
            }
          }
        }
      }

      if (points.length > 0) {
        const records: Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }> = [];
        const painted = new Set<string>();
        for (const p of points) {
          if (p.x < 0 || p.x >= cols || p.y < 0 || p.y >= rows) continue;
          const recs = paintAt(p.x, p.y);
          for (const r of recs) {
            const key = `${r.x},${r.y}`;
            if (!painted.has(key)) {
              painted.add(key);
              records.push(r);
            }
          }
        }
        if (records.length > 0) {
          pushHistory({ type: 'batch_paint', layerId: activeLayerId || 'default', positions: records });
          scheduleDrawGrid();
        }
      }
      return;
    }

    // 无条件清理绘制状态
    setIsBatchPainting(false);
    if (batchPositionsRef.current.length > 0) {
      // sound removed
      pushHistory({
        type: 'batch_paint',
        layerId: activeLayerId || 'default',
        positions: batchPositionsRef.current,
      });
    }
    batchPositionsRef.current = [];
    batchPaintedSetRef.current = new Set();
  }, [
    isDrawMode, drawTool, selectedColor, activeLayerId, shapeFilled,
    bresenhamLine, midPointCircle, getSymmetricPositions, paintCell, paintAt,
    pushHistory, scheduleDrawGrid, stopDrag, setShapePreview,
  ]);

  // 全局鼠标事件：draw mode 实时预览 + canvas 外释放兜底
  // 使用 ref 读取状态，避免每次 state 变化都重新注册监听器
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDrawingRef.current) return;
      const pos = getGridXY(e);
      if (pos) lastPosRef.current = pos;

      if (drawStartRef.current && lastPosRef.current) {
        setShapePreview({
          start: drawStartRef.current,
          end: lastPosRef.current,
          tool: drawTool,
          enabled: true,
        });
      }
    };

    const handleGlobalMouseUp = () => {
      // Image 拖拽兜底
      if (imageDragStartRef.current) {
        imageDragStartRef.current = null;
        return;
      }
      // 兜底：鼠标在 canvas 外释放时也要清理状态
      if (isBatchPaintingRef.current || isDrawingRef.current) {
        stopDrag();
        setIsDrawing(false);
        drawStartRef.current = null;
        setIsBatchPainting(false);
        if (batchPositionsRef.current.length > 0) {
          const latestLayerId = useEditorStore.getState().activeLayerId;
          pushHistory({ type: 'batch_paint', positions: batchPositionsRef.current, layerId: latestLayerId || 'default' });
        }
        batchPositionsRef.current = [];
        batchPaintedSetRef.current = new Set();
        setShapePreview({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, tool: 'line', enabled: false });
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getGridXY, scheduleDrawGrid, margin, beadSize, drawTool, pushHistory, stopDrag, setShapePreview]);

  if (!gridData && !isDrawMode) {
    return (
      <Card color="default" className="dop-panel">
        <div className="flex items-center justify-center h-80 text-sm font-bold text-[var(--text-muted)]">
          请先生成拼豆图案
        </div>
      </Card>
    );
  }

  // draw 模式空画板：中间显示创建画板
  if (!gridData && isDrawMode) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <Card color="default" className="dop-panel w-80 px-7 py-6">
          <div className="text-base font-bold text-[var(--text-main)] mb-4 text-center">
            创建空白画板
          </div>
          <div className="flex items-center gap-2.5 mb-4">
            <label className="text-xs font-bold text-[var(--text-muted)] flex-shrink-0">尺寸</label>
            <Slider
              value={[drawGridSize]}
              onValueChange={([v]) => setDrawGridSize(v)}
              min={8}
              max={128}
              step={1}
            />
            <span className="text-sm font-bold text-[var(--dop-coral)] min-w-[40px]">
              {drawGridSize}×{drawGridSize}
            </span>
          </div>
          <Button variant="primary" block onClick={() => createBlankGrid(drawGridSize)}>
            <Grid3X3 className="w-4 h-4" />
            新建画板
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto max-h-full max-w-full"
      style={{
        cursor: spacePressed
          ? (isDragging ? 'grabbing' : 'grab')
          : isImageLayer
            ? 'move'
            : activeLayerLocked
              ? 'not-allowed'
              : isDrawMode
                ? 'crosshair'
                : 'default',
      }}
    >
      <div className="dop-canvas">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="block flex-shrink-0"
        />
      </div>
    </div>
  );
}
