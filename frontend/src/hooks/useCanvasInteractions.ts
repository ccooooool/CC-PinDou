import { useRef, useCallback, useState, useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';

export function useCanvasInteractions(
  getGridXY: (e: MouseEvent | React.MouseEvent) => { x: number; y: number } | null,
  paintCell: (x: number, y: number) => { x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> } | null,
  paintAt: (x: number, y: number, forceColor?: string, forceCodes?: Record<string, string>) => Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }>,
  floodFill: (x: number, y: number, targetColor: string, replacementColor: string) => Array<{ x: number; y: number }>,
  bresenhamLine: (x0: number, y0: number, x1: number, y1: number) => Array<{ x: number; y: number }>,
  midPointCircle: (xc: number, yc: number, r: number) => Array<{ x: number; y: number }>,
  scheduleDrawGrid: () => void,
  setShapePreview: (preview: { start: { x: number; y: number }; end: { x: number; y: number }; tool: string; enabled: boolean }) => void,
  setBrushPreview: (preview: { x: number; y: number; size: number; enabled: boolean }) => void,
  stopDrag: () => void,
  startDrag: (clientX: number, clientY: number) => void,
  onDragMove: (clientX: number, clientY: number) => void,
  spacePressed: boolean,
  isDragging: boolean,
) {
  const gridData = useEditorStore((s) => s.gridData);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const activeLayerLocked = useEditorStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.locked ?? false);
  const isImageLayer = useEditorStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.type === 'image');
  const selectedColor = useEditorStore((s) => s.selectedColor);
  const selectedColorRef = useRef(selectedColor);
  selectedColorRef.current = selectedColor;
  const magicWandSelect = useEditorStore((s) => s.magicWandSelect);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const replaceColorGlobally = useEditorStore((s) => s.replaceColorGlobally);
  const isDrawMode = useUIStore((s) => s.mode === 'draw');
  const drawTool = useUIStore((s) => s.drawTool);
  const shapeFilled = useUIStore((s) => s.shapeFilled);
  const brushSize = useUIStore((s) => s.brushSize);

  const [isBatchPainting, setIsBatchPainting] = useState(false);
  const batchPositionsRef = useRef<Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }>>([]);
  const batchPaintedSetRef = useRef(new Set<string>());

  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(isDrawing);
  isDrawingRef.current = isDrawing;
  const isBatchPaintingRef = useRef(isBatchPainting);
  isBatchPaintingRef.current = isBatchPainting;

  const gridDataRef = useRef(gridData);
  gridDataRef.current = gridData;

  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const imageDragStartRef = useRef<{ x: number; y: number; transformX: number; transformY: number } | null>(null);

  // ─── 各工具鼠标按下处理子函数 ───

  const startShapeDraw = (pos: { x: number; y: number }) => {
    setIsDrawing(true);
    drawStartRef.current = pos;
  };

  const startBatchPaint = (pos: { x: number; y: number }, forceColor?: string, forceCodes?: Record<string, string>) => {
    setIsBatchPainting(true);
    batchPositionsRef.current = [];
    batchPaintedSetRef.current = new Set();
    const records = paintAt(pos.x, pos.y, forceColor, forceCodes);
    for (const r of records) {
      const key = `${r.x},${r.y}`;
      if (!batchPaintedSetRef.current.has(key)) {
        batchPositionsRef.current.push(r);
        batchPaintedSetRef.current.add(key);
      }
    }
    scheduleDrawGrid();
  };

  const handleWandDown = (pos: { x: number; y: number }, shiftKey: boolean) => {
    magicWandSelect(pos.x, pos.y, shiftKey);
    scheduleDrawGrid();
  };

  const handleFillDown = (pos: { x: number; y: number }) => {
    const gd = gridDataRef.current;
    if (!gd) return;
    const targetColor = gd[pos.y][pos.x].color;
    const replacementColor = selectedColorRef.current?.hex || 'transparent';
    if (targetColor === replacementColor) return;
    const fillPositions = floodFill(pos.x, pos.y, targetColor, replacementColor);
    if (fillPositions.length > 0) {
      const records: Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }> = [];
      for (const p of fillPositions) {
        const record = paintCell(p.x, p.y, replacementColor, selectedColorRef.current ? { ...selectedColorRef.current.codes } : {});
        if (record) records.push(record);
      }
      if (records.length > 0) {
        pushHistory({ type: 'batch_paint', layerId: activeLayerId || 'default', positions: records });
        scheduleDrawGrid();
      }
    }
  };

  const handleReplaceDown = (pos: { x: number; y: number }) => {
    const gd = gridDataRef.current;
    if (!gd) return;
    if (!selectedColorRef.current) return;
    const sourceColor = gd[pos.y][pos.x].color;
    if (sourceColor === 'transparent' || sourceColor === selectedColorRef.current.hex) return;
    replaceColorGlobally(sourceColor, selectedColorRef.current.hex, selectedColorRef.current.codes);
    scheduleDrawGrid();
  };

  const handleImageLayerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const gd = gridDataRef.current;
      if (!gd) return;

      if (spacePressed && e.button === 0) {
        startDrag(e.clientX, e.clientY);
        e.preventDefault();
        return;
      }

      if (e.button !== 0) return;

      if (isImageLayer && !spacePressed) {
        handleImageLayerDown(e);
        e.preventDefault();
        return;
      }

      if (activeLayerLocked) return;

      const pos = getGridXY(e);
      if (!pos) return;

      if (!isDrawMode) return;

      switch (drawTool) {
        case 'wand':
          handleWandDown(pos, e.shiftKey);
          break;
        case 'fill':
          handleFillDown(pos);
          break;
        case 'line':
        case 'rect':
        case 'circle':
          startShapeDraw(pos);
          break;
        case 'replace':
          handleReplaceDown(pos);
          e.preventDefault();
          break;
        default:
          startBatchPaint(
            pos,
            drawTool === 'eraser' ? 'transparent' : undefined,
            drawTool === 'eraser' ? {} : undefined,
          );
          e.preventDefault();
          break;
      }
    },
    [
      spacePressed, activeLayerId,
      isDrawMode, drawTool, getGridXY, paintCell, paintAt, floodFill,
      pushHistory, scheduleDrawGrid, startDrag, replaceColorGlobally,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging && spacePressed) {
        onDragMove(e.clientX, e.clientY);
        return;
      }

      if (isDrawMode && (drawTool === 'pen' || drawTool === 'eraser' || drawTool === 'replace')) {
        const previewPos = getGridXY(e);
        if (previewPos) {
          setBrushPreview({ x: previewPos.x, y: previewPos.y, size: brushSize, enabled: true });
        }
      }

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

      if (!isBatchPainting || !selectedColorRef.current) return;
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
      isDrawMode, drawTool, getGridXY, paintCell, paintAt,
      scheduleDrawGrid, onDragMove, pushHistory, brushSize, setBrushPreview,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    setBrushPreview({ x: 0, y: 0, size: 1, enabled: false });
  }, [setBrushPreview]);

  const handleMouseUp = useCallback(() => {
    stopDrag();

    if (imageDragStartRef.current) {
      imageDragStartRef.current = null;
      return;
    }

    if (isDrawMode && isDrawingRef.current && drawStartRef.current) {
      setIsDrawing(false);
      const start = drawStartRef.current;
      const end = lastPosRef.current;
      drawStartRef.current = null;

      const gd = gridDataRef.current;
      if (!end || !gd || !selectedColorRef.current) return;
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
  }, [
    isDrawMode, drawTool, activeLayerId, shapeFilled,
    bresenhamLine, midPointCircle, paintCell, paintAt,
    pushHistory, scheduleDrawGrid, stopDrag, setShapePreview,
  ]);

  // 全局鼠标事件
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
      if (imageDragStartRef.current) {
        imageDragStartRef.current = null;
        return;
      }
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
    // 全局事件监听器只需在核心交互函数引用变化时重新绑定。
    // isDrawingRef/isBatchPaintingRef 等 ref 值不参与闭包，无需列入依赖。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getGridXY, scheduleDrawGrid, drawTool, pushHistory, stopDrag, setShapePreview]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    imageDragStartRef,
  };
}
