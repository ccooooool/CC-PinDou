import { create } from 'zustand';
import type { CanvasConfig, Brand } from '../types/perler';

const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  beadSize: 28,
  margin: 45,
  zoomLevel: 1,
  showCode: false,
  showGrid: true,
  circleMode: false,
  showMarkLines: false,
  markInterval: 5,
};

interface ConfigState {
  // ========== 品牌与色数 ==========
  brand: Brand;
  colorMode: 'full' | '221';
  paletteBrand: Brand;

  // ========== 普通图片参数 ==========
  gridSize: number;
  removeBg: boolean;
  bgModel: string;
  colorSimplify: number;
  enhanceLines: number;
  removeBgThreshold: number;

  // ========== 像素图参数 ==========
  pixelSize: number;
  pixelOffsetX: number;
  pixelOffsetY: number;
  pixelSampleMethod: 'center' | 'mode' | 'mean';
  pixelImageUrl: string | null;
  pixelCols: number;
  pixelRows: number;

  // ========== 画布配置 ==========
  canvasConfig: CanvasConfig;

  // ========== Actions ==========
  setBrand: (brand: Brand) => void;
  setColorMode: (mode: 'full' | '221') => void;
  setPaletteBrand: (brand: Brand) => void;

  setGridSize: (size: number) => void;
  setRemoveBg: (v: boolean) => void;
  setBgModel: (m: string) => void;
  setColorSimplify: (v: number) => void;
  setEnhanceLines: (v: number) => void;
  setRemoveBgThreshold: (v: number) => void;

  setPixelSize: (v: number) => void;
  setPixelOffsetX: (v: number) => void;
  setPixelOffsetY: (v: number) => void;
  setPixelSampleMethod: (v: 'center' | 'mode' | 'mean') => void;
  setPixelImageUrl: (url: string | null) => void;
  setPixelCols: (v: number) => void;
  setPixelRows: (v: number) => void;

  updateCanvasConfig: (patch: Partial<CanvasConfig>) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  brand: 'MARD',
  colorMode: 'full',
  paletteBrand: 'MARD',

  gridSize: 52,
  removeBg: true,
  bgModel: 'u2net',
  colorSimplify: 0,
  enhanceLines: 0,
  removeBgThreshold: 30,

  pixelSize: 16,
  pixelOffsetX: 0,
  pixelOffsetY: 0,
  pixelSampleMethod: 'mode',
  pixelImageUrl: null,
  pixelCols: 0,
  pixelRows: 0,

  canvasConfig: { ...DEFAULT_CANVAS_CONFIG },

  setBrand: (brand) => set({ brand }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setPaletteBrand: (brand) => set({ paletteBrand: brand }),

  setGridSize: (size) => set({ gridSize: size }),
  setRemoveBg: (v) => set({ removeBg: v }),
  setBgModel: (m) => set({ bgModel: m }),
  setColorSimplify: (v) => set({ colorSimplify: v }),
  setEnhanceLines: (v) => set({ enhanceLines: v }),
  setRemoveBgThreshold: (v) => set({ removeBgThreshold: v }),

  setPixelSize: (v) => set({ pixelSize: v }),
  setPixelOffsetX: (v) => set({ pixelOffsetX: v }),
  setPixelOffsetY: (v) => set({ pixelOffsetY: v }),
  setPixelSampleMethod: (v) => set({ pixelSampleMethod: v }),
  setPixelImageUrl: (url) => set({ pixelImageUrl: url }),
  setPixelCols: (v) => set({ pixelCols: v }),
  setPixelRows: (v) => set({ pixelRows: v }),

  updateCanvasConfig: (patch) =>
    set((state) => ({
      canvasConfig: { ...state.canvasConfig, ...patch },
    })),
}));
