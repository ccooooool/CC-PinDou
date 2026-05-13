import { useConfigStore } from '../store/useConfigStore';
import { Plus, Minus, Maximize } from 'lucide-react';

export function FloatingZoom() {
  const { canvasConfig, updateCanvasConfig } = useConfigStore();
  const { zoomLevel } = canvasConfig;

  return (
    <div className="nook-float-zoom bottom-[200px] right-5">
      <button
        className="nook-tool w-8 h-8"
        onClick={() => updateCanvasConfig({ zoomLevel: Math.min(zoomLevel + 0.1, 10) })}
        title="放大"
      >
        <Plus className="w-4 h-4" />
      </button>

      <span className="text-[11px] font-extrabold text-[var(--text-muted)] min-w-[36px] text-center">
        {Math.round(zoomLevel * 100)}%
      </span>

      <button
        className="nook-tool w-8 h-8"
        onClick={() => updateCanvasConfig({ zoomLevel: Math.max(zoomLevel - 0.1, 0.05) })}
        title="缩小"
      >
        <Minus className="w-4 h-4" />
      </button>

      <button
        className="nook-tool w-8 h-8"
        onClick={() => updateCanvasConfig({ zoomLevel: 1 })}
        title="重置缩放"
      >
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
}
