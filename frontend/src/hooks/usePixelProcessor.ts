import { useRef, useCallback, useState, useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { useEditorStore } from '../store/useEditorStore';
import { detectPixelSizeFrontend } from '../engine/frontendAlgorithms';
import type { ColorMapping } from '../types/perler';
import colorMappingJson from '../data/colorSystemMapping.json';
import { toast } from '@/components/ui/toast';

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

export function usePixelProcessor() {
  const {
    pixelSize: rawPixelSize,
    pixelOffsetX,
    pixelOffsetY,
    pixelGridColor,
    pixelSampleMethod,
    pixelImageUrl,
    colorMode,
    setPixelSize: setRawPixelSize,
    setPixelOffsetX,
    setPixelOffsetY,
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

  // Canvas 预览绘制
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

    const ps = pixelSize * scale;
    const ox = (pixelOffsetX % pixelSize) * scale;
    const oy = (pixelOffsetY % pixelSize) * scale;

    // 参考线颜色
    const clean = pixelGridColor.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
    } else {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    }
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
  }, [previewImage, pixelSize, pixelOffsetX, pixelOffsetY, pixelGridColor]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // 文件处理
  const loadCroppedImage = useCallback((file: File, dataUrl: string) => {
    setPixelImageUrl(dataUrl);
    const img = new Image();
    img.onload = () => {
      setPreviewImage(img);
      autoDetect(file);
      toast.success(`图片 "${file.name}" 上传成功`);
    };
    img.onerror = () => {
      toast.error('图片加载失败，请尝试其他图片');
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

  const handleClearImage = useCallback(() => {
    setPixelImageUrl(null);
    setPreviewImage(null);
    setGridData([], []);
    setDetectError(null);
    setPixelSize(16);
    setPixelOffsetX(0);
    setPixelOffsetY(0);
    setPixelCols(0);
    setPixelRows(0);
    if (inputRef.current) inputRef.current.value = '';
    toast.info('已清除图片和图纸');
  }, [setPixelImageUrl, setGridData, setPixelSize, setPixelOffsetX, setPixelOffsetY, setPixelCols, setPixelRows]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // 自动检测像素大小
  const autoDetect = useCallback(async (file: File) => {
    setIsDetecting(true);
    setDetectError(null);
    try {
      const img = new Image();
      const blobUrl = URL.createObjectURL(file);
      img.src = blobUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败'));
      });
      URL.revokeObjectURL(blobUrl);
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
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)) || '自动检测失败，请手动调整';
      setDetectError(msg);
      toast.error(msg);
    } finally {
      setIsDetecting(false);
    }
  }, [setPixelSize, setPixelOffsetX, setPixelOffsetY]);

  // 生成拼豆图案
  const handleGenerate = useCallback(async () => {
    if (!previewImage || !pixelImageUrl) return;

    setIsGenerating(true);
    setDetectError(null);

    try {
      const ps = Math.max(1, pixelSize);
      const ox = ((pixelOffsetX % ps) + ps) % ps;
      const oy = ((pixelOffsetY % ps) + ps) % ps;
      const cols = Math.max(1, Math.ceil((previewImage.naturalWidth - ox) / ps));
      const rows = Math.max(1, Math.ceil((previewImage.naturalHeight - oy) / ps));
      if (cols > 128 || rows > 128) {
        throw new Error(`画板尺寸 ${cols}×${rows} 超出 128×128 上限，请裁剪图片或调大像素大小`);
      }

      const { PerlerEngine } = await import('../engine/PerlerEngine');
      const engine = new PerlerEngine(colorMappingData, colorMode);

      const canvas = document.createElement('canvas');
      canvas.width = previewImage.naturalWidth;
      canvas.height = previewImage.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.drawImage(previewImage, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const { grid, colorMap } = engine.generatePixelGrid(
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
      toast.success('像素图案生成成功');
    } catch (err: unknown) {
      const msg = '生成失败: ' + (err instanceof Error ? err.message : String(err));
      setDetectError(msg);
      toast.error(msg);
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

  return {
    inputRef,
    previewCanvasRef,
    pixelSize,
    setPixelSize,
    pixelOffsetX,
    setPixelOffsetX,
    pixelOffsetY,
    setPixelOffsetY,
    pixelSampleMethod,
    previewImage,
    pixelImageUrl,
    isDetecting,
    isGenerating,
    detectError,
    setDetectError,
    cropOpen,
    cropImageUrl,
    cropFile,
    handleFile,
    handleCrop,
    handleSkip,
    handleCancel,
    handleClearImage,
    onDrop,
    handleGenerate,
    drawPreview,
  };
}
