import { useRef, useEffect, useState, useCallback } from 'react';
import { Modal, Button } from '@/components/ui';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { Scissors, SkipForward, X, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AspectOption {
  label: string;
  value: number | null;
}

const ASPECT_OPTIONS: AspectOption[] = [
  { label: '自由', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

interface ImageCropModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  originalFile: File | null;
  onClose: () => void;
  onCrop: (croppedFile: File, croppedDataUrl: string) => void;
  onSkip: (dataUrl: string) => void;
}

export function ImageCropModal({
  isOpen,
  imageUrl,
  originalFile,
  onClose,
  onCrop,
  onSkip,
}: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [ready, setReady] = useState(false);
  const [activeAspect, setActiveAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !imageUrl || !imgRef.current) return;

    const img = imgRef.current;
    img.src = imageUrl;

    const initCropper = () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
      cropperRef.current = new Cropper(img, {
        viewMode: 1,
        dragMode: 'crop',
        autoCropArea: 0.8,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        background: false,
        aspectRatio: activeAspect ?? NaN,
        ready: () => setReady(true),
      });
    };

    if (img.complete) {
      initCropper();
    } else {
      img.onload = initCropper;
    }

    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
      setReady(false);
    };
  }, [isOpen, imageUrl]);

  // 比例切换时更新 cropper
  useEffect(() => {
    if (!ready || !cropperRef.current) return;
    cropperRef.current.setAspectRatio(activeAspect ?? NaN);
  }, [activeAspect, ready]);

  const handleCrop = useCallback(() => {
    if (!cropperRef.current || !originalFile) return;
    const canvas = cropperRef.current.getCroppedCanvas();
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], originalFile.name, { type: originalFile.type });
      const dataUrl = canvas.toDataURL(originalFile.type);
      onCrop(croppedFile, dataUrl);
    }, originalFile.type);
  }, [originalFile, onCrop]);

  const handleSkip = useCallback(() => {
    if (!imageUrl) return;
    onSkip(imageUrl);
  }, [imageUrl, onSkip]);

  const handleCancel = useCallback(() => {
    if (cropperRef.current) {
      cropperRef.current.destroy();
      cropperRef.current = null;
    }
    setReady(false);
    setActiveAspect(null);
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={isOpen}
      title="裁剪图片"
      onClose={handleCancel}
      width={840}
      footer={
        <>
          <Button variant="text" onClick={handleCancel}>
            <X className="w-3.5 h-3.5" />
            取消
          </Button>
          <Button variant="secondary" onClick={handleSkip}>
            <SkipForward className="w-3.5 h-3.5" />
            跳过（使用原图）
          </Button>
          <Button variant="primary" disabled={!ready} onClick={handleCrop}>
            <Scissors className="w-3.5 h-3.5" />
            确认裁剪
          </Button>
        </>
      }
    >
      {/* 比例锁定按钮 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5 mr-2">
          {activeAspect !== null ? (
            <Lock className="w-3.5 h-3.5 text-[var(--theme-draw)]" />
          ) : (
            <Unlock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          )}
          裁剪比例
        </span>
        {ASPECT_OPTIONS.map((opt) => {
          const active = activeAspect === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => setActiveAspect(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 border',
                active
                  ? 'bg-[var(--theme-draw)] border-[var(--theme-draw)] text-white shadow-[0_2px_8px_rgba(43,180,171,0.3)]'
                  : 'bg-[var(--bg-surface)] border-[var(--nook-wood-light)] text-[var(--text-secondary)] hover:border-[var(--theme-draw)] hover:text-[var(--theme-draw)]'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        className="max-h-[620px] overflow-hidden rounded-xl border-2 border-[var(--border-default)]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #e8e8e0 0, #e8e8e0 12px, #f4f4f0 12px, #f4f4f0 24px)',
        }}
      >
        <img
          ref={imgRef}
          alt="裁剪预览"
          className="block max-w-full max-h-[560px]"
        />
      </div>
    </Modal>
  );
}
