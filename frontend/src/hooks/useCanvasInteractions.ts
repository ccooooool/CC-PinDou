import { useRef, useCallback, useState, useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';
import { useConfigStore } from '../store/useConfigStore';
import { PerlerEngine } from '../engine/PerlerEngine';
import colorMappingJson from '../data/colorSystemMapping.json';
import type { ColorMapping, ColorInfo } from '../types/perler';
import { toast } from '@/components/ui/toast';

const colorMappingData = colorMappingJson as ColorMapping;

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
  const colorMode = useConfigStore((s) => s.colorMode);
  const setSelectedColor = useEditorStore((s) => s.setSelectedColor);

  const engineRef = useRef<PerlerEngine | null>(null);
  useEffect(() => {
    engineRef.current = new PerlerEngine(colorMappingData, colorMode);
  }, [colorMode]);

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
  const beadDragStartRef = useRef<{ x: number; y: number; transformX: number; transformY: number } | null>(null);

  // 选区移动
  const isSelectionMovingRef = useRef(false);
  const selectionMoveStartRef = useRef<{ x: number; y: number } | null>(null);

  // 批量绘制工具记录（用于操作记录命名）
  const drawToolRef = useRef(drawTool);
  drawToolRef.current = drawTool;
  const batchToolRef = useRef<string>('pen');

  // 吸管工具：图片图层按住预览，松开吸色
  const eyedropperPreviewRef = useRef<{ active: boolean; startX: number; startY: number } | null>(null);
  const lastPixelPosRef = useRef<{ x: number; y: number } | null>(null);

  // ─── 各工具鼠标按下处理子函数 ───

  const startShapeDraw = (pos: { x: number; y: number }) => {
    setIsDrawing(true);
    drawStartRef.current = pos;
  };

  const startBatchPaint = (pos: { x: number; y: number }, forceColor?: string, forceCodes?: Record<string, string>) => {
    setIsBatchPainting(true);
    batchPositionsRef.current = [];
    batchPaintedSetRef.current = new Set();
    batchToolRef.current = drawToolRef.current;
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
        const record = paintAt(p.x, p.y, replacementColor, selectedColorRef.current ? { ...selectedColorRef.current.codes } : {});
        if (record.length > 0) records.push(...record);
      }
      if (records.length > 0) {
        pushHistory({ type: 'batch_paint', layerId: activeLayerId || 'default', tool: 'fill', positions: records });
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

  const handleBeadLayerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    beadDragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      transformX: 0,
      transformY: 0,
    };
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

      // 吸管工具不受锁定限制（取色不修改图层）
      if (drawTool === 'eyedropper') {
        const state = useEditorStore.getState();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (!layer) return;

        if (layer.type === 'bead') {
          const pos = getGridXY(e);
          if (!pos) return;
          const gd = state.gridData;
          if (!gd) return;
          const cell = gd[pos.y]?.[pos.x];
          if (!cell || cell.color === 'transparent') {
            toast.info('该位置为透明色');
            return;
          }
          const colorInfo: ColorInfo = {
            hex: cell.color,
            count: 0,
            codes: cell.codes,
          };
          setSelectedColor(colorInfo);
          const brand = useConfigStore.getState().brand;
          toast.success(`已吸取色号 ${cell.codes[brand] || cell.color}`);
        } else if (layer.type === 'image') {
          const canvas = e.target as HTMLCanvasElement;
          const rect = canvas.getBoundingClientRect();
          const scaleX = canvas.width / rect.width;
          const scaleY = canvas.height / rect.height;
          const px = Math.floor((e.clientX - rect.left) * scaleX);
          const py = Math.floor((e.clientY - rect.top) * scaleY);
          // 按住预览，等 mouseup 时才吸色
          eyedropperPreviewRef.current = { active: true, startX: px, startY: py };
          lastPixelPosRef.current = { x: px, y: py };
        }
        e.preventDefault();
        return;
      }

      if (isImageLayer && !spacePressed && !activeLayerLocked) {
        handleImageLayerDown(e);
        e.preventDefault();
        return;
      }

      if (drawTool === 'move' && !isImageLayer && !spacePressed) {
        if (!activeLayerLocked) {
          handleBeadLayerDown(e);
          e.preventDefault();
        }
        return;
      }

      if (activeLayerLocked) return;

      const pos = getGridXY(e);
      if (!pos) return;

      if (!isDrawMode) return;

      // 画笔类工具禁止无颜色/透明绘制（透明操作只属于橡皮擦）
      if (
        (drawTool === 'pen' || drawTool === 'line' || drawTool === 'rect' || drawTool === 'circle' || drawTool === 'fill' || drawTool === 'replace') &&
        (!selectedColorRef.current || selectedColorRef.current.hex === 'transparent')
      ) {
        toast.error('请先选择一个颜色，透明绘制请使用橡皮擦');
        e.preventDefault();
        return;
      }

      switch (drawTool) {
        case 'wand': {
          const editorState = useEditorStore.getState();
          const inSelection = editorState.selectedCells.some((c) => c.x === pos.x && c.y === pos.y);
          if (editorState.selectedCells.length > 0 && inSelection) {
            isSelectionMovingRef.current = true;
            selectionMoveStartRef.current = { x: pos.x, y: pos.y };
            e.preventDefault();
          } else {
            handleWandDown(pos, e.shiftKey);
          }
          break;
        }
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
      // Image layer drag
      if (imageDragStartRef.current && e.buttons === 1) {
        const state = useEditorStore.getState();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (layer && layer.type === 'image') {
          const dx = e.clientX - imageDragStartRef.current.x;
          const dy = e.clientY - imageDragStartRef.current.y;
          state.updateImageTransform(layer.id, {
            x: imageDragStartRef.current.transformX + dx,
            y: imageDragStartRef.current.transformY + dy,
          });
          scheduleDrawGrid();
        }
        return;
      }

      // Bead layer drag (move tool) — 吸附网格 + 边界限制
      if (beadDragStartRef.current && e.buttons === 1) {
        const state = useEditorStore.getState();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (layer && layer.type === 'bead' && layer.gridData) {
          const beadSize = useConfigStore.getState().canvasConfig.beadSize;
          const pixelDx = e.clientX - beadDragStartRef.current.x;
          const pixelDy = e.clientY - beadDragStartRef.current.y;
          let gridDx = Math.round(pixelDx / beadSize);
          let gridDy = Math.round(pixelDy / beadSize);

          // 边界限制：确保所有有颜色的格子不越界
          const rows = layer.gridData.length;
          const cols = layer.gridData[0].length;
          let minDx = -Infinity, maxDx = Infinity, minDy = -Infinity, maxDy = Infinity;
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              if (layer.gridData[y][x].color === 'transparent') continue;
              minDx = Math.max(minDx, -x);
              maxDx = Math.min(maxDx, cols - 1 - x);
              minDy = Math.max(minDy, -y);
              maxDy = Math.min(maxDy, rows - 1 - y);
            }
          }
          gridDx = Math.max(minDx, Math.min(gridDx, maxDx));
          gridDy = Math.max(minDy, Math.min(gridDy, maxDy));

          state.updateBeadLayerTransform(layer.id, {
            x: gridDx * beadSize,
            y: gridDy * beadSize,
          });
          scheduleDrawGrid();
        }
        return;
      }

      // Eyedropper 预览：跟踪鼠标像素位置（图片图层按住时）
      if (eyedropperPreviewRef.current?.active && e.buttons === 1) {
        const canvas = e.target as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        lastPixelPosRef.current = {
          x: Math.floor((e.clientX - rect.left) * scaleX),
          y: Math.floor((e.clientY - rect.top) * scaleY),
        };
        return;
      }

      if (isDragging && spacePressed) {
        onDragMove(e.clientX, e.clientY);
        return;
      }

      // 画笔/橡皮/替换 + 取色器（bead 图层）显示单格预览
      const showPreview = isDrawMode && (
        drawTool === 'pen' || drawTool === 'eraser' || drawTool === 'replace' ||
        (drawTool === 'eyedropper' && !isImageLayer)
      );
      if (showPreview) {
        const previewPos = getGridXY(e);
        if (previewPos) {
          const size = drawTool === 'eyedropper' ? 1 : brushSize;
          setBrushPreview({ x: previewPos.x, y: previewPos.y, size, enabled: true });
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

      // 选区移动
      if (isSelectionMovingRef.current && pos) {
        const start = selectionMoveStartRef.current;
        if (start) {
          const dx = pos.x - start.x;
          const dy = pos.y - start.y;
          if (dx !== 0 || dy !== 0) {
            useEditorStore.getState().moveSelection(dx, dy);
            selectionMoveStartRef.current = { x: pos.x, y: pos.y };
            scheduleDrawGrid();
          }
        }
        return;
      }

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
      isDragging, spacePressed, isBatchPainting, activeLayerId, isImageLayer,
      isDrawMode, drawTool, getGridXY, paintCell, paintAt,
      scheduleDrawGrid, onDragMove, pushHistory, brushSize, setBrushPreview,
    ],
  );

  const handleMouseLeave = useCallback(() => {
    setBrushPreview({ x: 0, y: 0, size: 1, enabled: false });
  }, [setBrushPreview]);

  const sampleImagePixel = useCallback(
    (px: number, py: number): Promise<{ r: number; g: number; b: number; a: number } | null> => {
      return new Promise((resolve) => {
        const state = useEditorStore.getState();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (!layer || layer.type !== 'image') {
          resolve(null);
          return;
        }
        const { margin } = useConfigStore.getState().canvasConfig;
        const t = layer.transform;

        const img = new Image();
        img.onload = () => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.naturalWidth;
          tempCanvas.height = img.naturalHeight;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) {
            resolve(null);
            return;
          }
          tempCtx.drawImage(img, 0, 0);

          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const dx = px - margin - t.x - w / 2;
          const dy = py - margin - t.y - h / 2;
          const rad = (-t.rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rdx = dx * cos - dy * sin;
          const rdy = dx * sin + dy * cos;
          const imgX = Math.round(rdx / t.scaleX + w / 2);
          const imgY = Math.round(rdy / t.scaleY + h / 2);

          if (imgX >= 0 && imgX < img.naturalWidth && imgY >= 0 && imgY < img.naturalHeight) {
            const d = tempCtx.getImageData(imgX, imgY, 1, 1).data;
            resolve({ r: d[0], g: d[1], b: d[2], a: d[3] });
          } else {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = layer.imageUrl;
      });
    },
    [],
  );

  const handleMouseUp = useCallback(async () => {
    stopDrag();

    // Eyedropper：图片图层松开时执行吸色
    if (eyedropperPreviewRef.current?.active) {
      eyedropperPreviewRef.current.active = false;
      const px = lastPixelPosRef.current?.x ?? eyedropperPreviewRef.current.startX;
      const py = lastPixelPosRef.current?.y ?? eyedropperPreviewRef.current.startY;
      lastPixelPosRef.current = null;

      const pixel = await sampleImagePixel(px, py);
      if (pixel) {
        if (pixel.a < 128) {
          toast.info('该位置为透明色');
        } else if (engineRef.current) {
          const matchedHex = engineRef.current.nearestColor([pixel.r, pixel.g, pixel.b]);
          const codes = colorMappingData[matchedHex] || {};
          const colorInfo: ColorInfo = {
            hex: matchedHex,
            count: 0,
            codes,
          };
          setSelectedColor(colorInfo);
          const brand = useConfigStore.getState().brand;
          toast.success(`已吸取色号 ${codes[brand] || matchedHex}`);
        }
      } else {
        // 回退到主 canvas 取色（如坐标越界等情况）
        const canvasEl = document.querySelector('canvas');
        if (canvasEl) {
          const ctx2d = canvasEl.getContext('2d');
          if (ctx2d) {
            const imageData = ctx2d.getImageData(px, py, 1, 1);
            const [r, g, b, a] = imageData.data;
            if (a < 128) {
              toast.info('该位置为透明色');
            } else if (engineRef.current) {
              const matchedHex = engineRef.current.nearestColor([r, g, b]);
              const codes = colorMappingData[matchedHex] || {};
              const colorInfo: ColorInfo = {
                hex: matchedHex,
                count: 0,
                codes,
              };
              setSelectedColor(colorInfo);
              const brand = useConfigStore.getState().brand;
              toast.success(`已吸取色号 ${codes[brand] || matchedHex}`);
            }
          }
        }
      }
      return;
    }

    if (imageDragStartRef.current) {
      imageDragStartRef.current = null;
      return;
    }

    if (beadDragStartRef.current) {
      const state = useEditorStore.getState();
      const layer = state.layers.find((l) => l.id === state.activeLayerId);
      if (layer && layer.type === 'bead') {
        const beadSize = useConfigStore.getState().canvasConfig.beadSize;
        const gridDx = Math.round(layer.transform.x / beadSize);
        const gridDy = Math.round(layer.transform.y / beadSize);
        if (gridDx !== 0 || gridDy !== 0) {
          state.moveLayerContent(layer.id, gridDx, gridDy);
        }
        state.updateBeadLayerTransform(layer.id, { x: 0, y: 0 });
      }
      beadDragStartRef.current = null;
      return;
    }

    if (isDrawMode && isDrawingRef.current && drawStartRef.current) {
      setIsDrawing(false);
      const start = drawStartRef.current;
      const end = lastPosRef.current;
      drawStartRef.current = null;

      const gd = gridDataRef.current;
      if (!end || !gd || !selectedColorRef.current) {
        setShapePreview({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, tool: 'line', enabled: false });
        scheduleDrawGrid();
        return;
      }
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
        // 第一点是圆周上的角，拉开距离为直径
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const centerX = (start.x + end.x) / 2;
        const centerY = (start.y + end.y) / 2;
        const r = Math.sqrt(dx * dx + dy * dy) / 2;
        if (r > 0) {
          if (shapeFilled) {
            const minX = Math.max(0, Math.floor(centerX - r));
            const maxX = Math.min(cols - 1, Math.ceil(centerX + r));
            const minY = Math.max(0, Math.floor(centerY - r));
            const maxY = Math.min(rows - 1, Math.ceil(centerY + r));
            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                const distX = x - centerX;
                const distY = y - centerY;
                if (distX * distX + distY * distY <= r * r) {
                  points.push({ x, y });
                }
              }
            }
          } else {
            const circlePoints = midPointCircle(Math.round(centerX), Math.round(centerY), Math.round(r));
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
          pushHistory({ type: 'batch_paint', layerId: activeLayerId || 'default', tool: drawToolRef.current, positions: records });
        }
      }
      // 主动清除 shape preview，避免虚线残留
      setShapePreview({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, tool: 'line', enabled: false });
      scheduleDrawGrid();
      return;
    }

    setIsBatchPainting(false);
    if (batchPositionsRef.current.length > 0) {
      pushHistory({
        type: 'batch_paint',
        layerId: activeLayerId || 'default',
        tool: batchToolRef.current,
        positions: batchPositionsRef.current,
      });
    }
    batchPositionsRef.current = [];
    batchPaintedSetRef.current = new Set();
  }, [
    isDrawMode, drawTool, activeLayerId, shapeFilled,
    bresenhamLine, midPointCircle, paintCell, paintAt,
    pushHistory, scheduleDrawGrid, stopDrag, setShapePreview,
    sampleImagePixel,
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

    const handleGlobalMouseUp = async () => {
      // Eyedropper：在 canvas 外松开时也执行吸色
      if (eyedropperPreviewRef.current?.active) {
        eyedropperPreviewRef.current.active = false;
        const px = lastPixelPosRef.current?.x ?? eyedropperPreviewRef.current.startX;
        const py = lastPixelPosRef.current?.y ?? eyedropperPreviewRef.current.startY;
        lastPixelPosRef.current = null;

        const pixel = await sampleImagePixel(px, py);
        if (pixel) {
          if (pixel.a < 128) {
            toast.info('该位置为透明色');
          } else if (engineRef.current) {
            const matchedHex = engineRef.current.nearestColor([pixel.r, pixel.g, pixel.b]);
            const codes = colorMappingData[matchedHex] || {};
            const colorInfo: ColorInfo = {
              hex: matchedHex,
              count: 0,
              codes,
            };
            setSelectedColor(colorInfo);
            const brand = useConfigStore.getState().brand;
            toast.success(`已吸取色号 ${codes[brand] || matchedHex}`);
          }
        } else {
          const canvasEl = document.querySelector('canvas');
          if (canvasEl) {
            const ctx2d = canvasEl.getContext('2d');
            if (ctx2d) {
              const imageData = ctx2d.getImageData(px, py, 1, 1);
              const [r, g, b, a] = imageData.data;
              if (a < 128) {
                toast.info('该位置为透明色');
              } else if (engineRef.current) {
                const matchedHex = engineRef.current.nearestColor([r, g, b]);
                const codes = colorMappingData[matchedHex] || {};
                const colorInfo: ColorInfo = {
                  hex: matchedHex,
                  count: 0,
                  codes,
                };
                setSelectedColor(colorInfo);
                const brand = useConfigStore.getState().brand;
                toast.success(`已吸取色号 ${codes[brand] || matchedHex}`);
              }
            }
          }
        }
        return;
      }

      if (imageDragStartRef.current) {
        imageDragStartRef.current = null;
        return;
      }
      if (beadDragStartRef.current) {
        const state = useEditorStore.getState();
        const layer = state.layers.find((l) => l.id === state.activeLayerId);
        if (layer && layer.type === 'bead') {
          const beadSize = useConfigStore.getState().canvasConfig.beadSize;
          const gridDx = Math.round(layer.transform.x / beadSize);
          const gridDy = Math.round(layer.transform.y / beadSize);
          if (gridDx !== 0 || gridDy !== 0) {
            state.moveLayerContent(layer.id, gridDx, gridDy);
          }
          state.updateBeadLayerTransform(layer.id, { x: 0, y: 0 });
        }
        beadDragStartRef.current = null;
        return;
      }
      if (isSelectionMovingRef.current) {
        isSelectionMovingRef.current = false;
        selectionMoveStartRef.current = null;
        return;
      }
      if (isBatchPaintingRef.current || isDrawingRef.current) {
        stopDrag();
        setIsDrawing(false);
        drawStartRef.current = null;
        setIsBatchPainting(false);
        if (batchPositionsRef.current.length > 0) {
          const latestLayerId = useEditorStore.getState().activeLayerId;
          pushHistory({ type: 'batch_paint', tool: batchToolRef.current, positions: batchPositionsRef.current, layerId: latestLayerId || 'default' });
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
    beadDragStartRef,
  };
}
