import { useConfigStore } from '../store/useConfigStore';
import { Plus, Minus, Maximize } from 'lucide-react';

export function FloatingZoom({ className = 'bottom-[200px] right-5' }: { className?: string }) {
  const { canvasConfig, updateCanvasConfig } = useConfigStore();
  const { zoomLevel } = canvasConfig;

  return (
    <div className={`nook-float-zoom ${className}`}>
      <button
        className="nook-tool w-8 h-8"
        onClick={() => updateCanvasConfig({ zoomLevel: Math.min(zoomLevel + 0.1, 10) })}
        title="放大"
      >
        <Plus className="w-4 h-4" />
      </button>

      <span
        className="text-[11px] font-black w-8 h-8 flex items-center justify-center"
        style={{
          color: 'var(--text-main)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          textShadow: '0 0 2px rgba(255,255,255,0.8)',
          letterSpacing: '0.3px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--nook-wood-light)',
        }}
      >
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
