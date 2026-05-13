import { useRef, useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';

function ReplaceToolSettings() {
  const selectedColor = useEditorStore((s) => s.selectedColor);
  const brand = useConfigStore((s) => s.brand);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-xs font-semibold text-[var(--text-main)]">颜色替换</div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-caption)]">目标色。</span>
        <div
          className="w-5 h-5 rounded border border-[var(--border-subtle)]"
          style={{
            background: selectedColor?.hex || '#e2e8f0',
            backgroundImage: selectedColor?.hex === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)' : undefined,
          }}
        />
        <span className="text-[11px] text-[var(--text-caption)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {selectedColor?.codes?.[brand] || selectedColor?.hex || '未选择'}
        </span>
      </div>
      <div className="text-[11px] text-[var(--text-caption)] leading-relaxed">
        点击画布上的任意颜色格子，将其全局替换为目标色。
      </div>
    </div>
  );
}

interface ToolPropertiesPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  targetTool?: string;
}

export function ToolPropertiesPopover({ open, onClose, anchorEl, targetTool }: ToolPropertiesPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const {
    drawTool,
    brushSize,
    shapeFilled,
    setBrushSize,
    setShapeFilled,
  } = useUIStore();

  const effectiveTool = targetTool || drawTool;
  const hasProps = effectiveTool === 'pen' || effectiveTool === 'eraser' || effectiveTool === 'line' || effectiveTool === 'rect' || effectiveTool === 'circle' || effectiveTool === 'replace';

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  useEffect(() => {
    if (!hasProps && open) {
      onClose();
    }
  }, [hasProps, open, onClose]);

  if (!open || !anchorEl || !hasProps) return null;

  const rect = anchorEl.getBoundingClientRect();
  const left = rect.right + 8;
  const top = rect.top - 4;

  return (
    <div
      ref={popoverRef}
      className="nook-panel fixed flex flex-col z-[100] p-3.5 gap-3"
      style={{
        left,
        top,
        width: 220,
      }}
    >
      {/* 笔刷粗细 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-[var(--text-main)]">
            {effectiveTool === 'line' || effectiveTool === 'rect' || effectiveTool === 'circle' ? '线条粗细' : '笔刷大小'}
          </span>
          <span className="text-xs font-semibold text-[var(--text-secondary)] min-w-[20px]">
            {brushSize}
          </span>
        </div>
        <input
          type="range"
          className="nook-slider"
          min={1}
          max={5}
          step={1}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </div>

      {/* 填充（仅 rect / circle）?*/}
      {(effectiveTool === 'rect' || effectiveTool === 'circle') && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--text-main)]">内部填充</span>
          <button
            onClick={() => setShapeFilled(!shapeFilled)}
            className={`nook-btn w-10 h-[22px] rounded-full border-none cursor-pointer relative transition-colors p-0 ${shapeFilled ? 'nook-btn-primary' : 'nook-btn-secondary'}`}
          >
            <div
              className="w-[18px] h-[18px] rounded-full bg-[var(--bg-surface)] absolute top-0.5 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
              style={{
                left: shapeFilled ? 20 : 2,
              }}
            />
          </button>
        </div>
      )}

      {/* 颜色替换信息 */}
      {effectiveTool === 'replace' && <ReplaceToolSettings />}
    </div>
  );
}
