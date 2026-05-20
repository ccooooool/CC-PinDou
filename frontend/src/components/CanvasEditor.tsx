import { useRef, useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';
import { useConfigStore } from '../store/useConfigStore';
import { useProjectExport } from '../hooks/useProjectExport';
import {
  Grid3X3, FolderOpen, Upload,
  Pencil, Minus, Square, Circle, PaintBucket, Eraser, Wand2, Replace, Move, Pipette,
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { Slider } from './ui/slider';
import { ImageUploader } from './ImageUploader';

import { useCanvasRenderer } from '../hooks/useCanvasRenderer';
import { getModeTheme } from '../utils/theme';
import { useDrawingTools } from '../hooks/useDrawingTools';
import { usePanZoom } from '../hooks/usePanZoom';
import { useCanvasInteractions } from '../hooks/useCanvasInteractions';
import ModeBackground from './ModeBackground';

interface CanvasEditorProps {
  onImageSelect?: (file: File, dataUrl: string) => void;
}

// ─── 放大镜配置 ───
const MAGNIFIER_SIZE = 120;
const MAGNIFIER_ZOOM = 8;

export function CanvasEditor({ onImageSelect }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pixelInputRef = useRef<HTMLInputElement>(null);
  const [pixelUploaderHover, setPixelUploaderHover] = useState(false);

  // 自定义工具光标
  const cursorProxyRef = useRef<HTMLDivElement>(null);
  const [cursorInCanvas, setCursorInCanvas] = useState(false);

  // 放大镜 refs
  const magnifierRef = useRef<HTMLDivElement>(null);
  const magnifierCanvasRef = useRef<HTMLCanvasElement>(null);
  const [magnifierColor, setMagnifierColor] = useState<string>('');

  const gridData = useEditorStore((s) => s.gridData);
  const activeLayer = useEditorStore((s) => s.layers.find((l) => l.id === s.activeLayerId));
  const activeLayerLocked = activeLayer?.locked ?? false;
  const isImageLayer = activeLayer?.type === 'image';
  const createBlankGrid = useEditorStore((s) => s.createBlankGrid);
  const margin = useConfigStore((s) => s.canvasConfig.margin);
  const drawGridSize = useUIStore((s) => s.drawGridSize);
  const setDrawGridSize = useUIStore((s) => s.setDrawGridSize);
  const drawTool = useUIStore((s) => s.drawTool);
  const { handleOpenProject, handleFileSelected, fileInputRef } = useProjectExport();

  const { scheduleDrawGrid, getGridXY, setShapePreview, setBrushPreview } = useCanvasRenderer(canvasRef);
  const {
    paintCell,
    paintAt,
    floodFill,
    bresenhamLine,
    midPointCircle,
    isDrawMode,
  } = useDrawingTools();
  const mode = useUIStore((s) => s.mode);
  const theme = getModeTheme(mode);
  const { spacePressed, isDragging, startDrag, onDragMove, stopDrag } = usePanZoom(containerRef);

  const {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useCanvasInteractions(
    getGridXY,
    paintCell,
    paintAt,
    floodFill,
    bresenhamLine,
    midPointCircle,
    scheduleDrawGrid,
    setShapePreview,
    setBrushPreview,
    stopDrag,
    startDrag,
    onDragMove,
    spacePressed,
    isDragging,
  );

  // 图片图层原始图片缓存（用于放大镜/取色）
  const activeImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isImageLayer && activeLayer?.type === 'image') {
      const img = new Image();
      img.onload = () => {
        activeImageRef.current = img;
      };
      img.src = activeLayer.imageUrl;
      return () => {
        activeImageRef.current = null;
      };
    }
    activeImageRef.current = null;
  }, [isImageLayer, activeLayer]);

  // ─── 放大镜绘制 ───
  const drawMagnifier = useCallback((canvasX: number, canvasY: number) => {
    const mainCanvas = canvasRef.current;
    const magCanvas = magnifierCanvasRef.current;
    if (!mainCanvas || !magCanvas) return;

    const magCtx = magCanvas.getContext('2d');
    if (!magCtx) return;

    magCtx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
    magCtx.imageSmoothingEnabled = false;

    const srcSize = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
    const cx = MAGNIFIER_SIZE / 2;
    const cy = MAGNIFIER_SIZE / 2;

    // 图片图层取色时：从原始图片读取放大细节
    if (isImageLayer && activeLayer?.type === 'image' && activeImageRef.current?.complete) {
      const img = activeImageRef.current;
      const t = activeLayer.transform;

      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const dx = canvasX - margin - t.x - w / 2;
      const dy = canvasY - margin - t.y - h / 2;
      const rad = (-t.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rdx = dx * cos - dy * sin;
      const rdy = dx * sin + dy * cos;
      const imgX = Math.round(rdx / t.scaleX + w / 2);
      const imgY = Math.round(rdy / t.scaleY + h / 2);

      const srcX = imgX - srcSize / 2;
      const srcY = imgY - srcSize / 2;

      magCtx.drawImage(
        img,
        srcX, srcY, srcSize, srcSize,
        0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE,
      );

      // 从原始图片读取中心像素颜色
      if (imgX >= 0 && imgX < img.naturalWidth && imgY >= 0 && imgY < img.naturalHeight) {
        const tempC = document.createElement('canvas');
        tempC.width = 1; tempC.height = 1;
        const tempCtx = tempC.getContext('2d')!;
        tempCtx.drawImage(img, imgX, imgY, 1, 1, 0, 0, 1, 1);
        const d = tempCtx.getImageData(0, 0, 1, 1).data;
        const hex = `#${d[0].toString(16).padStart(2, '0')}${d[1].toString(16).padStart(2, '0')}${d[2].toString(16).padStart(2, '0')}`;
        setMagnifierColor(hex.toUpperCase());
      }
    } else {
      const srcX = canvasX - srcSize / 2;
      const srcY = canvasY - srcSize / 2;

      magCtx.drawImage(
        mainCanvas,
        srcX, srcY, srcSize, srcSize,
        0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE,
      );

      // 读取中心像素颜色
      const mainCtx = mainCanvas.getContext('2d');
      if (mainCtx) {
        const d = mainCtx.getImageData(canvasX, canvasY, 1, 1).data;
        const hex = `#${d[0].toString(16).padStart(2, '0')}${d[1].toString(16).padStart(2, '0')}${d[2].toString(16).padStart(2, '0')}`;
        setMagnifierColor(hex.toUpperCase());
      }
    }

    // 十字准星阴影
    magCtx.strokeStyle = 'rgba(0,0,0,0.6)';
    magCtx.lineWidth = 2;
    magCtx.beginPath();
    magCtx.moveTo(cx, 4); magCtx.lineTo(cx, MAGNIFIER_SIZE - 4);
    magCtx.moveTo(4, cy); magCtx.lineTo(MAGNIFIER_SIZE - 4, cy);
    magCtx.stroke();

    // 十字准星白线
    magCtx.strokeStyle = 'rgba(255,255,255,0.95)';
    magCtx.lineWidth = 1;
    magCtx.beginPath();
    magCtx.moveTo(cx, 4); magCtx.lineTo(cx, MAGNIFIER_SIZE - 4);
    magCtx.moveTo(4, cy); magCtx.lineTo(MAGNIFIER_SIZE - 4, cy);
    magCtx.stroke();

    // 中心像素红框高亮
    const pSize = MAGNIFIER_ZOOM;
    const halfP = pSize / 2;
    magCtx.strokeStyle = '#ff3c3c';
    magCtx.lineWidth = 1.5;
    magCtx.strokeRect(cx - halfP, cy - halfP, pSize, pSize);
  }, [isImageLayer, activeLayer, margin]);

  const hideMagnifier = useCallback(() => {
    if (magnifierRef.current) {
      magnifierRef.current.style.display = 'none';
    }
  }, []);

  // ─── 用 ref 包装事件处理器，避免闭包问题 ───
  const handlersRef = useRef({
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  });
  useEffect(() => {
    handlersRef.current = { handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handlersRef.current.handleMouseMove(e);

    if (drawTool === 'eyedropper' && e.buttons === 1 && canvasRef.current) {
      // 图片图层：显示放大镜；bead 图层：隐藏放大镜，由 brushPreview 提供单格指示
      if (isImageLayer) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const canvasX = Math.floor((e.clientX - rect.left) * scaleX);
        const canvasY = Math.floor((e.clientY - rect.top) * scaleY);

        if (magnifierRef.current) {
          magnifierRef.current.style.display = 'block';
          let left = e.clientX + 20;
          let top = e.clientY - MAGNIFIER_SIZE - 20;

          if (left + MAGNIFIER_SIZE + 12 > window.innerWidth) {
            left = e.clientX - MAGNIFIER_SIZE - 20;
          }
          if (top < 12) {
            top = e.clientY + 24;
          }
          if (top + MAGNIFIER_SIZE + 40 > window.innerHeight) {
            top = e.clientY - MAGNIFIER_SIZE - 20;
          }

          magnifierRef.current.style.left = `${left}px`;
          magnifierRef.current.style.top = `${top}px`;
        }

        drawMagnifier(canvasX, canvasY);
      } else {
        hideMagnifier();
      }
    } else {
      hideMagnifier();
    }
  }, [drawTool, drawMagnifier, hideMagnifier]);

  const onMouseUp = useCallback(() => {
    handlersRef.current.handleMouseUp();
    hideMagnifier();
  }, [hideMagnifier]);

  const onMouseEnter = useCallback(() => {
    setCursorInCanvas(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    handlersRef.current.handleMouseLeave();
    hideMagnifier();
    setCursorInCanvas(false);
  }, [hideMagnifier]);

  // 全局 mouseup：防止在 canvas 外松开时放大镜残留
  useEffect(() => {
    const onGlobalUp = () => hideMagnifier();
    window.addEventListener('mouseup', onGlobalUp);
    return () => window.removeEventListener('mouseup', onGlobalUp);
  }, [hideMagnifier]);

  // 全局 mousemove：更新自定义光标代理位置（右下角跟随）
  useEffect(() => {
    const onGlobalMove = (e: MouseEvent) => {
      if (cursorProxyRef.current) {
        cursorProxyRef.current.style.transform = `translate3d(${e.clientX + 10}px, ${e.clientY + 10}px, 0)`;
      }
    };
    document.addEventListener('mousemove', onGlobalMove);
    return () => document.removeEventListener('mousemove', onGlobalMove);
  }, []);

  const hasGrid = gridData && gridData.length > 0;

  // normal / pixel 模式空状态：上传图片
  if (!hasGrid && !isDrawMode) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <ModeBackground mode={mode} />
        </div>
        <div className="relative z-10 w-full max-w-md px-6">
          <Card
            variant={mode === 'normal' ? 'blue' : mode === 'pixel' ? 'yellow' : 'default'}
            className="px-6 py-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden"
            style={{
              ['--uploader-hover-border' as string]: theme.main,
              ['--uploader-hover-bg' as string]: `color-mix(in srgb, ${theme.main} 4%, transparent)`,
            }}
          >
            {mode === 'normal' && onImageSelect ? (
              <ImageUploader onImageSelect={onImageSelect} themeColor={theme.main} />
            ) : mode === 'pixel' ? (
              <div
                className="p-8 text-center cursor-pointer transition-all duration-300"
                style={{
                  borderStyle: 'dashed',
                  borderColor: theme.main,
                  borderWidth: '3px',
                  borderRadius: 'var(--radius-md)',
                  background: pixelUploaderHover ? `color-mix(in srgb, ${theme.main} 4%, transparent)` : undefined,
                  transform: pixelUploaderHover ? 'translateY(-2px)' : undefined,
                }}
                onClick={() => pixelInputRef.current?.click()}
                onMouseEnter={() => setPixelUploaderHover(true)}
                onMouseLeave={() => setPixelUploaderHover(false)}
              >
                <input
                  ref={pixelInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      window.dispatchEvent(new CustomEvent('pixel-file-selected', { detail: file }));
                    }
                  }}
                />
                <Upload className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
                <p className="mt-2 mb-1 text-sm font-bold text-[var(--text-main)]">点击或拖拽上传图片</p>
                <p className="m-0 text-xs font-bold text-[var(--text-muted)]">支持 JPG、PNG 格式</p>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    );
  }

  if (!hasGrid && isDrawMode) {
    return (
      <div className="relative flex items-center justify-center h-full w-full">
        <div className="absolute inset-0 overflow-hidden">
          <ModeBackground mode={mode} />
        </div>
        <div className="relative z-10">
          <Card variant="default" className="w-80 px-7 py-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
          <div className="text-base font-bold text-[var(--text-main)] mb-4 text-center">
            创建空白画板
          </div>
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[var(--text-muted)] flex-shrink-0">画板大小</label>
              <span className="text-sm font-bold" style={{ color: theme.main }}>
                {drawGridSize}×{drawGridSize}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Slider
                value={[drawGridSize]}
                onValueChange={([v]) => setDrawGridSize(v)}
                min={8}
                max={128}
                step={1}
                themeColor={theme.main}
                className="flex-1"
              />
              <input
                type="number"
                className="w-16 h-8 shrink-0 rounded-input border-[3px] border-[var(--nook-wood-light)] bg-[var(--bg-surface)] px-1 text-sm text-center text-[var(--text-heading)] font-nook font-semibold focus:outline-none focus:border-[var(--theme-draw)] focus:ring-2 focus:ring-[var(--theme-draw)] transition-all duration-200 disabled:opacity-50"
                value={drawGridSize}
                onChange={(e) => {
                  const v = Math.max(8, Math.min(128, Number(e.target.value)));
                  setDrawGridSize(Math.round(v));
                }}
                min={8}
                max={128}
              />
            </div>
          </div>
          <Button variant="primary" block onClick={() => createBlankGrid(drawGridSize)} style={{ background: theme.main, borderColor: theme.light5 }}>
            <Grid3X3 className="w-4 h-4" />
            新建画板
          </Button>
          <div className="mt-3 text-center">
            <span className="text-xs text-[var(--text-muted)]">或</span>
          </div>
          <Button variant="ghost" block onClick={handleOpenProject}>
            <FolderOpen className="w-4 h-4" />
            打开已有工程
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pindou.json,.json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto relative"
      style={{
        cursor: spacePressed
          ? (isDragging ? 'grabbing' : 'grab')
          : (activeLayerLocked && drawTool !== 'eyedropper')
            ? 'not-allowed'
            : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px',
      }}
    >
      <div className="dop-canvas relative z-10 m-auto">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="block flex-shrink-0"
        />
      </div>

      {/* ─── 自定义工具光标代理 ─── */}
      {cursorInCanvas && isDrawMode && !spacePressed && (!activeLayerLocked || drawTool === 'eyedropper') && (
        <div
          ref={cursorProxyRef}
          className="fixed top-0 left-0 pointer-events-none"
          style={{ zIndex: 99999 }}
        >
          {(() => {
            const iconProps = {
              className: 'w-[18px] h-[18px]',
              style: {
                color: '#fff',
                strokeWidth: 2.5,
              },
            };
            const icon = (() => {
              switch (drawTool) {
                case 'pen': return <Pencil {...iconProps} />;
                case 'line': return <Minus {...iconProps} />;
                case 'rect': return <Square {...iconProps} />;
                case 'circle': return <Circle {...iconProps} />;
                case 'fill': return <PaintBucket {...iconProps} />;
                case 'eraser': return <Eraser {...iconProps} />;
                case 'wand': return <Wand2 {...iconProps} />;
                case 'replace': return <Replace {...iconProps} />;
                case 'move': return <Move {...iconProps} />;
                case 'eyedropper': return <Pipette {...iconProps} />;
                default: return null;
              }
            })();
            if (!icon) return null;
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.75)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(255,255,255,0.25)',
                }}
              >
                {icon}
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── 吸管放大镜浮层 ─── */}
      <div
        ref={magnifierRef}
        style={{
          display: 'none',
          position: 'fixed',
          zIndex: 9999,
          pointerEvents: 'none',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.15)',
          background: '#1a1a1a',
        }}
      >
        <canvas
          ref={magnifierCanvasRef}
          width={MAGNIFIER_SIZE}
          height={MAGNIFIER_SIZE}
          style={{ display: 'block' }}
        />
        {magnifierColor && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: '#1a1a1a',
              borderTop: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                background: magnifierColor,
                border: '1px solid rgba(255,255,255,0.3)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#e0e0e0',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              {magnifierColor}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
