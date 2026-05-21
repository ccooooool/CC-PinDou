import type { GridCell } from '../types/perler';

/**
 * 将 gridData 渲染为像素图 PNG DataURL
 * 每个格子渲染为 1px，最终 canvas 尺寸 = cols × rows
 */
export function renderGridToPixelPng(gridData: GridCell[][]): string {
  if (!gridData || gridData.length === 0 || gridData[0].length === 0) {
    return '';
  }
  const rows = gridData.length;
  const cols = gridData[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = gridData[y][x];
      if (cell.color === 'transparent') {
        ctx.clearRect(x, y, 1, 1);
      } else {
        ctx.fillStyle = cell.color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * 触发下载 DataURL 图片
 */
export function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
