import { useEditorStore, useConfigStore } from '../store/usePerlerStore';
import { Button } from '@/components/ui';
import { Trash2, Pencil } from 'lucide-react';
import { Badge } from './ui/badge';

export function ColorPalette() {
  const { colorList, selectedColor, setSelectedColor, removeColorFromGrid } = useEditorStore();
  const { brand } = useConfigStore();

  if (colorList.length === 0) return null;

  return (
    <div className="dop-panel-card">
      <div className="dop-panel-card-header">
        <div className="dop-panel-card-header-icon" style={{ background: 'var(--nook-wood)' }}>🎨</div>
        <span className="dop-panel-card-header-title">颜色图例 ({colorList.length} 色)</span>
        <Button variant="primary" size="sm" onClick={() => {}}>
          <Pencil className="w-3.5 h-3.5" />
          编辑
        </Button>
      </div>
      <div className="dop-panel-card-body">
        <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
          {colorList.map((color: { hex: string; codes: Record<string, string>; count: number }) => (
            <div
              key={color.hex}
              onClick={() => setSelectedColor(color)}
              className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer rounded-xl border-2 transition-all duration-150 hover:scale-110 ${
                selectedColor?.hex === color.hex
                  ? 'border-[var(--dop-pink)] bg-[rgba(255,107,157,0.08)]'
                  : 'border-transparent'
              }`}
            >
              <div
                className="w-5 h-5 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <div className="flex-1 min-w-0">
                <p className="m-0 text-xs font-bold text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {color.codes[brand] || 'N/A'}
                </p>
                <Badge
                  variant="secondary"
                  className="mt-0.5 text-xs font-bold text-[var(--text-muted)] px-1.5 py-px"
                >
                  ×{color.count}
                </Badge>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeColorFromGrid(color.hex);
                }}
                className="bg-transparent border-none p-1 cursor-pointer text-[var(--text-muted)] rounded-lg transition-colors hover:text-[var(--dop-danger)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
