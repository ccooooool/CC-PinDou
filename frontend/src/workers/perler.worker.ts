/**
 * Web Worker: 拼豆图案重型计算卸载
 * 在大图处理时将计算 offload 到后台线程，避免阻塞 UI。
 */

import { PerlerEngine } from '../engine/PerlerEngine';
import type { ColorMapping, GridCell, ColorInfo } from '../types/perler';

interface GeneratePayload {
  type: 'generate';
  imageData: {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };
  gridSize: number;
  colorMapping: ColorMapping;
  mode: 'full' | '221';
  bfsThreshold: number;
}

interface WorkerResponse {
  status: 'success' | 'error';
  grid?: GridCell[][];
  colorList?: ColorInfo[];
  error?: string;
}

self.onmessage = (e: MessageEvent<GeneratePayload>) => {
  const { type } = e.data;

  if (type === 'generate') {
    try {
      const { imageData, gridSize, colorMapping, mode, bfsThreshold } = e.data;

      // 在 Worker 中重建 ImageData
      const imgData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );

      const engine = new PerlerEngine(colorMapping, mode);
      const { grid } = engine.generateGrid(imgData, gridSize);

      let finalGrid = grid;
      if (bfsThreshold > 0) {
        finalGrid = engine.bfsMerge(grid, bfsThreshold);
      }

      // 重新统计颜色
      const finalColorMap = new Map<string, ColorInfo>();
      for (const row of finalGrid) {
        for (const cell of row) {
          if (cell.color === 'transparent') continue;
          if (!finalColorMap.has(cell.color)) {
            finalColorMap.set(cell.color, {
              hex: cell.color,
              count: 0,
              codes: { ...cell.codes },
            });
          }
          finalColorMap.get(cell.color)!.count++;
        }
      }

      const colorList = Array.from(finalColorMap.values()).sort(
        (a, b) => b.count - a.count
      );

      const response: WorkerResponse = {
        status: 'success',
        grid: finalGrid,
        colorList,
      };

      self.postMessage(response);
    } catch (err: any) {
      const response: WorkerResponse = {
        status: 'error',
        error: err?.message || 'Worker 计算失败',
      };
      self.postMessage(response);
    }
  }
};

export {};
