import { useEditorStore, useConfigStore, useUIStore } from '../store/usePerlerStore';
import { Grid3X3, Paintbrush, MousePointer } from 'lucide-react';

export function StatusBar() {
  const gridData = useEditorStore((s) => s.gridData);
  const { canvasConfig } = useConfigStore();
  const { mode, drawTool } = useUIStore();
  const { zoomLevel } = canvasConfig;

  const rows = gridData?.length || 0;
  const cols = gridData?.[0]?.length || 0;

  const toolNames: Record<string, string> = {
    pen: '笔刷',
    line: '直线',
    rect: '矩形',
    circle: '圆形',
    fill: '填充',
    eraser: '橡皮',
    wand: '魔棒',
    replace: '替换',
  };

  return (
    <div className="nook-ps-statusbar">
      <div className="nook-ps-status-item">
        <Grid3X3 className="w-3.5 h-3.5" />
        <span>
          {gridData ? `${cols} × ${rows} px` : '无画布'}
        </span>
      </div>
      <div className="nook-ps-status-sep" />
      <div className="nook-ps-status-item">
        <Paintbrush className="w-3.5 h-3.5" />
        <span>RGB/8位</span>
      </div>
      <div className="nook-ps-status-sep" />
      <div className="nook-ps-status-item">
        <MousePointer className="w-3.5 h-3.5" />
        <span>
          {mode === 'draw' ? (toolNames[drawTool] || drawTool) : '选择工具'}
        </span>
      </div>

      <div className="nook-ps-status-right">
        <div className="nook-ps-zoom-control">
          <span className="nook-ps-zoom-btn">−</span>
          <span style={{ fontWeight: 700, minWidth: 40, textAlign: 'center', fontSize: 12 }}>
            {Math.round(zoomLevel * 100)}%
          </span>
          <span className="nook-ps-zoom-btn">+</span>
        </div>
      </div>
    </div>
  );
}
