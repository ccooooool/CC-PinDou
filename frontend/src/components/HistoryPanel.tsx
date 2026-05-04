import { useEditorStore } from '../store/usePerlerStore';
import { Undo2, Redo2, Paintbrush, Trash2, Layers } from 'lucide-react';

export function HistoryPanel() {
  const historyStack = useEditorStore((s) => s.historyStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  if (historyStack.length === 0 && redoStack.length === 0) {
    return null;
  }

  return (
    <div className="dop-panel flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,107,157,0.08)]">
        <Layers className="w-4 h-4 text-[var(--dop-pink)]" />
        <span className="text-sm font-bold text-[var(--text-main)]">操作记录</span>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col gap-3">
          {/* Undo/Redo */}
          <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0 flex items-center justify-end gap-1">
            <button
              className="dop-btn dop-btn-secondary"
              disabled={historyStack.length === 0}
              onClick={undo}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              className="dop-btn dop-btn-secondary"
              disabled={redoStack.length === 0}
              onClick={redo}
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-3 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {[...historyStack].reverse().map((action, idx) => {
              const displayIndex = historyStack.length - idx;
              let icon = <Paintbrush className="w-3 h-3" />;
              let text = '';
              let color = '';

              if (action.type === 'paint') {
                text = `涂色 (${action.x}, ${action.y})`;
                color = action.newColor === 'transparent' ? 'var(--ai-border)' : action.newColor;
              } else if (action.type === 'batch_paint') {
                text = `批量涂色 ${action.positions.length} 个`;
                color = action.positions[0]?.newColor || 'var(--ai-border)';
              } else if (action.type === 'delete_color') {
                text = `删除颜色 ${action.positions.length} 个`;
                icon = <Trash2 className="w-3 h-3" />;
                color = action.color === 'transparent' ? 'var(--ai-border)' : action.color;
              }

              return (
                <div
                  key={`h-${displayIndex}`}
                  className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-[rgba(255,107,157,0.08)] transition-colors"
                >
                  <span className="text-[10px] text-[var(--text-muted)] w-6 text-right">#{displayIndex}</span>
                  <div
                    className="w-4 h-4 rounded border border-[var(--ai-border)] flex-shrink-0"
                    style={{
                      backgroundColor: color,
                      backgroundImage:
                        color === 'transparent'
                          ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)'
                          : undefined,
                    }}
                  />
                  <span className="text-xs text-[var(--text-main)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{text}</span>
                  {icon}
                </div>
              );
            })}

            {historyStack.length === 0 && (
              <p className="text-xs text-[var(--text-muted)] text-center py-2">暂无操作记录</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
