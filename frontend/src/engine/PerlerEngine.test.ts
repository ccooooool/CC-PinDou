import { describe, it, expect } from 'vitest';
import { PerlerEngine } from './PerlerEngine';
import type { ColorMapping } from '../types/perler';

const MOCK_COLOR_MAPPING: ColorMapping = {
  '#FF0000': { MARD: 'A01', COCO: 'D01' },
  '#00FF00': { MARD: 'A02', COCO: 'D02' },
  '#0000FF': { MARD: 'A03', COCO: 'D03' },
  '#FFFFFF': { MARD: 'A04', COCO: 'D04' },
  '#000000': { MARD: 'A05', COCO: 'D05' },
  '#FFFF00': { MARD: 'B01', COCO: 'E01' },
  '#FF00FF': { MARD: 'B02', COCO: 'E02' },
  '#00FFFF': { MARD: 'B03', COCO: 'E03' },
  '#808080': { MARD: 'B04', COCO: 'E04' },
  '#800000': { MARD: 'C01', COCO: 'F01' },
};

describe('PerlerEngine', () => {
  describe('nearestColor', () => {
    it('应返回精确匹配的颜色', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      expect(engine.nearestColor([255, 0, 0])).toBe('#FF0000');
      expect(engine.nearestColor([0, 255, 0])).toBe('#00FF00');
      expect(engine.nearestColor([0, 0, 255])).toBe('#0000FF');
    });

    it('应返回最接近的近似颜色', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      // (254, 1, 1) 非常接近红色
      expect(engine.nearestColor([254, 1, 1])).toBe('#FF0000');
      // (1, 254, 1) 非常接近绿色
      expect(engine.nearestColor([1, 254, 1])).toBe('#00FF00');
    });

    it('灰色应匹配灰色而非黑或白', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      expect(engine.nearestColor([128, 128, 128])).toBe('#808080');
    });
  });

  describe('nearestColorBatch', () => {
    it('批量结果应与逐个查找一致', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      const pixels = new Float32Array([
        255, 0, 0,
        0, 255, 0,
        0, 0, 255,
        255, 255, 255,
      ]);

      const batchResults = engine.nearestColorBatch(pixels);
      const individualResults = [
        engine.nearestColor([255, 0, 0]),
        engine.nearestColor([0, 255, 0]),
        engine.nearestColor([0, 0, 255]),
        engine.nearestColor([255, 255, 255]),
      ];

      expect(batchResults).toEqual(individualResults);
    });

    it('空数组应返回空数组', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      const pixels = new Float32Array(0);
      expect(engine.nearestColorBatch(pixels)).toEqual([]);
    });
  });

  describe('generateGrid', () => {
    it('应从 ImageData 生成正确尺寸的网格', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      const size = 4;
      const data = new Uint8ClampedArray(size * size * 4);
      // 填充红色
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      const imageData = new ImageData(data, size, size);

      const { grid, colorMap } = engine.generateGrid(imageData, 2);

      expect(grid.length).toBe(2);
      expect(grid[0].length).toBe(2);
      expect(colorMap.has('#FF0000')).toBe(true);
    });

    it('透明像素应映射为 transparent', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      const size = 4;
      const data = new Uint8ClampedArray(size * size * 4);
      // 全透明
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0; // alpha = 0
      }
      const imageData = new ImageData(data, size, size);

      const { grid } = engine.generateGrid(imageData, 2);
      expect(grid[0][0].color).toBe('transparent');
    });
  });

  describe('bfsMerge', () => {
    it('应合并颜色相近的相邻格子', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      const grid = [
        [
          { x: 0, y: 0, color: '#FF0000', codes: {} },
          { x: 1, y: 0, color: '#FF0101', codes: {} },
        ],
        [
          { x: 0, y: 1, color: '#FF0000', codes: {} },
          { x: 1, y: 1, color: '#FF0101', codes: {} },
        ],
      ];

      const merged = engine.bfsMerge(grid, 50);
      // 四个格子颜色距离很小，应被合并为同一颜色
      const firstColor = merged[0][0].color;
      expect(merged[0][1].color).toBe(firstColor);
      expect(merged[1][0].color).toBe(firstColor);
      expect(merged[1][1].color).toBe(firstColor);
    });

    it('不应合并颜色差异大的格子', () => {
      const engine = new PerlerEngine(MOCK_COLOR_MAPPING, 'full');
      const grid = [
        [
          { x: 0, y: 0, color: '#FF0000', codes: {} },
          { x: 1, y: 0, color: '#0000FF', codes: {} },
        ],
      ];

      const merged = engine.bfsMerge(grid, 10);
      expect(merged[0][0].color).toBe('#FF0000');
      expect(merged[0][1].color).toBe('#0000FF');
    });
  });

  describe('mode 221', () => {
    it('221 模式应只使用 A-M 开头的 MARD 颜色', () => {
      const mapping: ColorMapping = {
        '#FF0000': { MARD: 'A01' },
        '#00FF00': { MARD: 'N01' },
        '#0000FF': { MARD: 'M99' },
        '#FFFFFF': { MARD: 'Z01' },
      };

      const engine = new PerlerEngine(mapping, '221');
      // A01 和 M99 是 A-M 范围，N01 和 Z01 不是
      expect(engine.nearestColor([255, 0, 0])).toBe('#FF0000');
    });
  });
});
