import { useRef, useCallback, useState } from 'react';
import { Card } from '@/components/ui';
import { Upload } from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';

interface ImageUploaderProps {
  onImageSelect: (file: File, dataUrl: string) => void;
}

export function ImageUploader({ onImageSelect }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
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
    onImageSelect(file, dataUrl);
  }, [onImageSelect]);

  const handleSkip = useCallback((dataUrl: string) => {
    setCropOpen(false);
    setCropImageUrl(null);
    if (cropFile) {
      onImageSelect(cropFile, dataUrl);
    }
    setCropFile(null);
  }, [cropFile, onImageSelect]);

  const handleCancel = useCallback(() => {
    setCropOpen(false);
    setCropImageUrl(null);
    setCropFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <>
    <Card color="app-yellow">
      <div
        className="dop-uploader"
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
        <p className="mt-2 mb-1 text-sm font-bold text-[var(--text-main)]">点击或拖拽上传图片</p>
        <p className="m-0 text-xs font-bold text-[var(--text-muted)]">支持 JPG、PNG 格式</p>
      </div>
    </Card>
    <ImageCropModal
      isOpen={cropOpen}
      imageUrl={cropImageUrl}
      originalFile={cropFile}
      onClose={handleCancel}
      onCrop={handleCrop}
      onSkip={handleSkip}
    />
    </>
  );
}
