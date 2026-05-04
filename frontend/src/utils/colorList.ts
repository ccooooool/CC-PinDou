import type { GridCell, ColorInfo } from '../types/perler';

/**
 * 从 gridData 重新计算颜色列表，按用量降序排列。
 * 透明像素被排除。
 */
export function recalculateColorList(gridData: GridCell[][]): ColorInfo[] {
  const colorMap = new Map<string, ColorInfo>();
  for (const row of gridData) {
    for (const cell of row) {
      if (cell.color === 'transparent') continue;
      if (!colorMap.has(cell.color)) {
        colorMap.set(cell.color, { hex: cell.color, count: 0, codes: { ...cell.codes } });
      }
      colorMap.get(cell.color)!.count++;
    }
  }
  return Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
}
