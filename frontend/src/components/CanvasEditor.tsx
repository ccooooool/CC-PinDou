import { useRef, useState } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';
import { useProjectExport } from '../hooks/useProjectExport';
import { Grid3X3, FolderOpen, Upload } from 'lucide-react';
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

export function CanvasEditor({ onImageSelect }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pixelInputRef = useRef<HTMLInputElement>(null);
  const [pixelUploaderHover, setPixelUploaderHover] = useState(false);

  const gridData = useEditorStore((s) => s.gridData);
  const activeLayerLocked = useEditorStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.locked ?? false);
  const isImageLayer = useEditorStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.type === 'image');
  const createBlankGrid = useEditorStore((s) => s.createBlankGrid);
  const drawGridSize = useUIStore((s) => s.drawGridSize);
  const setDrawGridSize = useUIStore((s) => s.setDrawGridSize);
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
            className="nook-panel px-6 py-6"
            style={{
              ['--uploader-hover-border' as string]: theme.main,
              ['--uploader-hover-bg' as string]: `color-mix(in srgb, ${theme.main} 4%, transparent)`,
            }}
          >
            {mode === 'normal' && onImageSelect ? (
              <ImageUploader onImageSelect={onImageSelect} />
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
                <p className="mt-2 mb-1 text-sm font-bold text-[var(--text-main)]">点击或拖拽上传像素图</p>
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
          <Card variant="default" className="nook-panel w-80 px-7 py-6">
          <div className="text-base font-bold text-[var(--text-main)] mb-4 text-center">
            创建空白画板
          </div>
          <div className="flex items-center gap-2.5 mb-4">
            <label className="text-xs font-bold text-[var(--text-muted)] flex-shrink-0">尺寸</label>
            <Slider
              value={[drawGridSize]}
              onValueChange={([v]) => setDrawGridSize(v)}
              min={8}
              max={128}
              step={1}
              themeColor={theme.main}
            />
            <span className="text-sm font-bold min-w-[40px]" style={{ color: theme.main }}>
              {drawGridSize}×{drawGridSize}
            </span>
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
          : isImageLayer
            ? 'move'
            : activeLayerLocked
              ? 'not-allowed'
              : isDrawMode
                ? 'crosshair'
                : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px',
      }}
    >
      <div className="dop-canvas relative z-10 mx-auto">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className="block flex-shrink-0"
        />
      </div>
    </div>
  );
}
