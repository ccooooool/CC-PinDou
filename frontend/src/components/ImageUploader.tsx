import { useCallback, useState } from 'react';
import { Uploader } from '@/components/ui';
import { Upload } from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';

interface ImageUploaderProps {
  onImageSelect: (file: File, dataUrl: string) => void;
}

export function ImageUploader({ onImageSelect }: ImageUploaderProps) {
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
  }, []);

  const onFiles = useCallback(
    (files: FileList) => {
      const file = files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <>
      <Uploader
        accept="image/*"
        onFiles={onFiles}
        className="w-full"
      >
        <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
        <div className="font-bold text-[var(--text-heading)]">点击或拖拽上传图片</div>
        <div className="text-xs text-[var(--text-caption)] mt-1">支持 JPG、PNG 格式</div>
      </Uploader>
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
