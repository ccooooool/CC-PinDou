import { useRef, useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import { Slider } from './ui/slider';

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
    brushSizes,
    shapeFillMap,
    setBrushSize,
    setShapeFilled,
  } = useUIStore();

  const tolerance = useEditorStore((s) => s.tolerance);
  const setTolerance = useEditorStore((s) => s.setTolerance);

  const effectiveTool = targetTool || drawTool;
  const hasProps = effectiveTool === 'pen' || effectiveTool === 'eraser' || effectiveTool === 'line' || effectiveTool === 'rect' || effectiveTool === 'circle' || effectiveTool === 'replace' || effectiveTool === 'wand';

  const brushSize = brushSizes[effectiveTool] || 1;
  const shapeFilled = shapeFillMap[effectiveTool] ?? (effectiveTool === 'rect' || effectiveTool === 'circle');

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

  const TOOL_NAMES: Record<string, string> = {
    pen: '笔刷',
    line: '直线',
    rect: '矩形',
    circle: '圆形',
    eraser: '橡皮',
    replace: '替换',
    wand: '魔棒',
  };

  if (!open || !anchorEl || !hasProps) return null;

  const rect = anchorEl.getBoundingClientRect();
  const left = rect.right + 8;
  const top = rect.top - 4;

  return (
    <div
      ref={popoverRef}
      className="fixed flex flex-col z-[200] p-3.5 gap-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden"
      style={{
        left,
        top,
        width: 220,
      }}
    >
      {/* 工具名称标题 */}
      <div className="flex items-center gap-2 text-sm font-bold text-[var(--theme-draw)] pb-2 border-b border-[var(--theme-draw-light-5)]">
        <span className="w-5 h-5 rounded-md bg-[var(--theme-draw-light-9)] flex items-center justify-center text-[10px]">
          {TOOL_NAMES[effectiveTool]?.charAt(0) || '?'}
        </span>
        {TOOL_NAMES[effectiveTool] || '工具'}设置
      </div>

      {/* 笔刷粗细（魔棒不需要） */}
      {effectiveTool !== 'wand' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-0">
              {effectiveTool === 'line' || effectiveTool === 'rect' || effectiveTool === 'circle' ? '线条粗细' : '笔刷大小'}
            </span>
            <span className="text-xs font-bold text-[var(--theme-draw)] min-w-[20px] text-right">
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
            onChange={(e) => setBrushSize(Number(e.target.value), effectiveTool)}
            style={{ '--slider-fill': `${((brushSize - 1) / 4) * 100}%` } as React.CSSProperties}
          />
          {/* 大小预览点 */}
          <div className="flex items-center justify-center gap-1 py-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className="rounded-full transition-all"
                style={{
                  width: 4 + s * 3,
                  height: 4 + s * 3,
                  background: s === brushSize ? 'var(--theme-draw)' : 'var(--nook-wood-light)',
                  transform: s === brushSize ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 填充（仅 rect / circle） */}
      {(effectiveTool === 'rect' || effectiveTool === 'circle') && (
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-[var(--bg-surface-alt)]">
          <span className="text-xs font-semibold text-[var(--text-main)]">内部填充</span>
          <button
            onClick={() => setShapeFilled(!shapeFilled, effectiveTool)}
            className={`relative w-10 h-[22px] rounded-full cursor-pointer transition-colors duration-200 ${
              shapeFilled ? 'bg-[var(--theme-draw)]' : 'bg-[var(--nook-wood-light)]'
            }`}
          >
            <div
              className="w-[18px] h-[18px] rounded-full bg-[var(--bg-surface)] absolute top-[2px] transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
              style={{
                left: shapeFilled ? 20 : 2,
              }}
            />
          </button>
        </div>
      )}

      {/* 颜色替换信息 */}
      {effectiveTool === 'replace' && <ReplaceToolSettings />}

      {/* 容差（仅 wand） */}
      {effectiveTool === 'wand' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-muted)]">容差阈值</span>
            <span className="text-xs font-bold text-[var(--theme-draw)] min-w-[20px] text-right">
              {tolerance}
            </span>
          </div>
          <Slider
            value={[tolerance]}
            onValueChange={([v]) => setTolerance(v)}
            min={0}
            max={255}
            step={1}
            themeColor="var(--theme-draw)"
          />
          <div className="text-[11px] text-[var(--text-caption)] leading-relaxed">
            容差越大，选中的近似色范围越广。0 表示严格匹配同色。
          </div>
        </div>
      )}
    </div>
  );
}
