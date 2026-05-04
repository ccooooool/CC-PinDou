import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './useEditorStore';
import type { GridCell, ColorInfo } from '../types/perler';

function createTestGrid(size: number): GridCell[][] {
  const grid: GridCell[][] = [];
  for (let y = 0; y < size; y++) {
    const row: GridCell[] = [];
    for (let x = 0; x < size; x++) {
      row.push({ x, y, color: 'transparent', codes: {} });
    }
    grid.push(row);
  }
  return grid;
}

const TEST_COLORS: ColorInfo[] = [
  { hex: '#FF0000', count: 1, codes: { MARD: 'A01' } },
  { hex: '#00FF00', count: 1, codes: { MARD: 'A02' } },
];

describe('useEditorStore', () => {
  beforeEach(() => {
    // 重置 store 到初始状态
    useEditorStore.setState({
      gridData: null,
      colorList: [],
      historyStack: [],
      redoStack: [],
      selectedCells: [],
      isolatedCells: [],
      unstableCells: [],
    });
  });

  describe('setCellColor', () => {
    it('应修改指定格子的颜色', () => {
      const grid = createTestGrid(3);
      useEditorStore.getState().setGridData(grid, []);

      useEditorStore.getState().setCellColor(1, 1, '#FF0000', { MARD: 'A01' });

      const state = useEditorStore.getState();
      expect(state.gridData![1][1].color).toBe('#FF0000');
      expect(state.gridData![1][1].codes).toEqual({ MARD: 'A01' });
    });

    it('相同颜色不应触发更新', () => {
      const grid = createTestGrid(3);
      grid[1][1].color = '#FF0000';
      useEditorStore.getState().setGridData(grid, []);

      const before = useEditorStore.getState().historyStack.length;
      useEditorStore.getState().setCellColor(1, 1, '#FF0000', {});
      const after = useEditorStore.getState().historyStack.length;

      expect(after).toBe(before);
    });

    it('应记录历史并清空 redo 栈', () => {
      const grid = createTestGrid(3);
      useEditorStore.getState().setGridData(grid, []);

      useEditorStore.getState().setCellColor(0, 0, '#FF0000', { MARD: 'A01' });
      const state = useEditorStore.getState();

      expect(state.historyStack.length).toBe(1);
      expect(state.historyStack[0].type).toBe('paint');
      expect(state.redoStack.length).toBe(0);
    });
  });

  describe('undo / redo', () => {
    it('undo 应恢复到之前的状态', () => {
      const grid = createTestGrid(3);
      useEditorStore.getState().setGridData(grid, []);

      useEditorStore.getState().setCellColor(1, 1, '#FF0000', { MARD: 'A01' });
      expect(useEditorStore.getState().gridData![1][1].color).toBe('#FF0000');

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().gridData![1][1].color).toBe('transparent');
    });

    it('redo 应恢复被撤销的操作', () => {
      const grid = createTestGrid(3);
      useEditorStore.getState().setGridData(grid, []);

      useEditorStore.getState().setCellColor(1, 1, '#FF0000', { MARD: 'A01' });
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().gridData![1][1].color).toBe('transparent');

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().gridData![1][1].color).toBe('#FF0000');
    });

    it('undo 后执行新操作应清空 redo 栈', () => {
      const grid = createTestGrid(3);
      useEditorStore.getState().setGridData(grid, []);

      useEditorStore.getState().setCellColor(0, 0, '#FF0000', {});
      useEditorStore.getState().setCellColor(1, 1, '#00FF00', {});
      useEditorStore.getState().undo();

      expect(useEditorStore.getState().redoStack.length).toBe(1);

      useEditorStore.getState().setCellColor(2, 2, '#0000FF', {});
      expect(useEditorStore.getState().redoStack.length).toBe(0);
    });

    it('空历史栈时 undo 不应报错', () => {
      const grid = createTestGrid(3);
      useEditorStore.getState().setGridData(grid, []);

      // 不应抛出异常
      expect(() => useEditorStore.getState().undo()).not.toThrow();
    });
  });

  describe('removeColorFromGrid', () => {
    it('应将所有指定颜色替换为 transparent', () => {
      const grid = createTestGrid(3);
      grid[0][0].color = '#FF0000';
      grid[0][1].color = '#FF0000';
      grid[1][1].color = '#00FF00';

      useEditorStore.getState().setGridData(grid, TEST_COLORS);
      useEditorStore.getState().removeColorFromGrid('#FF0000');

      const state = useEditorStore.getState();
      expect(state.gridData![0][0].color).toBe('transparent');
      expect(state.gridData![0][1].color).toBe('transparent');
      expect(state.gridData![1][1].color).toBe('#00FF00');
    });

    it('应记录 delete_color 历史', () => {
      const grid = createTestGrid(2);
      grid[0][0].color = '#FF0000';
      useEditorStore.getState().setGridData(grid, TEST_COLORS);

      useEditorStore.getState().removeColorFromGrid('#FF0000');

      const state = useEditorStore.getState();
      expect(state.historyStack.length).toBe(1);
      expect(state.historyStack[0].type).toBe('delete_color');
    });
  });

  describe('immer integration', () => {
    it('应正确保持 gridData 的引用不变性（Immer 自动处理）', () => {
      const grid = createTestGrid(2);
      useEditorStore.getState().setGridData(grid, []);

      const beforeGrid = useEditorStore.getState().gridData;
      useEditorStore.getState().setCellColor(0, 0, '#FF0000', {});
      const afterGrid = useEditorStore.getState().gridData;

      // Immer 应生成新的 gridData 对象
      expect(afterGrid).not.toBe(beforeGrid);
      // 未修改的 cell 应保持引用不变（Immer 的结构共享）
      expect(afterGrid![1][1]).toBe(beforeGrid![1][1]);
    });
  });
});
