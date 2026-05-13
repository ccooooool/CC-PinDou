import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import { useUIStore } from '../store/useUIStore';
import { Palette, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Badge } from './ui/badge';

export function LegendBar() {
  const { colorList, removeColorFromGrid } = useEditorStore();
  const { brand } = useConfigStore();
  const { legendCollapsed, toggleLegend } = useUIStore();

  if (!colorList.length) return null;

  return (
    <div
      className="nook-legend"
      style={{ maxHeight: legendCollapsed ? 40 : 180, flexWrap: legendCollapsed ? 'nowrap' : 'wrap' }}
    >
      <span
        className="flex items-center gap-1.5 cursor-pointer select-none shrink-0 text-xs font-extrabold text-[var(--text-muted)]"
        onClick={toggleLegend}
      >
        <Palette className="w-3.5 h-3.5" />
        图例统计
        <small className="font-semibold text-[var(--text-caption)]">
          （{colorList.length} 种）
        </small>
        {legendCollapsed ? (
          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
        )}
      </span>

      {!legendCollapsed && (
        <>
          {colorList.map((color) => {
            const code = color.codes[brand] || 'N/A';
            return (
              <div
                key={color.hex}
                className="nook-legend-item"
              >
                <div
                  className="nook-legend-dot"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-xs font-bold text-[var(--text-main)]">
                  {code}
                </span>
                <Badge
                  variant="secondary"
                  className="rounded-full text-xs font-bold px-2 py-0.5 border-none"
                >
                  ×{color.count}
                </Badge>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeColorFromGrid(color.hex);
                  }}
                  className="w-4 h-4 rounded-full border-none bg-transparent text-[var(--text-muted)] text-[10px] cursor-pointer flex items-center justify-center p-0 transition-colors hover:bg-[var(--color-danger)] hover:text-white"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
