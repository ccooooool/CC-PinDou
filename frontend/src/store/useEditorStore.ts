import { create } from 'zustand';
import { produce, setAutoFreeze } from 'immer';

// 禁用 autoFreeze，允许 paintCell/paintAt 等 hook 中直接修改 gridData
// 生产模式下 Immer 默认不 freeze，此举使 dev 行为与生产一致
setAutoFreeze(false);
import type { GridCell, ColorInfo, HistoryAction, PerlerLayer, BeadLayer, ImageLayer } from '../types/perler';
import { recalculateColorList } from '../utils/colorList';

const MAX_HISTORY_SIZE = 50;

function genId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function createEmptyGrid(size: number): GridCell[][] {
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

export interface EditorState {
  // ========== 图层系统（新增）==========
  layers: PerlerLayer[];
  activeLayerId: string | null;

  // ========== 核心数据（激活图层视图）==========
  gridData: GridCell[][] | null;
  colorList: ColorInfo[];
  selectedColor: ColorInfo | null;

  // ========== 历史记录 ==========
  historyStack: HistoryAction[];
  redoStack: HistoryAction[];

  // ========== 选区（魔法棒）==========
  selectedCells: Array<{ x: number; y: number }>;
  tolerance: number;

  // ========== 质量检查 ==========
  isolatedCells: Array<{ x: number; y: number }>;
  unstableCells: Array<{ x: number; y: number }>;

  // ========== Actions ==========
  setGridData: (grid: GridCell[][], colors: ColorInfo[]) => void;
  setCellColor: (x: number, y: number, color: string, codes: Record<string, string>) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: (action: HistoryAction) => void;
  removeColorFromGrid: (hex: string) => void;
  setSelectedColor: (color: ColorInfo | null) => void;
  clearHistory: () => void;

  // 变换
  flipHorizontal: () => void;
  flipVertical: () => void;
  rotateCW: () => void;
  rotateCCW: () => void;

  // 质量检查
  detectIsolatedPixels: () => void;
  mergeIsolatedPixels: () => void;
  detectUnstableStructures: () => void;
  clearQualityChecks: () => void;

  // 魔法棒选区
  clearSelection: () => void;
  magicWandSelect: (x: number, y: number, append: boolean) => void;
  invertSelection: () => void;
  moveSelection: (dx: number, dy: number) => void;
  fillSelection: () => void;
  deleteSelection: () => void;
  setTolerance: (v: number) => void;

  // 全局颜色替换
  replaceColorGlobally: (fromHex: string, toHex: string, toCodes: Record<string, string>) => void;

  // 空白网格
  createBlankGrid: (size: number) => void;

  // 工程导入/导出
  exportProject: () => object;
  importProject: (data: object) => boolean;

  // ========== 图层系统 Actions（新增）==========
  setActiveLayer: (id: string | null) => void;
  addBeadLayer: (name: string, size: number) => void;
  addImageLayer: (name: string, imageUrl: string, initialTransform?: Partial<ImageLayer['transform']>, size?: { width: number; height: number }) => string;
  toggleLayerVisible: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  reorderLayer: (id: string, direction: 'up' | 'down') => void;
  deleteLayer: (id: string) => void;
  updateLayerOpacity: (id: string, opacity: number) => void;
  renameLayer: (id: string, name: string) => void;
  updateImageTransform: (id: string, patch: Partial<ImageLayer['transform']>) => void;
  updateBeadLayerTransform: (id: string, patch: Partial<BeadLayer['transform']>) => void;
  toggleScaleLocked: (id: string) => void;
  moveLayerContent: (id: string, dx: number, dy: number) => void;
  flipLayerContent: (id: string, direction: 'h' | 'v') => void;
  mergeLayerDown: (id: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  layers: [],
  activeLayerId: null,
  gridData: null,
  colorList: [],
  selectedColor: null,
  historyStack: [],
  redoStack: [],
  selectedCells: [],
  tolerance: 0,
  isolatedCells: [],
  unstableCells: [],

  setGridData: (grid, colors) => {
    const state = get();
    if (state.layers.length === 0) {
      // 向后兼容：创建单图层
      const id = genId();
      const layer: BeadLayer = {
        id,
        name: '图层 1',
        type: 'bead',
        visible: true,
        locked: false,
        opacity: 100,
        zIndex: 0,
        gridData: grid,
        colorList: colors,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      };
      set({ layers: [layer], activeLayerId: id, gridData: grid, colorList: colors, historyStack: [], redoStack: [], selectedCells: [] });
    } else {
      set(produce((draft: EditorState) => {
        // 优先更新 activeLayer（如果是 bead），否则更新第一个 bead 图层
        const targetLayer =
          draft.layers.find((l) => l.id === draft.activeLayerId && l.type === 'bead') ||
          draft.layers.find((l) => l.type === 'bead');
        if (targetLayer && targetLayer.type === 'bead') {
          targetLayer.gridData = grid;
          targetLayer.colorList = colors;
        }
        draft.gridData = grid;
        draft.colorList = colors;
        draft.historyStack = [];
        draft.redoStack = [];
        draft.selectedCells = [];
      }));
    }
  },

  setCellColor: (x, y, color, codes) => {
    const state = get();
    if (!state.gridData) return;
    const cell = state.gridData[y][x];
    if (cell.color === color) return;

    const layerId = state.activeLayerId || 'default';
    const action: HistoryAction = {
      type: 'paint',
      layerId,
      x,
      y,
      oldColor: cell.color,
      oldCodes: { ...cell.codes },
      newColor: color,
      newCodes: { ...codes },
    };

    set(produce((draft: EditorState) => {
      draft.gridData![y][x].color = color;
      draft.gridData![y][x].codes = codes;
      if (draft.historyStack.length >= MAX_HISTORY_SIZE) draft.historyStack.shift();
      draft.historyStack.push(action);
      draft.redoStack = [];

      // 同步回写图层
      const layer = draft.layers.find((l) => l.id === layerId);
      if (layer && layer.type === 'bead') {
        layer.gridData[y][x].color = color;
        layer.gridData[y][x].codes = codes;
        layer.colorList = recalculateColorList(layer.gridData);
      }
    }));
  },

  pushHistory: (action) => {
    set(produce((draft: EditorState) => {
      if (draft.historyStack.length >= MAX_HISTORY_SIZE) draft.historyStack.shift();
      draft.historyStack.push(action);
      draft.redoStack = [];
    }));
  },

  undo: () => {
    const state = get();
    if (state.historyStack.length === 0) return;
    const action = state.historyStack[state.historyStack.length - 1];

    set(produce((draft: EditorState) => {
      // 找到 action 对应的图层
      const layer = draft.layers.find((l) => l.id === action.layerId);
      if (!layer || layer.type !== 'bead') return;

      if (action.type === 'paint') {
        layer.gridData[action.y][action.x].color = action.oldColor;
        layer.gridData[action.y][action.x].codes = action.oldCodes;
      } else if (action.type === 'batch_paint') {
        action.positions.forEach((pos) => {
          layer.gridData[pos.y][pos.x].color = pos.oldColor;
          layer.gridData[pos.y][pos.x].codes = pos.oldCodes;
        });
      } else if (action.type === 'delete_color') {
        action.positions.forEach((pos) => {
          layer.gridData[pos.y][pos.x].color = pos.oldColor;
          layer.gridData[pos.y][pos.x].codes = pos.oldCodes;
        });
      }
      layer.colorList = recalculateColorList(layer.gridData);

      // 同步到视图
      if (draft.activeLayerId === action.layerId) {
        draft.gridData = layer.gridData;
        draft.colorList = layer.colorList;
      }
      draft.historyStack.pop();
      draft.redoStack.push(action);
    }));
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const action = state.redoStack[state.redoStack.length - 1];

    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === action.layerId);
      if (!layer || layer.type !== 'bead') return;

      if (action.type === 'paint') {
        layer.gridData[action.y][action.x].color = action.newColor;
        layer.gridData[action.y][action.x].codes = action.newCodes;
      } else if (action.type === 'batch_paint') {
        action.positions.forEach((pos) => {
          layer.gridData[pos.y][pos.x].color = pos.newColor;
          layer.gridData[pos.y][pos.x].codes = pos.newCodes;
        });
      } else if (action.type === 'delete_color') {
        action.positions.forEach((pos) => {
          layer.gridData[pos.y][pos.x].color = 'transparent';
          layer.gridData[pos.y][pos.x].codes = {};
        });
      }
      layer.colorList = recalculateColorList(layer.gridData);

      if (draft.activeLayerId === action.layerId) {
        draft.gridData = layer.gridData;
        draft.colorList = layer.colorList;
      }
      draft.historyStack.push(action);
      draft.redoStack.pop();
    }));
  },

  removeColorFromGrid: (hex) => {
    const state = get();
    if (!state.gridData) return;

    const layerId = state.activeLayerId || 'default';
    const positions: Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string> }> = [];
    for (let y = 0; y < state.gridData.length; y++) {
      for (let x = 0; x < state.gridData[y].length; x++) {
        if (state.gridData[y][x].color === hex) {
          positions.push({
            x, y,
            oldColor: state.gridData[y][x].color,
            oldCodes: { ...state.gridData[y][x].codes },
          });
        }
      }
    }

    if (positions.length > 0) {
      const action: HistoryAction = { type: 'delete_color', layerId, color: hex, positions };
      set(produce((draft: EditorState) => {
        positions.forEach((pos) => {
          draft.gridData![pos.y][pos.x].color = 'transparent';
          draft.gridData![pos.y][pos.x].codes = {};
        });
        draft.colorList = recalculateColorList(draft.gridData!);
        draft.historyStack.push(action);
        draft.redoStack = [];

        const layer = draft.layers.find((l) => l.id === layerId);
        if (layer && layer.type === 'bead') {
          positions.forEach((pos) => {
            layer.gridData[pos.y][pos.x].color = 'transparent';
            layer.gridData[pos.y][pos.x].codes = {};
          });
          layer.colorList = recalculateColorList(layer.gridData);
        }
      }));
    }
  },

  setSelectedColor: (color) => set({ selectedColor: color }),
  clearHistory: () => set({ historyStack: [], redoStack: [] }),

  flipHorizontal: () => {
    const { gridData, activeLayerId, layers } = get();
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.type === 'image') {
      if (activeLayer.locked) return;
      set(produce((draft: EditorState) => {
        const layer = draft.layers.find((l) => l.id === activeLayerId);
        if (layer && layer.type === 'image') {
          const oldScaleX = layer.transform.scaleX;
          layer.transform.scaleX *= -1;
          layer.transform.x -= layer.width * oldScaleX;
        }
      }));
      return;
    }
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const newGrid: GridCell[][] = [];
    for (let y = 0; y < rows; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < cols; x++) {
        const src = gridData[y][cols - 1 - x];
        row.push({ ...src, x });
      }
      newGrid.push(row);
    }
    const colors = recalculateColorList(newGrid);
    set(produce((draft: EditorState) => {
      draft.gridData = newGrid;
      draft.colorList = colors;
      draft.historyStack = [];
      draft.redoStack = [];
      draft.selectedCells = [];
      const layer = draft.layers.find((l) => l.id === activeLayerId);
      if (layer && layer.type === 'bead') {
        layer.gridData = newGrid;
        layer.colorList = colors;
      }
    }));
  },

  flipVertical: () => {
    const { gridData, activeLayerId, layers } = get();
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.type === 'image') {
      if (activeLayer.locked) return;
      set(produce((draft: EditorState) => {
        const layer = draft.layers.find((l) => l.id === activeLayerId);
        if (layer && layer.type === 'image') {
          const oldScaleY = layer.transform.scaleY;
          layer.transform.scaleY *= -1;
          layer.transform.y -= layer.height * oldScaleY;
        }
      }));
      return;
    }
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const newGrid: GridCell[][] = [];
    for (let y = 0; y < rows; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < cols; x++) {
        const src = gridData[rows - 1 - y][x];
        row.push({ ...src, y });
      }
      newGrid.push(row);
    }
    const colors = recalculateColorList(newGrid);
    set(produce((draft: EditorState) => {
      draft.gridData = newGrid;
      draft.colorList = colors;
      draft.historyStack = [];
      draft.redoStack = [];
      draft.selectedCells = [];
      const layer = draft.layers.find((l) => l.id === activeLayerId);
      if (layer && layer.type === 'bead') {
        layer.gridData = newGrid;
        layer.colorList = colors;
      }
    }));
  },

  rotateCW: () => {
    const { gridData, activeLayerId, layers } = get();
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.type === 'image') {
      if (activeLayer.locked) return;
      set(produce((draft: EditorState) => {
        const layer = draft.layers.find((l) => l.id === activeLayerId);
        if (layer && layer.type === 'image') {
          layer.transform.rotation += 90;
        }
      }));
      return;
    }
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const newGrid: GridCell[][] = [];
    for (let x = 0; x < cols; x++) {
      const row: GridCell[] = [];
      for (let y = 0; y < rows; y++) {
        const src = gridData[rows - 1 - y][x];
        row.push({ ...src, x, y });
      }
      newGrid.push(row);
    }
    const colors = recalculateColorList(newGrid);
    set(produce((draft: EditorState) => {
      draft.gridData = newGrid;
      draft.colorList = colors;
      draft.historyStack = [];
      draft.redoStack = [];
      draft.selectedCells = [];
      const layer = draft.layers.find((l) => l.id === activeLayerId);
      if (layer && layer.type === 'bead') {
        layer.gridData = newGrid;
        layer.colorList = colors;
      }
    }));
  },

  rotateCCW: () => {
    const { gridData, activeLayerId, layers } = get();
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.type === 'image') {
      if (activeLayer.locked) return;
      set(produce((draft: EditorState) => {
        const layer = draft.layers.find((l) => l.id === activeLayerId);
        if (layer && layer.type === 'image') {
          layer.transform.rotation -= 90;
        }
      }));
      return;
    }
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const newGrid: GridCell[][] = [];
    for (let x = 0; x < cols; x++) {
      const row: GridCell[] = [];
      for (let y = 0; y < rows; y++) {
        const src = gridData[y][cols - 1 - x];
        row.push({ ...src, x, y });
      }
      newGrid.push(row);
    }
    const colors = recalculateColorList(newGrid);
    set(produce((draft: EditorState) => {
      draft.gridData = newGrid;
      draft.colorList = colors;
      draft.historyStack = [];
      draft.redoStack = [];
      draft.selectedCells = [];
      const layer = draft.layers.find((l) => l.id === activeLayerId);
      if (layer && layer.type === 'bead') {
        layer.gridData = newGrid;
        layer.colorList = colors;
      }
    }));
  },

  detectIsolatedPixels: () => {
    const { gridData } = get();
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const isolated: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = gridData[y][x];
        if (cell.color === 'transparent') continue;
        let hasNeighbor = false;
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && gridData[ny][nx].color !== 'transparent') {
            hasNeighbor = true;
            break;
          }
        }
        if (!hasNeighbor) isolated.push({ x, y });
      }
    }
    set({ isolatedCells: isolated });
  },

  mergeIsolatedPixels: () => {
    const { gridData, isolatedCells } = get();
    if (!gridData || isolatedCells.length === 0) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const positions: Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }> = [];

    const hexToRgb = (hex: string) => {
      const n = parseInt(hex.replace('#', ''), 16);
      return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
    };
    const colorDist = (a: string, b: string) => {
      const ca = hexToRgb(a);
      const cb = hexToRgb(b);
      return (ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2;
    };

    for (const { x, y } of isolatedCells) {
      const oldColor = gridData[y][x].color;
      const oldCodes = { ...gridData[y][x].codes };
      let bestColor = 'transparent';
      let bestCodes: Record<string, string> = {};
      let bestDist = Infinity;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
          const neighbor = gridData[ny][nx];
          if (neighbor.color !== 'transparent' && neighbor.color !== oldColor) {
            const dist = colorDist(oldColor, neighbor.color);
            if (dist < bestDist) {
              bestDist = dist;
              bestColor = neighbor.color;
              bestCodes = { ...neighbor.codes };
            }
          }
        }
      }
      if (bestColor !== 'transparent') {
        positions.push({ x, y, oldColor, oldCodes, newColor: bestColor, newCodes: bestCodes });
        // 注意：不直接修改 gridData，所有修改在 produce 内统一应用
      }
    }

    if (positions.length > 0) {
      set(produce((draft: EditorState) => {
        positions.forEach((pos) => {
          draft.gridData![pos.y][pos.x].color = pos.newColor;
          draft.gridData![pos.y][pos.x].codes = pos.newCodes;
        });
        draft.colorList = recalculateColorList(draft.gridData!);
        draft.isolatedCells = [];
        draft.historyStack.push({ type: 'batch_paint', layerId: draft.activeLayerId || 'default', tool: 'merge_isolated', positions });
        draft.redoStack = [];
      }));
    }
  },

  detectUnstableStructures: () => {
    const { gridData } = get();
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const visited = new Set<string>();
    const unstable: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        const baseColor = gridData[y][x].color;
        if (baseColor === 'transparent') continue;

        const region: Array<{ x: number; y: number }> = [];
        const queue = [{ x, y }];
        visited.add(key);
        let head = 0;
        while (head < queue.length) {
          const { x: cx, y: cy } = queue[head++];
          region.push({ x: cx, y: cy });
          for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            const nx = cx + dx, ny = cy + dy;
            const nKey = `${nx},${ny}`;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(nKey) && gridData[ny][nx].color === baseColor) {
              visited.add(nKey);
              queue.push({ x: nx, y: ny });
            }
          }
        }

        let minX = cols, maxX = -1, minY = rows, maxY = -1;
        for (const p of region) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        if (Math.min(w, h) === 1 && Math.max(w, h) >= 5) {
          for (const p of region) unstable.push(p);
        }
      }
    }
    set({ unstableCells: unstable });
  },

  clearQualityChecks: () => set({ isolatedCells: [], unstableCells: [] }),

  clearSelection: () => set({ selectedCells: [] }),
  setTolerance: (v) => set({ tolerance: Math.max(0, Math.min(255, v)) }),

  magicWandSelect: (x, y, append) => {
    const { gridData, selectedCells, tolerance } = get();
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const targetColor = gridData[y]?.[x]?.color;
    if (!targetColor || targetColor === 'transparent') return;

    const _hexToRgb = (hex: string) => {
      const n = parseInt(hex.replace('#', ''), 16);
      return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
    };
    const _colorDist = (a: string, b: string) => {
      const ca = _hexToRgb(a);
      const cb = _hexToRgb(b);
      return Math.sqrt((ca.r - cb.r) ** 2 + (ca.g - cb.g) ** 2 + (ca.b - cb.b) ** 2);
    };
    const _isMatch = (color: string) => {
      if (color === 'transparent') return false;
      if (tolerance <= 0) return color === targetColor;
      return _colorDist(color, targetColor) <= tolerance;
    };

    const visited = new Set<string>();
    const region: Array<{ x: number; y: number }> = [];
    const queue = [{ x, y }];
    visited.add(`${x},${y}`);

    let head = 0;
    while (head < queue.length) {
      const { x: cx, y: cy } = queue[head++];
      region.push({ x: cx, y: cy });
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = cx + dx, ny = cy + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(key) && _isMatch(gridData[ny][nx].color)) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    if (append) {
      const existing = new Set(selectedCells.map((c) => `${c.x},${c.y}`));
      const merged = [...selectedCells];
      for (const cell of region) {
        if (!existing.has(`${cell.x},${cell.y}`)) merged.push(cell);
      }
      set({ selectedCells: merged });
    } else {
      set({ selectedCells: region });
    }
  },

  invertSelection: () => {
    const { gridData, selectedCells } = get();
    if (!gridData) return;
    const rows = gridData.length;
    const cols = gridData[0].length;
    const selectedSet = new Set(selectedCells.map((c) => `${c.x},${c.y}`));
    const inverted: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!selectedSet.has(`${x},${y}`)) {
          inverted.push({ x, y });
        }
      }
    }
    set({ selectedCells: inverted });
  },

  moveSelection: (dx, dy) => {
    const { gridData, selectedCells } = get();
    if (!gridData || selectedCells.length === 0 || (dx === 0 && dy === 0)) return;
    const rows = gridData.length;
    const cols = gridData[0].length;

    // 检查目标位置是否都在边界内
    for (const c of selectedCells) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return;
    }

    const layerId = get().activeLayerId || 'default';

    set(produce((draft: EditorState) => {
      if (!draft.gridData) return;

      const moves = selectedCells.map((c) => ({
        sx: c.x, sy: c.y,
        dx: c.x + dx, dy: c.y + dy,
        color: draft.gridData![c.y][c.x].color,
        codes: { ...draft.gridData![c.y][c.x].codes },
        targetOldColor: draft.gridData![c.y + dy][c.x + dx].color,
        targetOldCodes: { ...draft.gridData![c.y + dy][c.x + dx].codes },
      }));

      const positions: Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }> = [];

      // 记录原位置清空
      for (const m of moves) {
        positions.push({
          x: m.sx, y: m.sy,
          oldColor: m.color,
          oldCodes: m.codes,
          newColor: 'transparent',
          newCodes: {},
        });
      }
      // 记录新位置填充
      for (const m of moves) {
        positions.push({
          x: m.dx, y: m.dy,
          oldColor: m.targetOldColor,
          oldCodes: m.targetOldCodes,
          newColor: m.color,
          newCodes: m.codes,
        });
      }

      // 应用：先清空原位置
      for (const m of moves) {
        draft.gridData![m.sy][m.sx].color = 'transparent';
        draft.gridData![m.sy][m.sx].codes = {};
      }
      // 再填充新位置
      for (const m of moves) {
        draft.gridData![m.dy][m.dx].color = m.color;
        draft.gridData![m.dy][m.dx].codes = m.codes;
      }

      draft.selectedCells = moves.map((m) => ({ x: m.dx, y: m.dy }));
      draft.colorList = recalculateColorList(draft.gridData!);

      if (draft.historyStack.length >= MAX_HISTORY_SIZE) draft.historyStack.shift();
      draft.historyStack.push({ type: 'batch_paint', layerId, tool: 'wand_move', positions });
      draft.redoStack = [];

      const layer = draft.layers.find((l) => l.id === layerId);
      if (layer && layer.type === 'bead') {
        layer.gridData = draft.gridData;
        layer.colorList = draft.colorList;
      }
    }));
  },

  fillSelection: () => {
    const { gridData, selectedCells, selectedColor, activeLayerId } = get();
    if (!gridData || selectedCells.length === 0 || !selectedColor) return;

    const layerId = activeLayerId || 'default';
    const positions = selectedCells.map((c) => ({
      x: c.x, y: c.y,
      oldColor: gridData[c.y][c.x].color,
      oldCodes: { ...gridData[c.y][c.x].codes },
      newColor: selectedColor.hex,
      newCodes: { ...selectedColor.codes },
    }));

    set(produce((draft: EditorState) => {
      for (const p of positions) {
        draft.gridData![p.y][p.x].color = p.newColor;
        draft.gridData![p.y][p.x].codes = p.newCodes;
      }
      draft.colorList = recalculateColorList(draft.gridData!);
      draft.selectedCells = [];
      if (draft.historyStack.length >= MAX_HISTORY_SIZE) draft.historyStack.shift();
      draft.historyStack.push({ type: 'batch_paint', layerId, tool: 'wand_fill', positions });
      draft.redoStack = [];

      const layer = draft.layers.find((l) => l.id === layerId);
      if (layer && layer.type === 'bead') {
        layer.gridData = draft.gridData!;
        layer.colorList = draft.colorList;
      }
    }));
  },

  deleteSelection: () => {
    const { gridData, selectedCells, activeLayerId } = get();
    if (!gridData || selectedCells.length === 0) return;

    const layerId = activeLayerId || 'default';
    const positions = selectedCells.map((c) => ({
      x: c.x, y: c.y,
      oldColor: gridData[c.y][c.x].color,
      oldCodes: { ...gridData[c.y][c.x].codes },
      newColor: 'transparent',
      newCodes: {},
    }));

    set(produce((draft: EditorState) => {
      for (const p of positions) {
        draft.gridData![p.y][p.x].color = 'transparent';
        draft.gridData![p.y][p.x].codes = {};
      }
      draft.colorList = recalculateColorList(draft.gridData!);
      draft.selectedCells = [];
      if (draft.historyStack.length >= MAX_HISTORY_SIZE) draft.historyStack.shift();
      draft.historyStack.push({ type: 'batch_paint', layerId, tool: 'wand_delete', positions });
      draft.redoStack = [];

      const layer = draft.layers.find((l) => l.id === layerId);
      if (layer && layer.type === 'bead') {
        layer.gridData = draft.gridData!;
        layer.colorList = draft.colorList;
      }
    }));
  },

  replaceColorGlobally: (fromHex, toHex, toCodes) => {
    const { gridData } = get();
    if (!gridData || fromHex === toHex) return;

    const positions: Array<{ x: number; y: number; oldColor: string; oldCodes: Record<string, string>; newColor: string; newCodes: Record<string, string> }> = [];
    for (let y = 0; y < gridData.length; y++) {
      for (let x = 0; x < gridData[y].length; x++) {
        if (gridData[y][x].color === fromHex) {
          positions.push({
            x, y,
            oldColor: gridData[y][x].color,
            oldCodes: { ...gridData[y][x].codes },
            newColor: toHex,
            newCodes: { ...toCodes },
          });
        }
      }
    }

    if (positions.length > 0) {
      const layerId = get().activeLayerId || 'default';
      set(produce((draft: EditorState) => {
        positions.forEach((pos) => {
          draft.gridData![pos.y][pos.x].color = pos.newColor;
          draft.gridData![pos.y][pos.x].codes = pos.newCodes;
        });
        draft.colorList = recalculateColorList(draft.gridData!);
        draft.historyStack.push({ type: 'batch_paint', layerId, tool: 'replace_global', positions });
        draft.redoStack = [];

        const layer = draft.layers.find((l) => l.id === layerId);
        if (layer && layer.type === 'bead') {
          positions.forEach((pos) => {
            layer.gridData[pos.y][pos.x].color = pos.newColor;
            layer.gridData[pos.y][pos.x].codes = pos.newCodes;
          });
          layer.colorList = recalculateColorList(layer.gridData);
        }
      }));
    }
  },

  createBlankGrid: (size) => {
    const grid = createEmptyGrid(size);
    const id = genId();
    const layer: BeadLayer = {
      id,
      name: '图层 1',
      type: 'bead',
      visible: true,
      locked: false,
      opacity: 100,
      zIndex: 0,
      gridData: grid,
      colorList: [],
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    };
    set({ layers: [layer], activeLayerId: id, gridData: grid, colorList: [], historyStack: [], redoStack: [], selectedCells: [] });
  },

  exportProject: () => {
    const state = get();
    return {
      version: '3.0',
      createdAt: new Date().toISOString(),
      layers: state.layers,
      activeLayerId: state.activeLayerId,
      // 向后兼容字段
      gridData: state.gridData,
      colorList: state.colorList,
      brand: 'MARD',
      colorMode: 'full',
      mode: 'draw',
      canvasConfig: {},
    };
  },

  importProject: (data) => {
    try {
      const d = data as Record<string, unknown>;
      const version = (d.version as string) || '2.0';

      if (version === '3.0' && d.layers && Array.isArray(d.layers)) {
        const layers = d.layers as PerlerLayer[];
        const activeId = (d.activeLayerId as string) || null;
        const activeLayer = layers.find((l) => l.id === activeId && l.type === 'bead') as BeadLayer | undefined;
        set({
          layers,
          activeLayerId: activeId,
          gridData: activeLayer ? activeLayer.gridData : null,
          colorList: activeLayer ? activeLayer.colorList : [],
          historyStack: [],
          redoStack: [],
          selectedCells: [],
          isolatedCells: [],
          unstableCells: [],
        });
        return true;
      }

      // v2.0 兼容
      if (!d.gridData || !Array.isArray(d.gridData)) return false;
      const grid = d.gridData as GridCell[][];
      const colors = (d.colorList as ColorInfo[]) || recalculateColorList(grid);
      const id = genId();
      const layer: BeadLayer = {
        id,
        name: '图层 1',
        type: 'bead',
        visible: true,
        locked: false,
        opacity: 100,
        zIndex: 0,
        gridData: grid,
        colorList: colors,
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
      };
      set({
        layers: [layer],
        activeLayerId: id,
        gridData: grid,
        colorList: colors,
        historyStack: [],
        redoStack: [],
        selectedCells: [],
        isolatedCells: [],
        unstableCells: [],
      });
      return true;
    } catch {
      return false;
    }
  },

  // ========== 图层系统 Actions ==========
  setActiveLayer: (id) => {
    const state = get();
    const layer = state.layers.find((l) => l.id === id);
    if (layer && layer.type === 'bead') {
      set({ activeLayerId: id, gridData: layer.gridData, colorList: layer.colorList, historyStack: [], redoStack: [], selectedCells: [] });
    } else if (layer && layer.type === 'image') {
      // 切换到 image 图层时保留当前可见的 bead 图层数据，避免画布消失
      const visibleBead = state.layers.find((l) => l.type === 'bead' && l.visible) as import('../types/perler').BeadLayer | undefined;
      set({ activeLayerId: id, gridData: visibleBead?.gridData ?? state.gridData, colorList: visibleBead?.colorList ?? state.colorList, historyStack: [], redoStack: [], selectedCells: [] });
    } else {
      set({ activeLayerId: null, gridData: null, colorList: [], historyStack: [], redoStack: [], selectedCells: [] });
    }
  },

  addBeadLayer: (name, size) => {
    const state = get();
    const grid = createEmptyGrid(size);
    const id = genId();
    const maxZ = state.layers.reduce((m, l) => Math.max(m, l.zIndex), -1);
    const layer: BeadLayer = {
      id,
      name: name || `图层 ${state.layers.length + 1}`,
      type: 'bead',
      visible: true,
      locked: false,
      opacity: 100,
      zIndex: maxZ + 1,
      gridData: grid,
      colorList: [],
      transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    };
    set({ layers: [...state.layers, layer], activeLayerId: id, gridData: grid, colorList: [], historyStack: [], redoStack: [], selectedCells: [] });
  },

  addImageLayer: (name, imageUrl, initialTransform, size) => {
    const state = get();
    const id = genId();
    const maxZ = state.layers.reduce((m, l) => Math.max(m, l.zIndex), -1);
    const layer = {
      id,
      name: name || `图片 ${state.layers.filter((l) => l.type === 'image').length + 1}`,
      type: 'image' as const,
      visible: true,
      locked: false,
      opacity: 100,
      zIndex: maxZ + 1,
      imageUrl,
      width: size?.width ?? 0,
      height: size?.height ?? 0,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, ...initialTransform },
      scaleLocked: true,
    };
    set({ layers: [...state.layers, layer], activeLayerId: id });
    return id;
  },

  toggleLayerVisible: (id) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (layer) layer.visible = !layer.visible;
    }));
  },

  toggleLayerLock: (id) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (layer) layer.locked = !layer.locked;
    }));
  },

  reorderLayer: (id, direction) => {
    set(produce((draft: EditorState) => {
      const idx = draft.layers.findIndex((l) => l.id === id);
      if (idx === -1) return;
      if (direction === 'up' && idx < draft.layers.length - 1) {
        const temp = draft.layers[idx].zIndex;
        draft.layers[idx].zIndex = draft.layers[idx + 1].zIndex;
        draft.layers[idx + 1].zIndex = temp;
      } else if (direction === 'down' && idx > 0) {
        const temp = draft.layers[idx].zIndex;
        draft.layers[idx].zIndex = draft.layers[idx - 1].zIndex;
        draft.layers[idx - 1].zIndex = temp;
      }
      draft.layers.sort((a, b) => a.zIndex - b.zIndex);
    }));
  },

  deleteLayer: (id) => {
    const state = get();
    const remaining = state.layers.filter((l) => l.id !== id);
    if (remaining.length === 0) {
      set({ layers: [], activeLayerId: null, gridData: null, colorList: [], historyStack: [], redoStack: [], selectedCells: [] });
      return;
    }
    const newActive = remaining[remaining.length - 1];
    if (newActive.type === 'bead') {
      set({ layers: remaining, activeLayerId: newActive.id, gridData: newActive.gridData, colorList: newActive.colorList, historyStack: [], redoStack: [], selectedCells: [] });
    } else {
      set({ layers: remaining, activeLayerId: newActive.id, gridData: null, colorList: [], historyStack: [], redoStack: [], selectedCells: [] });
    }
  },

  updateLayerOpacity: (id, opacity) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (layer) layer.opacity = Math.max(0, Math.min(100, opacity));
    }));
  },

  renameLayer: (id, name) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (layer) layer.name = name.trim() || layer.name;
    }));
  },

  updateImageTransform: (id, patch) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (layer && layer.type === 'image') {
        layer.transform = { ...layer.transform, ...patch };
      }
    }));
  },

  updateBeadLayerTransform: (id, patch) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (layer && layer.type === 'bead') {
        layer.transform = { ...layer.transform, ...patch };
      }
    }));
  },

  toggleScaleLocked: (id) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (layer && layer.type === 'image') {
        layer.scaleLocked = !layer.scaleLocked;
      }
    }));
  },

  moveLayerContent: (id, dx, dy) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (!layer || layer.type !== 'bead' || !layer.gridData) return;
      const rows = layer.gridData.length;
      const cols = layer.gridData[0].length;
      const newGrid = createEmptyGrid(rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cell = layer.gridData[y][x];
          if (cell.color === 'transparent') continue; // 透明块不移动
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
            newGrid[ny][nx] = { ...cell, x: nx, y: ny };
          }
        }
      }
      layer.gridData = newGrid;
      layer.colorList = recalculateColorList(newGrid);
      if (draft.activeLayerId === id) {
        draft.gridData = newGrid;
        draft.colorList = layer.colorList;
      }
    }));
  },

  flipLayerContent: (id, direction) => {
    set(produce((draft: EditorState) => {
      const layer = draft.layers.find((l) => l.id === id);
      if (!layer) return;
      if (layer.type === 'image') {
        if (layer.locked) return;
        if (direction === 'h') {
          const oldScaleX = layer.transform.scaleX;
          layer.transform.scaleX *= -1;
          layer.transform.x -= layer.width * oldScaleX;
        } else {
          const oldScaleY = layer.transform.scaleY;
          layer.transform.scaleY *= -1;
          layer.transform.y -= layer.height * oldScaleY;
        }
        return;
      }
      if (layer.type !== 'bead' || !layer.gridData) return;
      const rows = layer.gridData.length;
      const cols = layer.gridData[0].length;
      const newGrid: GridCell[][] = [];
      if (direction === 'h') {
        for (let y = 0; y < rows; y++) {
          const row: GridCell[] = [];
          for (let x = 0; x < cols; x++) {
            const src = layer.gridData[y][cols - 1 - x];
            row.push({ ...src, x });
          }
          newGrid.push(row);
        }
      } else {
        for (let y = 0; y < rows; y++) {
          const row: GridCell[] = [];
          for (let x = 0; x < cols; x++) {
            const src = layer.gridData[rows - 1 - y][x];
            row.push({ ...src, y });
          }
          newGrid.push(row);
        }
      }
      layer.gridData = newGrid;
      layer.colorList = recalculateColorList(newGrid);
      if (draft.activeLayerId === id) {
        draft.gridData = newGrid;
        draft.colorList = layer.colorList;
      }
    }));
  },

  mergeLayerDown: (id) => {
    set(produce((draft: EditorState) => {
      const idx = draft.layers.findIndex((l) => l.id === id);
      if (idx <= 0) return;
      const upper = draft.layers[idx];
      const lower = draft.layers[idx - 1];
      if (upper.type !== 'bead' || lower.type !== 'bead') return;
      if (!upper.gridData || !lower.gridData) return;
      const rows = Math.max(upper.gridData.length, lower.gridData.length);
      const cols = Math.max(upper.gridData[0]?.length || 0, lower.gridData[0]?.length || 0);
      const merged = createEmptyGrid(rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const upperCell = upper.gridData[y]?.[x];
          const lowerCell = lower.gridData[y]?.[x];
          if (upperCell && upperCell.color !== 'transparent') {
            merged[y][x] = { ...upperCell, x, y };
          } else if (lowerCell) {
            merged[y][x] = { ...lowerCell, x, y };
          }
        }
      }
      lower.gridData = merged;
      lower.colorList = recalculateColorList(merged);
      draft.layers.splice(idx, 1);
      if (draft.activeLayerId === id) {
        draft.activeLayerId = lower.id;
        draft.gridData = merged;
        draft.colorList = lower.colorList;
      }
    }));
  },
}));
