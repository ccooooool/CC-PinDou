import { useState, useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { usePixelProcessor } from '../hooks/usePixelProcessor';
import { FormSlider, Button } from '@/components/ui';
import { Modal } from './ui/modal';
import { Select } from './ui/select';
import { ImageCropModal } from './ImageCropModal';
import { PixelAlignModal } from './PixelAlignModal';
import { GridLineColorPicker } from './GridLineColorPicker';
import { Upload, Wand2, Loader2, Trash2 } from 'lucide-react';
import { getModeTheme } from '../utils/theme';


const SAMPLE_OPTIONS = [
  { key: 'mode', label: '众数 (Mode)' },
  { key: 'center', label: '中心(Center)' },
  { key: 'mean', label: '平均(Mean)' },
];

export function PixelPanel() {
  const theme = getModeTheme('pixel');
  const { setPixelSampleMethod, pixelGridColor, setPixelGridColor } = useConfigStore();

  const {
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
  } = usePixelProcessor();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [alignModalOpen, setAlignModalOpen] = useState(false);

  // 监听画布中央上传的文件
  useEffect(() => {
    const handler = (e: Event) => {
      const file = (e as CustomEvent).detail as File;
      if (file) handleFile(file);
    };
    window.addEventListener('pixel-file-selected', handler);
    return () => window.removeEventListener('pixel-file-selected', handler);
  }, [handleFile]);

  return (
    <div className="flex flex-col">
      {/* 上传区域 */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        {!pixelImageUrl ? (
          <div
            className="p-8 text-center cursor-pointer rounded-xl transition-all duration-300"
            style={{ borderStyle: 'dashed', borderColor: theme.main, borderWidth: '3px' }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, ${theme.main} 4%, transparent)`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '';
              e.currentTarget.style.transform = '';
            }}
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
        ) : (
          <div className="flex flex-col gap-2.5">
            <div
              className="rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center"
              style={{ background: 'repeating-linear-gradient(45deg, #ddd, #ddd 4px, #fff 4px, #fff 8px)' }}
            >
              <img
                src={pixelImageUrl}
                alt="预览"
                className="block max-w-full max-h-[120px]"
              />
            </div>
            <Button
              variant="ghost"
              block
              color="coral"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="w-4 h-4" />
              清除图片
            </Button>
          </div>
        )}
      </div>

      {/* 对齐预览 */}
      {pixelImageUrl && (
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <span className="w-1 h-3 rounded-full" style={{ background: theme.main }} />
            对齐预览
            {isDetecting && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
          </div>
          <div
            className="rounded-xl overflow-hidden border border-[var(--border-subtle)] flex items-center justify-center cursor-pointer"
            style={{ background: 'repeating-linear-gradient(45deg, #ddd, #ddd 4px, #fff 4px, #fff 8px)' }}
            onClick={() => setAlignModalOpen(true)}
            title="点击放大精细调整"
          >
            <canvas
              ref={previewCanvasRef}
              className="block max-w-full max-h-[120px]"
            />
          </div>
          {pixelSize > 0 && previewImage && (
            <div className="text-xs mt-1.5">
              {(() => {
                const ox = (pixelOffsetX % pixelSize + pixelSize) % pixelSize;
                const oy = (pixelOffsetY % pixelSize + pixelSize) % pixelSize;
                const cols = Math.max(1, Math.ceil((previewImage.naturalWidth - ox) / pixelSize));
                const rows = Math.max(1, Math.ceil((previewImage.naturalHeight - oy) / pixelSize));
                const exceeded = cols > 128 || rows > 128;
                return (
                  <>
                    <span className={exceeded ? 'text-red-500 font-bold' : 'text-[var(--text-muted)]'}>
                      预计尺寸: {cols} × {rows}
                    </span>
                    {exceeded && (
                      <span className="text-red-500 ml-1">(超出 128×128 上限)</span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 参数调整 */}
      {pixelImageUrl && (
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-3">
            对齐参数
          </div>

          <div className="flex flex-col gap-3">
            {/* 像素大小 */}
            <FormSlider
              label="像素大小"
              value={pixelSize}
              onChange={setPixelSize}
              min={1}
              max={64}
              inputWidth="w-[50px]"
              themeColor={theme.main}
            />

            {/* 偏移 X */}
            <FormSlider
              label="偏移 X"
              value={pixelOffsetX % pixelSize}
              onChange={setPixelOffsetX}
              min={0}
              max={Math.max(pixelSize - 1, 0)}
              inputWidth="w-[50px]"
              themeColor={theme.main}
            />

            {/* 偏移 Y */}
            <FormSlider
              label="偏移 Y"
              value={pixelOffsetY % pixelSize}
              onChange={setPixelOffsetY}
              min={0}
              max={Math.max(pixelSize - 1, 0)}
              inputWidth="w-[50px]"
              themeColor={theme.main}
            />

            {/* 参考线颜色 */}
            <GridLineColorPicker
              value={pixelGridColor}
              onChange={setPixelGridColor}
              themeColor={theme.main}
            />

            {/* 采样方式 */}
            <div className="flex items-center gap-2.5">
              <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">采样方式</label>
              <div className="flex-1">
                <Select
                  value={pixelSampleMethod}
                  options={SAMPLE_OPTIONS}
                  onChange={(val) => setPixelSampleMethod(val as 'center' | 'mode' | 'mean')}
                  themeColor={theme.main}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成按钮 */}
      {pixelImageUrl && (
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <Button
            variant="primary"
            block
            loading={isGenerating}
            disabled={isDetecting || isGenerating}
            onClick={handleGenerate}
            style={{ background: theme.main, borderColor: theme.light5, boxShadow: `0 2px 8px ${theme.main}40` }}
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
          </Button>
        </div>
      )}

      {/* 错误提示 */}
      {detectError && (
        <div className="px-5 py-2.5 bg-red-50 border-b border-red-200 text-red-500 text-sm">
          {detectError}
        </div>
      )}

      {/* 清除图片二次确认弹窗 */}
      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="确认清除图片"
        themeColor={theme.main}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowClearConfirm(false)}>
              取消
            </Button>
            <Button variant="primary" color="coral" onClick={() => { handleClearImage(); setShowClearConfirm(false); }}>
              确认清除
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-body)]">
          清除后图片预览和已生成的图纸都会被重置，是否继续？
        </p>
      </Modal>

      <ImageCropModal
        isOpen={cropOpen}
        imageUrl={cropImageUrl}
        originalFile={cropFile}
        onClose={handleCancel}
        onCrop={handleCrop}
        onSkip={handleSkip}
        themeColor={theme.main}
      />

      <PixelAlignModal
        isOpen={alignModalOpen}
        onClose={() => setAlignModalOpen(false)}
        previewImage={previewImage}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
    </div>
  );
}
