import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useEditorStore } from '../store/useEditorStore';
import type { EditorState } from '../store/useEditorStore';
import { produce } from 'immer';
import {
  X,
  Undo2,
  Redo2,
  Trash2,
  Clock,
  Wand2,
  Replace,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import type { ColorMapping } from '../types/perler';

interface EditPanelProps {
  colorMapping: ColorMapping | null;
}

export function EditPanel(_props: EditPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const historyStack = useEditorStore((s) => s.historyStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const selectedColor = useEditorStore((s) => s.selectedColor);
  const selectedCells = useEditorStore((s) => s.selectedCells);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  return (
    <div className="flex flex-col mx-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--theme-draw-light-5)] bg-[var(--theme-draw-light-9)] cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-1 h-4 rounded-full bg-[var(--theme-draw)]" />
        <h5 className="text-sm font-bold text-[var(--theme-draw-dark-2)]">操作记录</h5>
        <ChevronDown
          className={cn('w-4 h-4 ml-auto transition-transform duration-300', expanded && 'rotate-180')}
          style={{ transitionTimingFunction: 'var(--ease-bounce)' }}
        />
      </div>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
        style={{ transitionTimingFunction: 'var(--ease-bounce)' }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-3">
            {/* 撤销/重做 */}
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  color="green"
                  className="flex-1 justify-center"
                  disabled={historyStack.length === 0}
                  onClick={undo}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  撤销
                </Button>
                <Button
                  size="xs"
                  variant="secondary"
                  color="green"
                  className="flex-1 justify-center"
                  disabled={redoStack.length === 0}
                  onClick={redo}
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  重做
                </Button>
              </div>
            </div>

            {/* 魔法棒选区操作 */}
            {selectedCells.length > 0 && (
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 flex flex-col gap-2">
                <div className="text-xs font-bold text-[var(--theme-draw)] flex items-center gap-1.5 bg-[var(--theme-draw-light-9)] px-3 py-2 rounded-lg">
                  <Wand2 className="w-3.5 h-3.5" />
                  已选中 {selectedCells.length} 个格子
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="xs"
                    variant="primary"
                    color="green"
                    className="flex-1 justify-center"
                    disabled={!selectedColor}
                    onClick={() => {
                      if (!selectedColor) return;
                      const editorSetState = useEditorStore.getState();
                      const gd = editorSetState.gridData;
                      if (!gd) return;
                      const records = selectedCells.map((c) => ({
                        x: c.x, y: c.y,
                        oldColor: gd[c.y][c.x].color,
                        oldCodes: { ...gd[c.y][c.x].codes },
                        newColor: selectedColor.hex,
                        newCodes: { ...selectedColor.codes },
                      }));
                      useEditorStore.setState(produce((draft: EditorState) => {
                        for (const c of selectedCells) {
                          draft.gridData![c.y][c.x].color = selectedColor.hex;
                          draft.gridData![c.y][c.x].codes = { ...selectedColor.codes };
                        }
                        if (draft.historyStack.length >= 50) draft.historyStack.shift();
                        draft.historyStack.push({ type: 'batch_paint', positions: records, layerId: activeLayerId || 'default' });
                        draft.redoStack = [];
                        draft.selectedCells = [];
                      }));
                    }}
                  >
                    <Replace className="w-3.5 h-3.5" />
                    替换为当前色
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    color="green"
                    className="justify-center"
                    onClick={() => {
                      useEditorStore.setState(produce((draft: EditorState) => {
                        const positions = selectedCells.map((c: { x: number; y: number }) => {
                          const oldColor = draft.gridData![c.y][c.x].color;
                          const oldCodes = { ...draft.gridData![c.y][c.x].codes };
                          draft.gridData![c.y][c.x].color = 'transparent';
                          draft.gridData![c.y][c.x].codes = {};
                          return {
                            x: c.x, y: c.y,
                            oldColor: oldColor === 'transparent' ? '' : oldColor,
                            oldCodes,
                            newColor: 'transparent',
                            newCodes: {},
                          };
                        });
                        if (draft.historyStack.length >= 50) draft.historyStack.shift();
                        draft.historyStack.push({ type: 'batch_paint', layerId: activeLayerId || 'default', positions });
                        draft.redoStack = [];
                        draft.selectedCells = [];
                      }));
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除选区
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    color="green"
                    className="justify-center px-2"
                    onClick={clearSelection}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* 操作记录 */}
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 flex flex-col gap-2">
              <div className="text-xs font-bold text-[var(--theme-draw)] mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                操作记录
              </div>
              {historyStack.length > 0 ? (
                <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                  {[...historyStack].reverse().map((action, idx) => {
                    const displayIndex = historyStack.length - idx;
                    let text = '';
                    let color = '';
                    if (action.type === 'paint') {
                      text = `涂色 (${action.x}, ${action.y})`;
                      color = action.newColor;
                    } else if (action.type === 'batch_paint') {
                      text = `批量涂色 ${action.positions.length} 个`;
                      color = action.positions[0]?.newColor || 'var(--border-default)';
                    } else if (action.type === 'delete_color') {
                      text = `删除颜色 ${action.positions.length} 个`;
                      color = action.color;
                    }
                    return (
                      <div key={displayIndex} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--theme-draw-light-9)] transition-colors cursor-default">
                        <span className="text-[var(--text-muted)] w-5 text-right text-[11px] font-semibold">#{displayIndex}</span>
                        <div
                          className="w-3.5 h-3.5 rounded-[4px] border border-[var(--border-default)] flex-shrink-0"
                          style={{
                            backgroundColor: color === 'transparent' ? undefined : color,
                            backgroundImage: color === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)' : undefined,
                          }}
                        />
                        <span className="text-[var(--text-main)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px]">{text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-4 text-[var(--text-muted)]">
                  <ClipboardList className="w-6 h-6 opacity-40" />
                  <span className="text-[11px] font-medium">暂无操作记录</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
