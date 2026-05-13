import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Scissors, Loader2, ImageOff, Eraser } from 'lucide-react';
import { removeBgFrontend } from '../engine/frontendAlgorithms';
import { useConfigStore } from '../store/useConfigStore';

interface RemoveBgButtonProps {
  imageFile: File | null;
  onBgRemoved: (blobUrl: string) => void;
  backendAvailable: boolean;
}

export function RemoveBgButton({ imageFile, onBgRemoved, backendAvailable }: RemoveBgButtonProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [removedPreview, setRemovedPreview] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const transferredRef = useRef<Set<string>>(new Set());
  const { removeBgThreshold, bgModel } = useConfigStore();

  // 组件卸载时清理 blob URL 和 EventSource
  // 注意：已确认转移给父组件的 URL（在 transferredRef 中）不再释放
  useEffect(() => {
    return () => {
      if (removedPreview && !transferredRef.current.has(removedPreview)) {
        URL.revokeObjectURL(removedPreview);
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [removedPreview]);

  const handleRemoveBg = useCallback(async () => {
    if (!imageFile) return;

    setIsRemoving(true);
    setError(null);
    setProgress(0);
    setStatus('准备中...');

    const taskId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const es = new EventSource(`/api/progress/${taskId}`);
    esRef.current = es;
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data.progress);
        setStatus(data.status);
        if (data.done) {
          es.close();
          esRef.current = null;
        }
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('edge_threshold', String(removeBgThreshold));
      if (bgModel && bgModel !== 'frontend') {
        formData.append('model', bgModel);
      }
      formData.append('task_id', taskId);

      const response = await fetch('/api/remove-bg', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || '背景移除失败');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setRemovedPreview(url);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || '背景移除失败');
    } finally {
      setIsRemoving(false);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    }
  }, [imageFile, removeBgThreshold, bgModel]);

  const handleRemoveBgFallback = useCallback(async () => {
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
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)) || '背景移除失败');
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
    }
  }, [removedPreview, onBgRemoved]);

  const handleCancel = useCallback(() => {
    if (removedPreview) {
      URL.revokeObjectURL(removedPreview);
      setRemovedPreview(null);
    }
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
        onClick={backendAvailable ? handleRemoveBg : handleRemoveBgFallback}
      >
        {isRemoving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {backendAvailable ? (status || 'AI 处理中...') : '处理中...'}
          </>
        ) : backendAvailable ? (
          <>
            <Scissors className="w-4 h-4" />
            AI 移除背景
          </>
        ) : (
          <>
            <Eraser className="w-4 h-4" />
            快速移除背景
          </>
        )}
      </Button>

      {isRemoving && (
        <div className="flex flex-col gap-1">
          <div className="nook-progress">
            <div className="nook-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)] text-center">{status}</span>
        </div>
      )}

      {error && (
        <div className="nook-alert nook-alert-danger">
          <ImageOff className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
