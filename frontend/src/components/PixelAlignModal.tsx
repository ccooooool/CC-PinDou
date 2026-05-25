import { useRef, useLayoutEffect, useState, useCallback } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { Modal } from './ui/modal';
import { FormSlider, Button } from '@/components/ui';
import { Select } from './ui/select';
import { GridLineColorPicker, hexToRgba } from './GridLineColorPicker';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Wand2 } from 'lucide-react';
import { getModeTheme } from '../utils/theme';

const SAMPLE_OPTIONS = [
  { key: 'mode', label: '众数 (Mode)' },
  { key: 'center', label: '中心(Center)' },
  { key: 'mean', label: '平均(Mean)' },
];

interface PixelAlignModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewImage: HTMLImageElement | null;
  onGenerate: () => void;
  isGenerating?: boolean;
}

export function PixelAlignModal({ isOpen, onClose, previewImage, onGenerate, isGenerating }: PixelAlignModalProps) {
  const theme = getModeTheme('pixel');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const {
    pixelSize: rawPixelSize,
    pixelOffsetX,
    pixelOffsetY,
    pixelGridColor,
    pixelSampleMethod,
    setPixelSize: setRawPixelSize,
    setPixelOffsetX,
    setPixelOffsetY,
    setPixelGridColor,
    setPixelSampleMethod,
  } = useConfigStore();

  const pixelSize = Math.max(1, rawPixelSize || 1);
  const setPixelSize = (v: number) => setRawPixelSize(Math.max(1, Number(v) || 1));

  const calcBestZoom = useCallback(
    (cw: number, ch: number) => {
      const container = containerRef.current;
      if (!container) return 1;
      const rect = container.getBoundingClientRect();
      const containerSize = Math.min(rect.width, rect.height);
      if (containerSize <= 0 || cw <= 0 || ch <= 0) return 1;
      const maxCanvas = Math.max(cw, ch);
      const fitZoom = (containerSize - 32) / maxCanvas;
      return Math.max(0.5, Math.min(10, Math.round(fitZoom * 10) / 10));
    },
    []
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = previewImage;
    if (!canvas || !img || pixelSize <= 0) return false;
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const maxW = 720;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const cw = Math.max(1, Math.floor(img.naturalWidth * scale));
    const ch = Math.max(1, Math.floor(img.naturalHeight * scale));

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    const ps = pixelSize * scale;
    const ox = (pixelOffsetX % pixelSize) * scale;
    const oy = (pixelOffsetY % pixelSize) * scale;

    ctx.strokeStyle = hexToRgba(pixelGridColor, 0.7);
    ctx.lineWidth = 1;

    for (let x = ox; x < cw; x += ps) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    }
    for (let y = oy; y < ch; y += ps) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    return true;
  }, [previewImage, pixelSize, pixelOffsetX, pixelOffsetY, pixelGridColor]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const ok = draw();
      if (ok) {
        const img = previewImage;
        if (img) {
          const scale = Math.min(1, 720 / img.naturalWidth);
          const cw = Math.max(1, Math.floor(img.naturalWidth * scale));
          const ch = Math.max(1, Math.floor(img.naturalHeight * scale));
          setZoom(calcBestZoom(cw, ch));
        }
      }
    });
  }, [isOpen, draw, previewImage, calcBestZoom]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    draw();
  }, [isOpen, draw, pixelSize, pixelOffsetX, pixelOffsetY, pixelGridColor]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(10, Math.round((prev + delta) * 10) / 10)));
  }, []);

  const hasImage = previewImage && previewImage.complete && previewImage.naturalWidth > 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="对齐精细调整"
      themeColor={theme.main}
      width={900}
    >
      <div className="flex flex-col gap-4">
        {/* 正方形 Canvas 显示区 + 浮动缩放 */}
        <div
          ref={containerRef}
          className="relative mx-auto w-full max-w-[520px] aspect-square rounded-xl overflow-hidden border border-[var(--border-subtle)]"
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'repeating-linear-gradient(45deg, #ddd, #ddd 4px, #fff 4px, #fff 8px)',
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center overflow-auto"
            onWheel={handleWheel}
          >
            {!hasImage ? (
              <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Maximize2 className="w-8 h-8 opacity-40" />
                <span className="text-xs font-medium">图片加载中...</span>
              </div>
            ) : (
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="block"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            )}
          </div>

          {/* 浮动缩放控制 */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-[rgba(255,255,255,0.85)] backdrop-blur-sm border border-[var(--border-subtle)] shadow-sm">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.2) * 10) / 10))}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] cursor-pointer transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-bold text-[var(--text-muted)] w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(10, Math.round((z + 0.2) * 10) / 10))}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] cursor-pointer transition-colors"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                const img = previewImage;
                if (img) {
                  const scale = Math.min(1, 720 / img.naturalWidth);
                  const cw = Math.max(1, Math.floor(img.naturalWidth * scale));
                  const ch = Math.max(1, Math.floor(img.naturalHeight * scale));
                  setZoom(calcBestZoom(cw, ch));
                }
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] cursor-pointer transition-colors"
              title="自适应"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 对齐参数：三列一行 */}
        <div className="grid grid-cols-3 gap-3 max-w-[520px] mx-auto w-full">
          <FormSlider
            label="像素大小"
            value={pixelSize}
            onChange={setPixelSize}
            min={1}
            max={64}
            inputWidth="w-[44px]"
            themeColor={theme.main}
            className="flex-col items-start gap-1 [&>div]:w-full"
          />
          <FormSlider
            label="偏移 X"
            value={pixelOffsetX % pixelSize}
            onChange={setPixelOffsetX}
            min={0}
            max={Math.max(pixelSize - 1, 0)}
            inputWidth="w-[44px]"
            themeColor={theme.main}
            className="flex-col items-start gap-1 [&>div]:w-full"
          />
          <FormSlider
            label="偏移 Y"
            value={pixelOffsetY % pixelSize}
            onChange={setPixelOffsetY}
            min={0}
            max={Math.max(pixelSize - 1, 0)}
            inputWidth="w-[44px]"
            themeColor={theme.main}
            className="flex-col items-start gap-1 [&>div]:w-full"
          />
        </div>

        {/* 外观设置：两列一行 */}
        <div className="grid grid-cols-2 gap-3 items-center max-w-[520px] mx-auto w-full">
          <GridLineColorPicker
            value={pixelGridColor}
            onChange={setPixelGridColor}
            themeColor={theme.main}
          />
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">采样方式</label>
            <div className="flex-1">
              <Select
                value={pixelSampleMethod}
                options={SAMPLE_OPTIONS}
                onChange={(val) => setPixelSampleMethod(val as 'center' | 'mode' | 'mean')}
                themeColor={theme.main}
              />
            </div>
          </div>
        </div>

        {/* 生成按钮：限制宽度 */}
        <div className="flex justify-center pt-1 max-w-[520px] mx-auto w-full">
          <Button
            variant="primary"
            className="w-full max-w-[280px]"
            loading={isGenerating}
            disabled={isGenerating}
            onClick={onGenerate}
            style={{ background: theme.main, borderColor: theme.light5, boxShadow: `0 2px 8px ${theme.main}40` }}
          >
            {isGenerating ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-1.5" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                生成拼豆图案
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
