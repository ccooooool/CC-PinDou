import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Loader2, ImageOff, Eraser, Download } from 'lucide-react';
import { removeBgFrontend } from '../engine/frontendAlgorithms';
import { useConfigStore } from '../store/useConfigStore';
import { toast } from '@/components/ui/toast';

interface RemoveBgButtonProps {
  imageFile: File | null;
  onBgRemoved: (blobUrl: string) => void;
}

export function RemoveBgButton({ imageFile, onBgRemoved }: RemoveBgButtonProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedPreview, setRemovedPreview] = useState<string | null>(null);
  const transferredRef = useRef<Set<string>>(new Set());
  const { removeBgThreshold } = useConfigStore();

  // 组件卸载时清理 blob URL
  useEffect(() => {
    return () => {
      if (removedPreview && !transferredRef.current.has(removedPreview)) {
        URL.revokeObjectURL(removedPreview);
      }
    };
  }, [removedPreview]);

  const handleRemoveBg = useCallback(async () => {
    if (!imageFile) return;
    setIsRemoving(true);
    setError(null);
    let tempBlobUrl: string | null = null;
    try {
      const img = new Image();
      tempBlobUrl = URL.createObjectURL(imageFile);
      img.src = tempBlobUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = removeBgFrontend(imageData, removeBgThreshold);
      ctx.putImageData(result, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      setRemovedPreview(url);
      toast.success('背景移除完成');
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)) || '背景移除失败';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsRemoving(false);
      if (tempBlobUrl) {
        URL.revokeObjectURL(tempBlobUrl);
      }
    }
  }, [imageFile, removeBgThreshold]);

  const handleConfirm = useCallback(() => {
    if (removedPreview) {
      transferredRef.current.add(removedPreview);
      onBgRemoved(removedPreview);
      setRemovedPreview(null);
      toast.success('已应用背景移除结果');
    }
  }, [removedPreview, onBgRemoved]);

  const handleCancel = useCallback(() => {
    if (removedPreview) {
      URL.revokeObjectURL(removedPreview);
      setRemovedPreview(null);
    }
  }, [removedPreview]);

  const handleDownload = useCallback(() => {
    if (!removedPreview) return;
    const a = document.createElement('a');
    a.href = removedPreview;
    a.download = 'removed-bg.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('已开始下载');
  }, [removedPreview]);

  if (!imageFile) return null;

  if (removedPreview) {
    return (
      <div className="flex flex-col gap-2.5">
        <div
          className="rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center"
          style={{ background: 'repeating-linear-gradient(45deg, #ddd, #ddd 4px, #fff 4px, #fff 8px)' }}
        >
          <img src={removedPreview} alt="背景消除预览" className="block max-w-full max-h-[140px]" />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" block onClick={handleConfirm}>
            确认
          </Button>
          <Button variant="ghost" block onClick={handleCancel}>
            取消
          </Button>
          <Button variant="ghost" onClick={handleDownload} title="下载抠图结果">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        block
        loading={isRemoving}
        disabled={isRemoving}
        onClick={handleRemoveBg}
      >
        {isRemoving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            处理中...
          </>
        ) : (
          <>
            <Eraser className="w-4 h-4" />
            快速移除背景
          </>
        )}
      </Button>

      {error && (
        <div className="nook-alert nook-alert-danger">
          <ImageOff className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
