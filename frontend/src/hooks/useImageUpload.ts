import { useState, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/toast';

function isBlobUrl(url: string | null): url is string {
  return typeof url === 'string' && url.startsWith('blob:');
}

/**
 * 将 dataUrl 图片缩放到最大 maxSize 像素，返回新的 dataUrl。
 * 用于减少大图上传播放后的内存占用。
 */
function resizeImageDataUrl(dataUrl: string, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(img.naturalWidth * scale);
      canvas.height = Math.floor(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUrl;
  });
}

/**
 * 管理普通图片模式的上传图片状态
 * - previewImage: 当前预览图 dataUrl / blobUrl
 * - selectedFile: 原始上传文件（用于后端 API）
 * - processedImage: 背景消除后的图片 blobUrl
 */
export function useImageUpload() {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const revokeBlobUrl = useCallback((url: string | null) => {
    if (isBlobUrl(url)) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    }
  }, []);

  const trackBlobUrl = useCallback((url: string | null) => {
    if (isBlobUrl(url)) {
      blobUrlsRef.current.add(url);
    }
  }, []);

  const handleImageSelect = useCallback(async (file: File, dataUrl: string) => {
    revokeBlobUrl(previewImage);
    revokeBlobUrl(processedImage);
    try {
      // 限制预览图尺寸，减少大图的 Base64 内存占用
      const resized = await resizeImageDataUrl(dataUrl, 1200);
      setPreviewImage(resized);
      setSelectedFile(file);
      setProcessedImage(null);
      toast.success(`图片 "${file.name}" 上传成功`);
    } catch {
      toast.error('图片处理失败，请尝试其他图片');
    }
  }, [previewImage, processedImage, revokeBlobUrl]);

  const handleBgRemoved = useCallback((blobUrl: string) => {
    trackBlobUrl(blobUrl);
    revokeBlobUrl(previewImage);
    revokeBlobUrl(processedImage);
    setProcessedImage(blobUrl);
    setPreviewImage(blobUrl);
  }, [previewImage, processedImage, trackBlobUrl, revokeBlobUrl]);

  const clearImages = useCallback(() => {
    revokeBlobUrl(previewImage);
    revokeBlobUrl(processedImage);
    setPreviewImage(null);
    setSelectedFile(null);
    setProcessedImage(null);
    toast.info('已清除图片');
  }, [previewImage, processedImage, revokeBlobUrl]);

  return {
    previewImage,
    selectedFile,
    processedImage,
    handleImageSelect,
    handleBgRemoved,
    clearImages,
  };
}
