import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ImageIcon,
  Trash2,
  Plus,
  ChevronDown,
  Pencil,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { ImageCropModal } from './ImageCropModal';

export function ImageLayerPanel() {
  const {
    layers,
    activeLayerId,
    setActiveLayer,
    toggleLayerVisible,
    toggleLayerLock,
    deleteLayer,
    updateLayerOpacity,
    addImageLayer,
    updateImageTransform,
    toggleScaleLocked,
    renameLayer,
  } = useEditorStore();
  const canvasConfig = useConfigStore((s) => s.canvasConfig);
  const { beadSize, margin } = canvasConfig;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [renamePopover, setRenamePopover] = useState<{
    open: boolean;
    layerId: string;
    value: string;
    anchor: HTMLElement | null;
  }>({ open: false, layerId: '', value: '', anchor: null });
  const renamePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!renamePopover.open) return;
    const handleClick = (e: MouseEvent) => {
      if (renamePopoverRef.current && !renamePopoverRef.current.contains(e.target as Node)) {
        setRenamePopover((p) => ({ ...p, open: false }));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [renamePopover.open]);

  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState(true);

  const imageLayers = layers.filter((l) => l.type === 'image');
  const activeLayer = imageLayers.find((l) => l.id === activeLayerId);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCropFile(file);
      setCropImageUrl(dataUrl);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);

    // 重置 input 以便可以重复选择同一文件
    e.target.value = '';
  }, []);

  const computeAutoFitTransform = useCallback((imgW: number, imgH: number) => {
    const editorState = useEditorStore.getState();
    // 优先从顶层 gridData 获取尺寸，fallback 到可见 bead 图层
    const gridData =
      editorState.gridData ??
      (editorState.layers.find((l) => l.type === 'bead' && l.visible) as import('../types/perler').BeadLayer | undefined)?.gridData;
    if (!gridData || gridData.length === 0) return null;

    const rows = gridData.length;
    const cols = gridData[0]?.length || 0;

    // 放大倍率：画板网格宽度 / 图片像素宽度
    // 让图片的每个像素对应一个拼豆格子
    const scaleX = (cols * beadSize) / imgW;
    const scaleY = (rows * beadSize) / imgH;

    // 左上角对齐网格起点（变换原点为图片中心，推导得到存储值）
    const x = (imgW / 2) * (scaleX - 1);
    const y = (imgH / 2) * (scaleY - 1);
    return { x, y, scaleX, scaleY, rotation: 0 };
  }, [beadSize, margin]);

  const handleCrop = useCallback((_: File, dataUrl: string) => {
    setCropOpen(false);
    setCropImageUrl(null);
    setCropFile(null);

    const img = new window.Image();
    img.onload = () => {
      const transform = computeAutoFitTransform(img.naturalWidth, img.naturalHeight);
      addImageLayer('', dataUrl, transform ?? undefined, { width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = dataUrl;
  }, [addImageLayer, computeAutoFitTransform]);

  const handleSkip = useCallback((dataUrl: string) => {
    setCropOpen(false);
    setCropImageUrl(null);
    setCropFile(null);

    const img = new window.Image();
    img.onload = () => {
      const transform = computeAutoFitTransform(img.naturalWidth, img.naturalHeight);
      addImageLayer('', dataUrl, transform ?? undefined, { width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = dataUrl;
  }, [addImageLayer, computeAutoFitTransform]);

  const handleCancel = useCallback(() => {
    setCropOpen(false);
    setCropImageUrl(null);
    setCropFile(null);
  }, []);

  return (
    <>
      <div className='flex flex-col mx-2 my-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--theme-draw-light-5)] shadow-[0_1px_4px_rgba(43,180,171,0.08)] overflow-hidden'>
        <div
          className='flex items-center gap-2 px-4 py-2.5 border-b border-[var(--theme-draw-light-5)] bg-[var(--theme-draw-light-9)] cursor-pointer select-none'
          onClick={() => setExpanded(!expanded)}
        >
          <ImageIcon className='w-4 h-4 text-[var(--theme-draw)]' />
          <span className='text-sm font-bold text-[var(--theme-draw-dark-2)]'>背景图层</span>
          <ChevronDown
            className={cn('w-4 h-4 ml-auto transition-transform duration-300', expanded && 'rotate-180')}
            style={{ transitionTimingFunction: 'var(--ease-bounce)' }}
          />
        </div>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
          style={{ transitionTimingFunction: 'var(--ease-bounce)' }}
        >
          <div className='overflow-hidden'>
            <div className='flex-1 overflow-auto flex flex-col gap-3'>
              {/* 图层列表 */}
              <div className='max-h-60 overflow-y-auto'>
                {[...imageLayers].sort((a, b) => b.zIndex - a.zIndex).map((layer) => {
                  const isActive = layer.id === activeLayerId;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setActiveLayer(layer.id)}
                      className={`nook-layer ${isActive ? 'active' : ''}`}
                      style={isActive ? { background: 'var(--theme-draw-light-8)', borderColor: 'var(--theme-draw-light-3)' } : undefined}
                    >
                      <div className='nook-layer-thumb' style={{ background: 'var(--theme-draw)' }}>
                        <ImageIcon className='w-3.5 h-3.5' />
                      </div>
                      <span
                        className={`flex-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap ${
                          isActive ? 'font-semibold' : 'font-normal'
                        } ${layer.visible ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
                        title={layer.name}
                      >
                        {layer.name}
                      </span>
                      <button
                        title='编辑名称'
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamePopover({
                            open: true,
                            layerId: layer.id,
                            value: layer.name,
                            anchor: e.currentTarget as HTMLElement,
                          });
                        }}
                        className='w-[18px] h-[18px] flex items-center justify-center rounded bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--theme-draw)] shrink-0'
                      >
                        <Pencil className='w-3 h-3' />
                      </button>

                      <button
                        title={layer.visible ? '隐藏' : '显示'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerVisible(layer.id);
                        }}
                        className={`w-[22px] h-[22px] flex items-center justify-center rounded bg-transparent cursor-pointer ${
                          layer.visible ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {layer.visible ? (
                          <Eye className='w-3.5 h-3.5' />
                        ) : (
                          <EyeOff className='w-3.5 h-3.5' />
                        )}
                      </button>

                      <button
                        title={layer.locked ? '解锁' : '锁定'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerLock(layer.id);
                        }}
                        className={`w-[22px] h-[22px] flex items-center justify-center rounded bg-transparent cursor-pointer ${
                          layer.locked ? 'text-[var(--theme-draw)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {layer.locked ? (
                          <Lock className='w-3.5 h-3.5' />
                        ) : (
                          <Unlock className='w-3.5 h-3.5' />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 不透明度 + Transform 控制 */}
              {activeLayer && (
                <div className={cn(
                  'px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 flex flex-col gap-3',
                  activeLayer.locked && 'opacity-50 pointer-events-none select-none'
                )}>
                  {/* 不透明度 */}
                  <div className='flex flex-col gap-2'>
                    <div className='flex items-center gap-2'>
                      <span className='text-xs font-medium text-[var(--text-main)] flex-shrink-0'>不透明度</span>
                      <span className='text-xs font-bold text-[var(--theme-draw)] min-w-[32px]'>
                        {activeLayer.opacity}%
                      </span>
                    </div>
                    <input
                      type='range'
                      className='nook-slider'
                      value={activeLayer.opacity}
                      onChange={(e) => updateLayerOpacity(activeLayer.id, Number(e.target.value))}
                      min={0}
                      max={100}
                      step={5}
                      disabled={activeLayer.locked}
                      style={{ '--slider-fill': `${activeLayer.opacity}%` } as React.CSSProperties}
                    />
                  </div>

                  {/* 位置 */}
                  <div className='flex flex-col gap-2'>
                    <span className='text-xs font-medium text-[var(--text-main)]'>位置</span>
                    <div className='flex gap-2'>
                      <div className='flex items-center gap-1.5 flex-1'>
                        <span className='text-[10px] font-bold text-[var(--theme-draw)] w-4 h-4 rounded bg-[var(--theme-draw-light-9)] flex items-center justify-center'>X</span>
                        <Input
                          type='number'
                          size='xs'
                          className='flex-1'
                          value={String(Math.round(activeLayer.transform.x - (activeLayer.width / 2) * (activeLayer.transform.scaleX - 1)))}
                          onChange={(e) => {
                            const displayX = Number(e.target.value);
                            const actualX = displayX + (activeLayer.width / 2) * (activeLayer.transform.scaleX - 1);
                            updateImageTransform(activeLayer.id, { x: actualX });
                          }}
                          disabled={activeLayer.locked}
                        />
                      </div>
                      <div className='flex items-center gap-1.5 flex-1'>
                        <span className='text-[10px] font-bold text-[var(--theme-draw)] w-4 h-4 rounded bg-[var(--theme-draw-light-9)] flex items-center justify-center'>Y</span>
                        <Input
                          type='number'
                          size='xs'
                          className='flex-1'
                          value={String(Math.round(activeLayer.transform.y - (activeLayer.height / 2) * (activeLayer.transform.scaleY - 1)))}
                          onChange={(e) => {
                            const displayY = Number(e.target.value);
                            const actualY = displayY + (activeLayer.height / 2) * (activeLayer.transform.scaleY - 1);
                            updateImageTransform(activeLayer.id, { y: actualY });
                          }}
                          disabled={activeLayer.locked}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 缩放 */}
                  <div className='flex flex-col gap-2'>
                    <div className='flex items-center gap-2'>
                      <span className='text-xs font-medium text-[var(--text-main)]'>
                        {activeLayer.scaleLocked !== false ? '缩放' : '缩放 X'}
                      </span>
                      <span className='text-xs font-bold text-[var(--theme-draw)] min-w-[40px] text-right'>
                        {(activeLayer.transform.scaleX ?? (activeLayer.transform as any).scale ?? 1).toFixed(2)}x
                      </span>
                      <button
                        title={activeLayer.scaleLocked !== false ? '解除锁定' : '锁定联动'}
                        onClick={() => toggleScaleLocked(activeLayer.id)}
                        disabled={activeLayer.locked}
                        className={`ml-auto w-6 h-6 flex items-center justify-center rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                          activeLayer.scaleLocked !== false ? 'text-[var(--theme-draw)] bg-[var(--theme-draw-light-9)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        {activeLayer.scaleLocked !== false ? <Lock className='w-3 h-3' /> : <Unlock className='w-3 h-3' />}
                      </button>
                    </div>
                    <div className='flex items-center gap-2'>
                      <input
                        type='range'
                        className='nook-slider flex-1'
                        value={activeLayer.transform.scaleX ?? (activeLayer.transform as any).scale ?? 1}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (activeLayer.scaleLocked !== false) {
                            updateImageTransform(activeLayer.id, { scaleX: v, scaleY: v });
                          } else {
                            updateImageTransform(activeLayer.id, { scaleX: v });
                          }
                        }}
                        min={0.01}
                        max={10}
                        step={0.01}
                        disabled={activeLayer.locked}
                        style={{ '--slider-fill': `${((activeLayer.transform.scaleX ?? (activeLayer.transform as any).scale ?? 1) - 0.01) / 9.99 * 100}%` } as React.CSSProperties}
                      />
                      <input
                        type='number'
                        className='w-16 h-8 shrink-0 rounded-input border-[3px] border-[var(--nook-wood-light)] bg-[var(--bg-surface)] px-1 text-sm text-center text-[var(--text-heading)] font-nook font-semibold focus:outline-none focus:border-[var(--theme-draw)] focus:ring-2 focus:ring-[var(--theme-draw)] transition-all duration-200 disabled:opacity-50'
                        value={String((activeLayer.transform.scaleX ?? (activeLayer.transform as any).scale ?? 1).toFixed(2))}
                        onChange={(e) => {
                          const v = Math.max(0.01, Math.min(10, Number(e.target.value)));
                          if (activeLayer.scaleLocked !== false) {
                            updateImageTransform(activeLayer.id, { scaleX: v, scaleY: v });
                          } else {
                            updateImageTransform(activeLayer.id, { scaleX: v });
                          }
                        }}
                        min={0.01}
                        max={10}
                        step={0.01}
                        disabled={activeLayer.locked}
                      />
                    </div>
                    {activeLayer.scaleLocked === false && (
                      <>
                        <div className='flex items-center gap-2'>
                          <span className='text-xs font-medium text-[var(--text-main)]'>缩放 Y</span>
                          <span className='text-xs font-bold text-[var(--theme-draw)] min-w-[40px] text-right'>
                            {(activeLayer.transform.scaleY ?? (activeLayer.transform as any).scale ?? 1).toFixed(2)}x
                          </span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <input
                            type='range'
                            className='nook-slider flex-1'
                            value={activeLayer.transform.scaleY ?? (activeLayer.transform as any).scale ?? 1}
                            onChange={(e) => updateImageTransform(activeLayer.id, { scaleY: Number(e.target.value) })}
                            min={0.01}
                            max={10}
                            step={0.01}
                            disabled={activeLayer.locked}
                            style={{ '--slider-fill': `${((activeLayer.transform.scaleY ?? (activeLayer.transform as any).scale ?? 1) - 0.01) / 9.99 * 100}%` } as React.CSSProperties}
                          />
                          <input
                            type='number'
                            className='w-16 h-8 shrink-0 rounded-input border-[3px] border-[var(--nook-wood-light)] bg-[var(--bg-surface)] px-1 text-sm text-center text-[var(--text-heading)] font-nook font-semibold focus:outline-none focus:border-[var(--theme-draw)] focus:ring-2 focus:ring-[var(--theme-draw)] transition-all duration-200 disabled:opacity-50'
                            value={String((activeLayer.transform.scaleY ?? (activeLayer.transform as any).scale ?? 1).toFixed(2))}
                            onChange={(e) => {
                              const v = Math.max(0.01, Math.min(10, Number(e.target.value)));
                              updateImageTransform(activeLayer.id, { scaleY: v });
                            }}
                            min={0.01}
                            max={10}
                            step={0.01}
                            disabled={activeLayer.locked}
                          />
                        </div>
                      </>
                    )}
                  </div>

                </div>
              )}

              {/* 添加 / 删除 */}
              <div className='px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 flex flex-col gap-2'>
                <input
                  ref={fileInputRef}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={handleFileChange}
                />
                <Button
                  size='xs'
                  variant='secondary'
                  color='green'
                  block
                  onClick={handleFileSelect}
                >
                  <Plus className='w-3.5 h-3.5' />
                  添加图片
                </Button>

                {activeLayerId && imageLayers.some((l) => l.id === activeLayerId) && (
                  <button
                    title='删除'
                    onClick={() => deleteLayer(activeLayerId)}
                    disabled={activeLayer?.locked}
                    className='w-full h-8 rounded-lg border border-[var(--theme-danger-light-5)] bg-[var(--bg-surface)] flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--color-danger)] cursor-pointer transition-colors hover:bg-[var(--theme-danger-light-9)] disabled:opacity-40 disabled:cursor-not-allowed'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                    删除图层
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 重命名气泡框 */}
      {renamePopover.open && renamePopover.anchor && (
        <div
          ref={renamePopoverRef}
          className='nook-panel fixed z-[200] p-2.5 flex flex-col gap-2'
          style={{
            left: renamePopover.anchor.getBoundingClientRect().left - 200 - 8,
            top: renamePopover.anchor.getBoundingClientRect().top - 4,
            width: 200,
          }}
        >
          <Input
            autoFocus
            size='xs'
            value={renamePopover.value}
            onChange={(e) => setRenamePopover((p) => ({ ...p, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                renameLayer(renamePopover.layerId, renamePopover.value);
                setRenamePopover((p) => ({ ...p, open: false }));
              }
              if (e.key === 'Escape') {
                setRenamePopover((p) => ({ ...p, open: false }));
              }
            }}
          />
          <div className='flex gap-1.5 justify-end'>
            <Button
              size='xs'
              variant='secondary'
              color='green'
              onClick={() => setRenamePopover((p) => ({ ...p, open: false }))}
            >
              取消
            </Button>
            <Button
              size='xs'
              variant='primary'
              color='green'
              onClick={() => {
                renameLayer(renamePopover.layerId, renamePopover.value);
                setRenamePopover((p) => ({ ...p, open: false }));
              }}
            >
              确认
            </Button>
          </div>
        </div>
      )}

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
