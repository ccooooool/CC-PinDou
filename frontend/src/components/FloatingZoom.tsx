import { useConfigStore } from '../store/usePerlerStore';
import { Plus, Minus, Maximize } from 'lucide-react';

export function FloatingZoom() {
  const { canvasConfig, updateCanvasConfig } = useConfigStore();
  const { zoomLevel } = canvasConfig;

  return (
    <div className="dop-float-zoom" style={{ bottom: 200, right: 20 }}>
      <button
        className="dop-tool"
        style={{ width: 32, height: 32 }}
        onClick={() => updateCanvasConfig({ zoomLevel: Math.min(zoomLevel + 0.1, 10) })}
        title="放大"
      >
        <Plus className="w-4 h-4" />
      </button>

      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', minWidth: 36, textAlign: 'center' }}>
        {Math.round(zoomLevel * 100)}%
      </span>

      <button
        className="dop-tool"
        style={{ width: 32, height: 32 }}
        onClick={() => updateCanvasConfig({ zoomLevel: Math.max(zoomLevel - 0.1, 0.05) })}
        title="缩小"
      >
        <Minus className="w-4 h-4" />
      </button>

      <button
        className="dop-tool"
        style={{ width: 32, height: 32 }}
        onClick={() => updateCanvasConfig({ zoomLevel: 1 })}
        title="重置缩放"
      >
        <Maximize className="w-4 h-4" />
      </button>
    </div>
  );
}
