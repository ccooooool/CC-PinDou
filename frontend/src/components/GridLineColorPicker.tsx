import { useState, useRef, useEffect } from 'react';

interface GridLineColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  themeColor?: string;
}

const PRESET_COLORS = [
  '#ff0000',
  '#ff6600',
  '#ffcc00',
  '#00cc44',
  '#00cccc',
  '#0066ff',
  '#cc00ff',
  '#ff66cc',
  '#ffffff',
  '#000000',
];

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return `rgba(255, 0, 0, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function GridLineColorPicker({ value, onChange, themeColor }: GridLineColorPickerProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // 弹窗显示在按钮右下方
      setPos({ left: rect.left, top: rect.bottom + 8 });
    }
    setOpen(!open);
  };

  const accent = themeColor || 'var(--theme-draw)';
  return (
    <div className="flex items-center gap-2.5">
      <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">参考线颜色</label>
      <div className="flex-1 flex items-center gap-2">
        {/* 当前颜色触发按钮 */}
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className="relative w-6 h-6 rounded-md border cursor-pointer transition-all duration-150 shrink-0"
          style={{
            backgroundColor: value,
            borderColor: open ? accent : 'var(--border-default)',
            boxShadow: open ? `0 0 0 2px color-mix(in srgb, ${accent} 30%, transparent)` : undefined,
          }}
          title={value}
        />

        {/* Popover 色板弹窗 */}
        {open && (
          <div
            ref={popoverRef}
            className="fixed z-[100] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-soft p-3"
            style={{
              left: pos.left,
              top: pos.top,
              width: 200,
            }}
          >
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((color) => {
                const selected = value.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    onClick={() => {
                      onChange(color);
                      setOpen(false);
                    }}
                    className="relative w-7 h-7 rounded-md border cursor-pointer transition-transform duration-150 hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: selected ? accent : 'var(--border-default)',
                      boxShadow: selected
                        ? `0 0 0 2px color-mix(in srgb, ${accent} 35%, transparent)`
                        : undefined,
                    }}
                    title={color}
                  >
                    {/* 选中时对勾 */}
                    {selected && (
                      <div
                        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                        style={{ background: accent }}
                      >
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path
                            d="M2 4.5L3.8 6.5L7 2.5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
