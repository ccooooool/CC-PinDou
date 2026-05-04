import { useRef, useCallback, useState, useEffect } from 'react';
import { useConfigStore, useEditorStore } from '../store/usePerlerStore';
import { Slider } from './ui/slider';
import colorMappingJson from '../data/colorSystemMapping.json';
import type { ColorMapping } from '../types/perler';
import { Card } from '@/components/ui';
import { Select } from './ui/select';
import { ImageCropModal } from './ImageCropModal';
import { Upload, Wand2, Loader2, Grid3X3, Move, Maximize } from 'lucide-react';
import { detectPixelSizeFrontend } from '../engine/frontendAlgorithms';

const SAMPLE_OPTIONS = [
  { key: 'mode', label: '众数 (Mode)' },
  { key: 'center', label: '中心(Center)' },
  { key: 'mean', label: '平均(Mean)' },
];

interface PixelPanelProps {
  backendAvailable: boolean;
}

export function PixelPanel({ backendAvailable }: PixelPanelProps) {
  const {
    pixelSize: rawPixelSize,
    pixelOffsetX,
    pixelOffsetY,
    pixelSampleMethod,
    pixelImageUrl,
    pixelCols,
    pixelRows,
    colorMode,
    setPixelSize: setRawPixelSize,
    setPixelOffsetX,
    setPixelOffsetY,
    setPixelSampleMethod,
    setPixelImageUrl,
    setPixelCols,
    setPixelRows,
  } = useConfigStore();
  const pixelSize = Math.max(1, rawPixelSize || 1);
  const setPixelSize = (v: number) => setRawPixelSize(Math.max(1, Number(v) || 1));
  const { setGridData } = useEditorStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const img = previewImage;
    if (!canvas || !img || pixelSize <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxW = 260;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const cw = Math.floor(img.naturalWidth * scale);
    const ch = Math.floor(img.naturalHeight * scale);
    canvas.width = cw;
    canvas.height = ch;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);

    // 画网格线
    const ps = pixelSize * scale;
    const ox = (pixelOffsetX % pixelSize) * scale;
    const oy = (pixelOffsetY % pixelSize) * scale;

    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
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
  }, [previewImage, pixelSize, pixelOffsetX, pixelOffsetY]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const loadCroppedImage = useCallback((file: File, dataUrl: string) => {
    setPixelImageUrl(dataUrl);
    const img = new Image();
    img.onload = () => {
      setPreviewImage(img);
      autoDetect(file);
    };
    img.src = dataUrl;
  }, [setPixelImageUrl]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      setDetectError(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setCropFile(file);
        setCropImageUrl(dataUrl);
        setCropOpen(true);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleCrop = useCallback((file: File, dataUrl: string) => {
    setCropOpen(false);
    setCropImageUrl(null);
    setCropFile(null);
    loadCroppedImage(file, dataUrl);
  }, [loadCroppedImage]);

  const handleSkip = useCallback((dataUrl: string) => {
    setCropOpen(false);
    setCropImageUrl(null);
    if (cropFile) {
      loadCroppedImage(cropFile, dataUrl);
    }
    setCropFile(null);
  }, [cropFile, loadCroppedImage]);

  const handleCancel = useCallback(() => {
    setCropOpen(false);
    setCropImageUrl(null);
    setCropFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const autoDetect = useCallback(async (file: File) => {
    setIsDetecting(true);
    setDetectError(null);
    try {
      if (backendAvailable) {
        const form = new FormData();
        form.append('image', file);
        const res = await fetch('/api/detect-pixel', {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || '检测失败');
        }
        setPixelSize(data.pixel_size || 16);
        setPixelOffsetX(data.offset_x || 0);
        setPixelOffsetY(data.offset_y || 0);
      } else {
        // 前端降级：使用前端像素检测
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('图片加载失败'));
        });
        const canvas = document.createElement('canvas');
        const maxSize = 400;
        const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.floor(img.naturalWidth * scale);
        canvas.height = Math.floor(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not available');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = detectPixelSizeFrontend(imageData);
        setPixelSize(result.pixelSize);
        setPixelOffsetX(result.offsetX);
        setPixelOffsetY(result.offsetY);
      }
    } catch (err: any) {
      setDetectError(err.message || '自动检测失败，请手动调整');
    } finally {
      setIsDetecting(false);
    }
  }, [setPixelSize, setPixelOffsetX, setPixelOffsetY, backendAvailable]);

  const handleGenerate = useCallback(async () => {
    if (!previewImage || !pixelImageUrl) return;

    setIsGenerating(true);
    setDetectError(null);

    try {
      const { PerlerEngine } = await import('../engine/PerlerEngine');
      const colorMapping = colorMappingJson as ColorMapping;
      const engine = new PerlerEngine(colorMapping, colorMode);

      const canvas = document.createElement('canvas');
      canvas.width = previewImage.naturalWidth;
      canvas.height = previewImage.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.drawImage(previewImage, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const { grid, colorMap, cols, rows } = engine.generatePixelGrid(
        imageData,
        pixelSize,
        pixelOffsetX,
        pixelOffsetY,
        pixelSampleMethod
      );

      setPixelCols(cols);
      setPixelRows(rows);

      const colorList = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
      setGridData(grid, colorList);
    } catch (err: any) {
      setDetectError('生成失败: ' + (err.message || String(err)));
    } finally {
      setIsGenerating(false);
    }
  }, [
    previewImage,
    pixelImageUrl,
    pixelSize,
    pixelOffsetX,
    pixelOffsetY,
    pixelSampleMethod,
    colorMode,
    setPixelCols,
    setPixelRows,
    setGridData,
  ]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="dop-panel flex flex-col">
      {/* 上传区域 */}
      <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0">
        <Card color="app-yellow">
          <div
            className="dop-panel p-8 text-center cursor-pointer"
            style={{ borderStyle: 'dashed', borderColor: 'var(--dop-pink)' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Upload className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
            <p className="mt-2 mb-1 text-sm font-bold text-[var(--text-main)]">点击或拖拽上传像素图</p>
            <p className="m-0 text-xs font-bold text-[var(--text-muted)]">支持 JPG、PNG 格式</p>
          </div>
        </Card>

        {pixelImageUrl && (
          <div className="mt-3">
            <div className="rounded-xl overflow-hidden border border-[rgba(255,107,157,0.08)] inline-block">
              <img
                src={pixelImageUrl}
                alt="预览"
                className="block max-w-full max-h-[120px]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 对齐预览 */}
      {pixelImageUrl && (
        <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0">
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Grid3X3 className="w-3.5 h-3.5" />
            对齐预览
            {isDetecting && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
          </div>
          <canvas
            ref={previewCanvasRef}
            className="block max-w-full rounded-lg border border-[rgba(255,107,157,0.08)] bg-white"
          />
          {pixelCols > 0 && pixelRows > 0 && (
            <div className="text-xs text-[var(--text-muted)] mt-1.5">
              预计尺寸: {pixelCols} × {pixelRows}
            </div>
          )}
        </div>
      )}

      {/* 参数调整 */}
      {pixelImageUrl && (
        <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0">
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-3">
            <Move className="w-3.5 h-3.5" />
            对齐参数
          </div>

          <div className="flex flex-col gap-3">
            {/* 像素大小 */}
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0 flex items-center gap-1">
                <Maximize className="w-3.5 h-3.5" />
                像素大小
              </label>
              <div className="flex-1 flex items-center gap-2.5">
                <Slider
                  value={[pixelSize]}
                  onValueChange={([v]) => setPixelSize(v)}
                  min={1}
                  max={64}
                  step={1}
                  className="w-full"
                />
                <input
                  type="number"
                  min={1}
                  max={64}
                  value={pixelSize}
                  onChange={(e) => setPixelSize(Number(e.target.value))}
                  className="dop-input w-[50px] text-center px-1.5 py-1 text-sm"
                />
              </div>
            </div>

            {/* 偏移 X */}
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">偏移 X</label>
              <div className="flex-1 flex items-center gap-2.5">
                <Slider
                  value={[pixelOffsetX % pixelSize]}
                  onValueChange={([v]) => setPixelOffsetX(v)}
                  min={0}
                  max={Math.max(pixelSize - 1, 0)}
                  step={1}
                  className="w-full"
                />
                <input
                  type="number"
                  min={0}
                  max={Math.max(pixelSize - 1, 0)}
                  value={pixelOffsetX % pixelSize}
                  onChange={(e) => setPixelOffsetX(Number(e.target.value))}
                  className="dop-input w-[50px] text-center px-1.5 py-1 text-sm"
                />
              </div>
            </div>

            {/* 偏移 Y */}
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">偏移 Y</label>
              <div className="flex-1 flex items-center gap-2.5">
                <Slider
                  value={[pixelOffsetY % pixelSize]}
                  onValueChange={([v]) => setPixelOffsetY(v)}
                  min={0}
                  max={Math.max(pixelSize - 1, 0)}
                  step={1}
                  className="w-full"
                />
                <input
                  type="number"
                  min={0}
                  max={Math.max(pixelSize - 1, 0)}
                  value={pixelOffsetY % pixelSize}
                  onChange={(e) => setPixelOffsetY(Number(e.target.value))}
                  className="dop-input w-[50px] text-center px-1.5 py-1 text-sm"
                />
              </div>
            </div>

            {/* 采样方式 */}
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">采样方式</label>
              <div className="flex-1">
                <Select
                  value={pixelSampleMethod}
                  options={SAMPLE_OPTIONS}
                  onChange={(val) => setPixelSampleMethod(val as 'center' | 'mode' | 'mean')}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      {pixelImageUrl && (
        <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0">
          <button
            className="dop-btn dop-btn-primary w-full justify-center"
            disabled={isDetecting || isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                生成拼豆图案
              </>
            )}
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {detectError && (
        <div className="px-5 py-2.5 bg-red-50 border-b border-red-200 text-red-500 text-sm">
          {detectError}
        </div>
      )}

      <ImageCropModal
        isOpen={cropOpen}
        imageUrl={cropImageUrl}
        originalFile={cropFile}
        onClose={handleCancel}
        onCrop={handleCrop}
        onSkip={handleSkip}
      />
    </div>
  );
}
