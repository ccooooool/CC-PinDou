import { useCallback } from 'react';
import { useEditorStore, useUIStore } from '../store/usePerlerStore';

export interface PaintRecord {
  x: number;
  y: number;
  oldColor: string;
  oldCodes: Record<string, string>;
  newColor: string;
  newCodes: Record<string, string>;
}

export function useDrawingTools() {
  const { gridData, selectedColor } = useEditorStore();
  const { brushSize, symmetryMode, mode, drawTool, replaceMode, replaceSourceColor, replaceTargetColor, replaceTargetCodes } = useUIStore();
  const isDrawMode = mode === 'draw';

  const paintCell = useCallback(
    (x: number, y: number, forceColor?: string, forceCodes?: Record<string, string>): PaintRecord | null => {
      if (!gridData) return null;
      const cell = gridData[y][x];
      const oldColor = cell.color;
      const oldCodes = { ...cell.codes };

      let newColor: string;
      let newCodes: Record<string, string>;

      // 替换画笔模式：仅将源色替换为目标色
      if (drawTool === 'replace' && replaceMode === 'brush') {
        if (oldColor !== replaceSourceColor) return null;
        newColor = replaceTargetColor || 'transparent';
        newCodes = replaceTargetCodes || {};
      } else {
        newColor = forceColor !== undefined ? forceColor : selectedColor?.hex || 'transparent';
        newCodes = forceColor !== undefined ? (forceCodes || {}) : (selectedColor ? { ...selectedColor.codes } : {});
      }

      if (oldColor === newColor) return null;
      cell.color = newColor;
      cell.codes = newCodes;
      return { x, y, oldColor, oldCodes, newColor, newCodes };
    },
    [gridData, selectedColor, drawTool, replaceMode, replaceSourceColor, replaceTargetColor, replaceTargetCodes],
  );

  const getSymmetricPositions = useCallback(
    (x: number, y: number) => {
      if (!gridData || symmetryMode === 'none') return [{ x, y }];
      const rows = gridData.length;
      const cols = gridData[0]?.length || 0;
      const positions = new Map<string, { x: number; y: number }>();
      positions.set(`${x},${y}`, { x, y });

      const add = (px: number, py: number) => {
        if (px >= 0 && px < cols && py >= 0 && py < rows) {
          positions.set(`${px},${py}`, { x: px, y: py });
        }
      };

      switch (symmetryMode) {
        case 'horizontal':
          add(x, rows - 1 - y);
          break;
        case 'vertical':
          add(cols - 1 - x, y);
          break;
        case 'quad':
          add(x, rows - 1 - y);
          add(cols - 1 - x, y);
          add(cols - 1 - x, rows - 1 - y);
          break;
        case 'diagonal':
          if (x !== y) add(y, x);
          break;
        case 'diagonal_anti':
          if (x + y !== cols - 1) add(cols - 1 - y, rows - 1 - x);
          break;
        case 'diagonal_quad': {
          // 主对角 y=x
          if (x !== y) add(y, x);
          // 反对角 y=cols-1-x
          if (x + y !== cols - 1) add(cols - 1 - y, rows - 1 - x);
          // quad 中心对称
          if (x !== cols - 1 - x || y !== rows - 1 - y) {
            add(cols - 1 - x, rows - 1 - y);
          }
          break;
        }
      }
      return Array.from(positions.values());
    },
    [gridData, symmetryMode],
  );

  const paintAt = useCallback(
    (cx: number, cy: number, forceColor?: string, forceCodes?: Record<string, string>): PaintRecord[] => {
      if (!gridData) return [];
      const records: PaintRecord[] = [];
      const half = Math.floor((isDrawMode ? brushSize : 1) / 2);
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const bx = cx + dx;
          const by = cy + dy;
          if (by < 0 || by >= gridData.length || bx < 0 || bx >= gridData[0].length) continue;
          const symPositions = getSymmetricPositions(bx, by);
          for (const pos of symPositions) {
            const record = paintCell(pos.x, pos.y, forceColor, forceCodes);
            if (record) records.push(record);
          }
        }
      }
      return records;
    },
    [gridData, brushSize, isDrawMode, getSymmetricPositions, paintCell],
  );

  const bresenhamLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const points: Array<{ x: number; y: number }> = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    while (true) {
      points.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return points;
  }, []);

  const midPointCircle = useCallback((cx: number, cy: number, r: number) => {
    const points: Array<{ x: number; y: number }> = [];
    const plot = (x: number, y: number) => {
      points.push({ x: cx + x, y: cy + y });
      points.push({ x: cx - x, y: cy + y });
      points.push({ x: cx + x, y: cy - y });
      points.push({ x: cx - x, y: cy - y });
      points.push({ x: cx + y, y: cy + x });
      points.push({ x: cx - y, y: cy + x });
      points.push({ x: cx + y, y: cy - x });
      points.push({ x: cx - y, y: cy - x });
    };
    let x = 0;
    let y = r;
    let d = 1 - r;
    plot(x, y);
    while (x < y) {
      x++;
      if (d < 0) {
        d += 2 * x + 1;
      } else {
        y--;
        d += 2 * (x - y) + 1;
      }
      plot(x, y);
    }
    return points;
  }, []);

  const floodFill = useCallback(
    (startX: number, startY: number, targetColor: string, replacementColor: string) => {
      if (!gridData || targetColor === replacementColor) return [] as Array<{ x: number; y: number }>;
      const rows = gridData.length;
      const cols = gridData[0].length;
      const visited = new Set<string>();
      const positions: Array<{ x: number; y: number }> = [];
      const queue = [{ x: startX, y: startY }];
      visited.add(`${startX},${startY}`);

      while (queue.length > 0) {
        const { x, y } = queue.shift()!;
        if (y < 0 || y >= rows || x < 0 || x >= cols) continue;
        if (gridData[y][x].color !== targetColor) continue;
        positions.push({ x, y });
        for (const [dx, dy] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
      return positions;
    },
    [gridData],
  );

  return {
    paintCell,
    paintAt,
    getSymmetricPositions,
    bresenhamLine,
    midPointCircle,
    floodFill,
    isDrawMode,
    drawTool,
  };
}
