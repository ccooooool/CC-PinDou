import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // ========== 模式 ==========
  mode: 'normal' | 'pixel' | 'draw';

  // ========== 面板状态 ==========
  leftPanelCollapsed: boolean;
  legendCollapsed: boolean;
  lastSavedAt: number | null;

  // ========== 绘制模式参数 ==========
  drawTool: 'pen' | 'line' | 'rect' | 'circle' | 'fill' | 'eraser' | 'wand' | 'replace' | 'move' | 'eyedropper';
  symmetryMode: 'none' | 'horizontal' | 'vertical' | 'quad' | 'diagonal' | 'diagonal_anti' | 'diagonal_quad';
  brushSize: number;                    // 当前激活工具的笔刷大小
  brushSizes: Record<string, number>;   // 每个工具独立的笔刷大小
  drawGridSize: number;
  shapeFilled: boolean;                 // 当前激活工具是否填充
  shapeFillMap: Record<string, boolean>; // 每个工具独立的填充状态

  // 替换工具配置
  replaceMode: 'brush' | 'global';
  replaceSourceColor: string | null;
  replaceTargetColor: string | null;
  replaceTargetCodes: Record<string, string>;

  // ========== Actions ==========
  setMode: (mode: 'normal' | 'pixel' | 'draw') => void;
  toggleLeftPanel: () => void;
  toggleLegend: () => void;
  setLastSavedAt: (ts: number | null) => void;

  setDrawTool: (tool: UIState['drawTool']) => void;
  setSymmetryMode: (mode: UIState['symmetryMode']) => void;
  setBrushSize: (v: number, tool?: string) => void;
  setDrawGridSize: (v: number) => void;
  setShapeFilled: (v: boolean, tool?: string) => void;

  setReplaceMode: (mode: 'brush' | 'global') => void;
  setReplaceSourceColor: (hex: string | null) => void;
  setReplaceTargetColor: (hex: string | null, codes?: Record<string, string>) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      mode: 'normal',
      leftPanelCollapsed: false,
      legendCollapsed: false,
      lastSavedAt: null,

      drawTool: 'pen',
      symmetryMode: 'none',
      brushSize: 1,
      brushSizes: { pen: 1, eraser: 1, line: 1, rect: 1, circle: 1 },
      drawGridSize: 32,
      shapeFilled: true,
      shapeFillMap: { rect: true, circle: true },

      replaceMode: 'brush',
      replaceSourceColor: null,
      replaceTargetColor: null,
      replaceTargetCodes: {},

      setMode: (mode) => set({ mode }),
      toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
      toggleLegend: () => set((state) => ({ legendCollapsed: !state.legendCollapsed })),
      setLastSavedAt: (ts) => set({ lastSavedAt: ts }),

      setDrawTool: (tool) => set((state) => {
        // 保存当前工具的配置
        const next: Partial<UIState> = {
          drawTool: tool,
          brushSizes: { ...state.brushSizes, [state.drawTool]: state.brushSize },
          shapeFillMap: { ...state.shapeFillMap, [state.drawTool]: state.shapeFilled },
        };
        // 加载新工具的配置
        next.brushSize = next.brushSizes![tool] || 1;
        next.shapeFilled = next.shapeFillMap![tool] ?? (tool === 'rect' || tool === 'circle');
        return next;
      }),
      setSymmetryMode: (mode) => set({ symmetryMode: mode }),
      setBrushSize: (v, tool) => set((state) => {
        const t = tool || state.drawTool;
        return {
          ...(state.drawTool === t ? { brushSize: v } : {}),
          brushSizes: { ...state.brushSizes, [t]: v },
        };
      }),
      setDrawGridSize: (v) => set({ drawGridSize: v }),
      setShapeFilled: (v, tool) => set((state) => {
        const t = tool || state.drawTool;
        return {
          ...(state.drawTool === t ? { shapeFilled: v } : {}),
          shapeFillMap: { ...state.shapeFillMap, [t]: v },
        };
      }),

      setReplaceMode: (mode) => set({ replaceMode: mode }),
      setReplaceSourceColor: (hex) => set({ replaceSourceColor: hex }),
      setReplaceTargetColor: (hex, codes) => set({ replaceTargetColor: hex, replaceTargetCodes: codes || {} }),
    }),
    {
      name: 'pindou-ui',
      partialize: (state) => ({
        drawTool: state.drawTool,
        symmetryMode: state.symmetryMode,
        brushSize: state.brushSize,
        brushSizes: state.brushSizes,
        drawGridSize: state.drawGridSize,
        shapeFilled: state.shapeFilled,
        shapeFillMap: state.shapeFillMap,
        replaceMode: state.replaceMode,
        replaceSourceColor: state.replaceSourceColor,
        replaceTargetColor: state.replaceTargetColor,
        replaceTargetCodes: state.replaceTargetCodes,
      }),
    }
  )
);
