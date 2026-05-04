import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Scissors, Loader2, ImageOff, Eraser } from 'lucide-react';
import { removeBgFrontend } from '../engine/frontendAlgorithms';

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
  const esRef = useRef<EventSource | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  // 组件卸载时清理 blob URL 和 EventSource
  useEffect(() => {
    return () => {
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
        lastBlobUrlRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, []);

  const handleRemoveBg = useCallback(async () => {
    if (!imageFile) return;

    if (lastBlobUrlRef.current) {
      URL.revokeObjectURL(lastBlobUrlRef.current);
      lastBlobUrlRef.current = null;
    }

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
      formData.append('edge_threshold', '30');
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
      lastBlobUrlRef.current = url;
      onBgRemoved(url);
    } catch (err: any) {
      setError(err.message || '背景移除失败');
    } finally {
      setIsRemoving(false);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    }
  }, [imageFile, onBgRemoved]);

  const handleRemoveBgFallback = useCallback(async () => {
    if (!imageFile) return;
    setIsRemoving(true);
    setError(null);
    try {
      const img = new Image();
      img.src = URL.createObjectURL(imageFile);
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
      const result = removeBgFrontend(imageData, 80);
      ctx.putImageData(result, 0, 0);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      lastBlobUrlRef.current = url;
      onBgRemoved(url);
    } catch (err: any) {
      setError(err.message || '背景移除失败');
    } finally {
      setIsRemoving(false);
    }
  }, [imageFile, onBgRemoved]);

  if (!imageFile) return null;

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
          <div className="dop-progress">
            <div className="dop-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-bold text-[var(--text-muted)] text-center">{status}</span>
        </div>
      )}

      {error && (
        <div className="dop-alert dop-alert-danger">
          <ImageOff className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
