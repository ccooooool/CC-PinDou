/**
 * 拼豆图案核心类型定义
 * 对应原 app.js 中的全局数据结构，升级为类型安全的 TS 接口
 */

/** 单个拼豆格子 */
export interface GridCell {
  x: number;
  y: number;
  color: string; // hex 如 '#FAF4C8' 或 'transparent'
  codes: Record<string, string>; // { MARD: 'A01', COCO: 'E02' }
}

/** 颜色统计信息 */
export interface ColorInfo {
  hex: string;
  count: number;
  codes: Record<string, string>;
}

/** 历史操作类型 */
export type HistoryAction =
  | {
      type: 'paint';
      layerId: string;
      x: number;
      y: number;
      oldColor: string;
      oldCodes: Record<string, string>;
      newColor: string;
      newCodes: Record<string, string>;
    }
  | {
      type: 'batch_paint';
      layerId: string;
      positions: Array<{
        x: number;
        y: number;
        oldColor: string;
        oldCodes: Record<string, string>;
        newColor: string;
        newCodes: Record<string, string>;
      }>;
    }
  | {
      type: 'delete_color';
      layerId: string;
      color: string;
      positions: Array<{
        x: number;
        y: number;
        oldColor: string;
        oldCodes: Record<string, string>;
      }>;
    }
  | {
      type: 'layer_op';
      layerId: string;
      op: 'move' | 'flip_h' | 'flip_v' | 'rotate_cw' | 'rotate_ccw';
      oldGrid: GridCell[][];
      newGrid: GridCell[][];
    }
  | {
      type: 'layer_transform';
      layerId: string;
      oldTransform: {
        x: number;
        y: number;
        scale: number;
        rotation: number;
      };
      newTransform: {
        x: number;
        y: number;
        scale: number;
        rotation: number;
      };
    };

// =============================================================================
// 图层系统（Phase 1: 绘制模式 Photoshop 化重构）
// =============================================================================

/** 图层基础属性 */
export interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0-100
  zIndex: number;
}

/** 拼豆绘制图层 */
export interface BeadLayer extends LayerBase {
  type: 'bead';
  gridData: GridCell[][];
  colorList: ColorInfo[];
  transform: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
}

/** 背景图片图层 */
export interface ImageLayer extends LayerBase {
  type: 'image';
  imageUrl: string;
  transform: {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
  };
  scaleLocked: boolean;
}

/** 图层联合类型 */
export type PerlerLayer = BeadLayer | ImageLayer;

/** 工程文件 v3.0 格式 */
export interface ProjectV3 {
  version: '3.0';
  layers: PerlerLayer[];
  activeLayerId: string | null;
  brand: Brand;
  colorMode: 'full' | '221';
  mode: 'normal' | 'pixel' | 'draw';
  canvasConfig: CanvasConfig;
  drawTool?: string;
  symmetryMode?: string;
  brushSize?: number;
}

/** 画布渲染配置 */
export interface CanvasConfig {
  beadSize: number;
  margin: number;
  zoomLevel: number;
  showCode: boolean;
  showGrid: boolean;
  circleMode: boolean;
  showMarkLines: boolean;
  markInterval: number;
}

/** 导出选项 */
export interface ExportOptions {
  fileName: string;
  format: 'png' | 'jpg';
  showCode: boolean;
  showLegend: boolean;
  circleMode: boolean;
  showMarkLines: boolean;
  markInterval: number;
}

/** 生成参数（普通图片模式） */
export interface GenerateParams {
  gridSize: number;
  removeBg: boolean;
  colorSimplify: number;
  removeBgThreshold: number;
  enhanceLinesStrength: number;
  bgModel: string | null;
  colorMode: 'full' | '221';
}

/** 像素图生成参数 */
export interface PixelGenerateParams {
  pixelSize: number;
  pixelSizeW?: number;
  pixelSizeH?: number;
  offsetX: number;
  offsetY: number;
  boardSize: number;
  samplingMode: 'center' | 'mode' | 'average';
  removeBg: boolean;
  bgThreshold: number;
  colorQuantize: number;
  colorMode: 'full' | '221';
}

/** 色号映射 JSON 结构 */
export type ColorMapping = Record<string, Record<string, string>>;

/** 品牌列表 */
export const BRANDS = ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'] as const;
export type Brand = (typeof BRANDS)[number];
