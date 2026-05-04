import { useRef, useEffect, useState, useCallback } from 'react';
import { Modal, Button } from '@/components/ui';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { Scissors, SkipForward, X } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  originalFile: File | null;
  onClose: () => void;
  onCrop: (croppedFile: File, croppedDataUrl: string) => void;
  onSkip: (dataUrl: string) => void;
}

export function ImageCropModal({ isOpen, imageUrl, originalFile, onClose, onCrop, onSkip }: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [ready, setReady] = useState(false);

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
    onClose();
  }, [onClose]);

  return (
    <Modal
      open={isOpen}
      title="裁剪图片"
      onClose={handleCancel}
      footer={
        <>
          <Button variant="text" onClick={handleCancel}>
            <X style={{ width: 14, height: 14 }} />
            取消
          </Button>
          <Button variant="default" onClick={handleSkip}>
            <SkipForward style={{ width: 14, height: 14 }} />
            跳过（使用原图）
          </Button>
          <Button variant="primary" disabled={!ready} onClick={handleCrop}>
            <Scissors style={{ width: 14, height: 14 }} />
            确认裁剪
          </Button>
        </>
      }
    >
      <div style={{ maxHeight: 480, overflow: 'hidden' }}>
        <img
          ref={imgRef}
          alt="裁剪预览"
          style={{ display: 'block', maxWidth: '100%', maxHeight: 400 }}
        />
      </div>
    </Modal>
  );
}
