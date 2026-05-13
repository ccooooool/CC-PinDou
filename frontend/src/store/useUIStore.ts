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
  drawTool: 'pen' | 'line' | 'rect' | 'circle' | 'fill' | 'eraser' | 'wand' | 'replace';
  symmetryMode: 'none' | 'horizontal' | 'vertical' | 'quad' | 'diagonal' | 'diagonal_anti' | 'diagonal_quad';
  brushSize: number;
  drawGridSize: number;
  shapeFilled: boolean;

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
  setBrushSize: (v: number) => void;
  setDrawGridSize: (v: number) => void;
  setShapeFilled: (v: boolean) => void;

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
      drawGridSize: 32,
      shapeFilled: true,

      replaceMode: 'brush',
      replaceSourceColor: null,
      replaceTargetColor: null,
      replaceTargetCodes: {},

      setMode: (mode) => set({ mode }),
      toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
      toggleLegend: () => set((state) => ({ legendCollapsed: !state.legendCollapsed })),
      setLastSavedAt: (ts) => set({ lastSavedAt: ts }),

      setDrawTool: (tool) => set({ drawTool: tool }),
      setSymmetryMode: (mode) => set({ symmetryMode: mode }),
      setBrushSize: (v) => set({ brushSize: v }),
      setDrawGridSize: (v) => set({ drawGridSize: v }),
      setShapeFilled: (v) => set({ shapeFilled: v }),

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
        drawGridSize: state.drawGridSize,
        shapeFilled: state.shapeFilled,
        replaceMode: state.replaceMode,
        replaceSourceColor: state.replaceSourceColor,
        replaceTargetColor: state.replaceTargetColor,
        replaceTargetCodes: state.replaceTargetCodes,
      }),
    }
  )
);
