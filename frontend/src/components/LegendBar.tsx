import { useEditorStore, useConfigStore, useUIStore } from '../store/usePerlerStore';
import { Palette, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Badge } from './ui/badge';

export function LegendBar() {
  const { colorList, removeColorFromGrid } = useEditorStore();
  const { brand } = useConfigStore();
  const { legendCollapsed, toggleLegend } = useUIStore();

  if (!colorList.length) return null;

  return (
    <div
      className="dop-legend"
      style={{ maxHeight: legendCollapsed ? 40 : 180, flexWrap: legendCollapsed ? 'nowrap' : 'wrap' }}
    >
      <span
        className="flex items-center gap-1.5 cursor-pointer select-none shrink-0"
        onClick={toggleLegend}
        style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}
      >
        <Palette className="w-3.5 h-3.5" />
        图例统计
        <small style={{ fontWeight: 600, color: 'var(--text-caption)' }}>
          （{colorList.length} 种）
        </small>
        {legendCollapsed ? (
          <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        )}
      </span>

      {!legendCollapsed && (
        <>
          {colorList.map((color) => {
            const code = color.codes[brand] || 'N/A';
            return (
              <div
                key={color.hex}
                className="dop-legend-item"
              >
                <div
                  className="dop-legend-dot"
                  style={{ backgroundColor: color.hex }}
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)' }}>
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
                  className="w-4 h-4 rounded-full border-none bg-transparent text-[var(--text-muted)] text-[10px] cursor-pointer flex items-center justify-center p-0 transition-colors hover:bg-[var(--dop-danger)] hover:text-white"
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
