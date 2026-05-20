import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import { useEditorStore } from '../store/useEditorStore';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Trash2,
  ArrowUp,
  ArrowDown,
  Merge,
  Plus,
  ChevronDown,
  Pencil,
} from 'lucide-react';

export function BeadLayerPanel() {
  const {
    layers,
    activeLayerId,
    setActiveLayer,
    toggleLayerVisible,
    toggleLayerLock,
    reorderLayer,
    deleteLayer,
    updateLayerOpacity,
    mergeLayerDown,
    addBeadLayer,
    renameLayer,
  } = useEditorStore();

  const beadLayers = layers.filter((l) => l.type === 'bead');
  const activeLayer = beadLayers.find((l) => l.id === activeLayerId);
  const [expanded, setExpanded] = useState(true);
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

  return (
    <div className='flex flex-col mx-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden'>
      <div
        className='flex items-center gap-2 px-4 py-2.5 border-b border-[var(--theme-draw-light-5)] bg-[var(--theme-draw-light-9)] cursor-pointer select-none'
        onClick={() => setExpanded(!expanded)}
      >
        <div className='w-1 h-4 rounded-full bg-[var(--theme-draw)]' />
        <span className='text-sm font-bold text-[var(--theme-draw-dark-2)]'>拼豆图层</span>
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
              {[...beadLayers].sort((a, b) => b.zIndex - a.zIndex).map((layer) => {
                const isActive = layer.id === activeLayerId;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayer(layer.id)}
                    className={`nook-layer ${isActive ? 'active' : ''}`}
                    style={isActive ? { background: 'var(--theme-draw-light-8)', borderColor: 'var(--theme-draw-light-3)' } : undefined}
                  >
                    <div className='nook-layer-thumb' style={{ background: 'var(--theme-draw)' }}>
                      <Layers className='w-3.5 h-3.5' />
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

            {/* 不透明度 */}
            {activeLayer && (
              <div className='px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 flex flex-col gap-2'>
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
                  style={{ '--slider-fill': `${activeLayer.opacity}%` } as React.CSSProperties}
                />
              </div>
            )}

            {/* 操作按钮 */}
            <div className='px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 flex flex-col gap-2'>
              <Button
                size='xs'
                variant='secondary'
                color='green'
                className='flex-1'
                onClick={() => addBeadLayer('', 32)}
              >
                <Plus className='w-3.5 h-3.5' />
                新建图层
              </Button>

              <div className='flex gap-1.5'>
                <button
                  title='上移'
                  onClick={() => activeLayerId && reorderLayer(activeLayerId, 'up')}
                  disabled={!activeLayerId}
                  className={`flex-1 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] transition-colors ${
                    activeLayerId ? 'cursor-pointer hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)] opacity-100' : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <ArrowUp className='w-3.5 h-3.5' />
                </button>
                <button
                  title='下移'
                  onClick={() => activeLayerId && reorderLayer(activeLayerId, 'down')}
                  disabled={!activeLayerId}
                  className={`flex-1 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] transition-colors ${
                    activeLayerId ? 'cursor-pointer hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)] opacity-100' : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <ArrowDown className='w-3.5 h-3.5' />
                </button>
                <button
                  title='合并'
                  onClick={() => activeLayerId && mergeLayerDown(activeLayerId)}
                  disabled={!activeLayerId}
                  className={`flex-1 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-muted)] transition-colors ${
                    activeLayerId ? 'cursor-pointer hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-primary)] opacity-100' : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <Merge className='w-3.5 h-3.5' />
                </button>
                <button
                  title='删除'
                  onClick={() => activeLayerId && deleteLayer(activeLayerId)}
                  disabled={!activeLayerId}
                  className={`flex-1 h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--color-danger)] transition-colors ${
                    activeLayerId ? 'cursor-pointer hover:bg-[var(--theme-danger-light-9)] opacity-100' : 'cursor-not-allowed opacity-40'
                  }`}
                >
                  <Trash2 className='w-3.5 h-3.5' />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 重命名气泡框 */}
      {renamePopover.open && renamePopover.anchor && (
        <div
          ref={renamePopoverRef}
          className='fixed z-[200] p-2.5 flex flex-col gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-soft'
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
    </div>
  );
}
