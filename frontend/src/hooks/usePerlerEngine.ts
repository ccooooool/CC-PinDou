import { useCallback, useRef, useEffect } from 'react';
import { PerlerEngine } from '../engine/PerlerEngine';
import type { GridCell, ColorInfo, ColorMapping } from '../types/perler';

interface UsePerlerEngineOptions {
  colorMapping: ColorMapping;
  mode: 'full' | '221';
}

interface GenerateResult {
  grid: GridCell[][];
  colorList: ColorInfo[];
}

/**
 * React Hook: 封装 PerlerEngine 的异步网格生成。
 * 使用 Web Worker 处理大图，避免阻塞主线程。
 */
export function usePerlerEngine({ colorMapping, mode }: UsePerlerEngineOptions) {
  const engineRef = useRef<PerlerEngine | null>(null);

  useEffect(() => {
    engineRef.current = new PerlerEngine(colorMapping, mode);
  }, [colorMapping, mode]);

  const generateGrid = useCallback(
    async (
      imageData: ImageData,
      gridSize: number,
      bfsThreshold: number = 0
    ): Promise<GenerateResult> => {
      const engine = engineRef.current;
      if (!engine) throw new Error('Engine not initialized');

      const pixelCount = imageData.width * imageData.height;

      // 小图直接在主线程处理，避免 Worker 启动开销
      if (pixelCount < 10000) {
        const { grid } = engine.generateGrid(imageData, gridSize);

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

        return {
          grid: finalGrid,
          colorList: Array.from(finalColorMap.values()).sort((a, b) => b.count - a.count),
        };
      }

      // 大图走 Web Worker
      const worker = new Worker(
        new URL('../workers/perler.worker.ts', import.meta.url),
        { type: 'module' }
      );

      return new Promise((resolve, reject) => {
        worker.onmessage = (e: MessageEvent) => {
          const { status, grid, colorList, error } = e.data;
          worker.terminate();

          if (status === 'success' && grid && colorList) {
            resolve({ grid, colorList });
          } else {
            reject(new Error(error || 'Worker 计算失败'));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(`Worker 错误: ${err.message}`));
        };

        // 传递 ImageData 的序列化形式（Transferable）
        const payload = {
          type: 'generate' as const,
          imageData: {
            width: imageData.width,
            height: imageData.height,
            data: imageData.data,
          },
          gridSize,
          colorMapping,
          mode,
          bfsThreshold,
        };

        worker.postMessage(payload, [imageData.data.buffer]);
      });
    },
    [colorMapping, mode]
  );

  return { generateGrid };
}
