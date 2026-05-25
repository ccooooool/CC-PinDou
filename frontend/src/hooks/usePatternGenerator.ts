import { useState, useCallback } from 'react';
import { PerlerEngine } from '../engine/PerlerEngine';
import type { GridCell, ColorInfo, ColorMapping } from '../types/perler';
import { simplifyColorsFrontend, enhanceLinesFrontend } from '../engine/frontendAlgorithms';
import colorMappingJson from '../data/colorSystemMapping.json';
import { toast } from '@/components/ui/toast';

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

interface UsePatternGeneratorOptions {
  engine: PerlerEngine | null;
  previewImage: string | null;
  gridSize: number;
  colorSimplify: number;
  enhanceLines: number;
  colorMode: 'full' | '221';
  onSuccess: (grid: GridCell[][], colors: ColorInfo[]) => void;
}

export function usePatternGenerator({
  engine,
  previewImage,
  gridSize,
  colorSimplify,
  enhanceLines,
  colorMode,
  onSuccess,
}: UsePatternGeneratorOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!engine || !previewImage) return;

    setIsGenerating(true);
    setError(null);

    try {
      // 前端算法路径：纯浏览器本地计算
      const img = new Image();
      img.src = previewImage;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败'));
      });

      const canvas = document.createElement('canvas');
      const maxSize = 800;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 前端降级：颜色简化
      if (colorSimplify > 0) {
        imageData = simplifyColorsFrontend(imageData, colorSimplify);
      }
      // 前端降级：线条增强
      if (enhanceLines > 0) {
        imageData = enhanceLinesFrontend(imageData, enhanceLines);
      }

      // 尝试 offload 到 Web Worker，失败后降级到主线程同步计算
      let mergedGrid: GridCell[][];
      let colorList: ColorInfo[];

      try {
        const result = await new Promise<{
          grid: GridCell[][];
          colorList: ColorInfo[];
        }>((resolve, reject) => {
          const worker = new Worker(
            new URL('../workers/perler.worker.ts', import.meta.url),
            { type: 'module' }
          );

          worker.onmessage = (e: MessageEvent) => {
            worker.terminate();
            const data = e.data as {
              status: 'success' | 'error';
              grid?: GridCell[][];
              colorList?: ColorInfo[];
              error?: string;
            };
            if (data.status === 'success' && data.grid && data.colorList) {
              resolve({ grid: data.grid, colorList: data.colorList });
            } else {
              reject(new Error(data.error || 'Worker 返回无效数据'));
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            reject(err);
          };

          worker.postMessage({
            type: 'generate',
            imageData: {
              data: imageData.data,
              width: imageData.width,
              height: imageData.height,
            },
            gridSize,
            colorMapping: colorMappingData,
            mode: colorMode,
            bfsThreshold: 25,
          });
        });
        mergedGrid = result.grid;
        colorList = result.colorList;
      } catch (_workerErr) {
        // 降级 fallback：主线程同步计算
        const { grid } = engine.generateGrid(imageData, gridSize);
        mergedGrid = engine.bfsMerge(grid, 25);

        const finalColorMap = new Map<string, ColorInfo>();
        for (const row of mergedGrid) {
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
        colorList = Array.from(finalColorMap.values()).sort((a, b) => b.count - a.count);
      }

      onSuccess(mergedGrid, colorList);
      toast.success('拼豆图案生成成功');
    } catch (err: unknown) {
      const msg = '生成失败: ' + (err instanceof Error ? err.message : String(err));
      setError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [engine, previewImage, gridSize, colorSimplify, enhanceLines, colorMode, onSuccess]);

  return { handleGenerate, isGenerating, error, setError };
}
