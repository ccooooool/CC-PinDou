

import { useEditorStore } from '../store/usePerlerStore';
import { produce } from 'immer';

import { Button } from '@/components/ui';

import {

  X,

  Undo2,

  Redo2,

  Paintbrush,

  Trash2,

  Clock,

  Wand2,

  Replace,

} from 'lucide-react';

import type { ColorMapping } from '../types/perler';



interface EditPanelProps {

  colorMapping: ColorMapping | null;

}





export function EditPanel(_props: EditPanelProps) {

  const undo = useEditorStore((s) => s.undo);

  const redo = useEditorStore((s) => s.redo);

  const historyStack = useEditorStore((s) => s.historyStack);

  const redoStack = useEditorStore((s) => s.redoStack);

  const selectedColor = useEditorStore((s) => s.selectedColor);

  const selectedCells = useEditorStore((s) => s.selectedCells);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);

  const clearSelection = useEditorStore((s) => s.clearSelection);

  return (

    <div className="dop-panel flex flex-col">

      {/* Header */}

      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,107,157,0.08)]">

        <Paintbrush className="w-4 h-4 text-[var(--dop-pink)]" />

        <h5 className="text-sm font-bold text-[var(--text-main)]">编辑色板</h5>

      </div>



      <div className="flex flex-col gap-3">

        {/* 撤销/重做 */}

        <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0 flex flex-col gap-2">

          <div className="flex gap-2">

            <button

              className="dop-btn dop-btn-secondary flex-1"

              disabled={historyStack.length === 0}

              onClick={undo}

            >

              <Undo2 className="w-3.5 h-3.5" />

              撤销

            </button>

            <button

              className="dop-btn dop-btn-secondary flex-1"

              disabled={redoStack.length === 0}

              onClick={redo}

            >

              <Redo2 className="w-3.5 h-3.5" />

              重做

            </button>

          </div>

        </div>



        {/* 魔法棒选区操作 */}

        {selectedCells.length > 0 && (

          <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0 flex flex-col gap-2">

            <div className="text-xs font-semibold text-[var(--dop-lemon)] flex items-center gap-1">

              <Wand2 className="w-3 h-3" />

              已选中 {selectedCells.length} 个格子?            </div>

            <div className="p-2">

              <div className="flex gap-2">

                <Button

                  variant="primary"

                  size="sm"

                  block

                  disabled={!selectedColor}

                  onClick={() => {

                    if (!selectedColor) return;

                    // 使用 produce 批量修改选区颜色

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

                    useEditorStore.setState(produce((draft: any) => {
                      for (const c of selectedCells) {
                        draft.gridData![c.y][c.x].color = selectedColor.hex;
                        draft.gridData![c.y][c.x].codes = { ...selectedColor.codes };
                      }
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

                  variant="default"

                  size="sm"

                  onClick={() => {

                    useEditorStore.setState(produce((draft: any) => {
                      const positions = selectedCells.map((c: any) => {
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
                      draft.historyStack.push({ type: 'batch_paint', layerId: activeLayerId || 'default', positions });
                      draft.redoStack = [];
                      draft.selectedCells = [];
                    }));

                  }}

                >

                  <Trash2 className="w-3.5 h-3.5" />

                  删除选区

                </Button>

                <Button variant="ghost" size="sm" onClick={clearSelection}>

                  <X className="w-3.5 h-3.5" />

                  清空

                </Button>

              </div>

            </div>

          </div>

        )}



        {/* 操作记录 */}

        {historyStack.length > 0 && (

          <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0 flex flex-col gap-2">

            <div className="text-xs font-bold text-[var(--text-muted)] mb-2 uppercase tracking-wider flex items-center gap-1">

              <Clock className="w-3 h-3" />

              操作记录

            </div>

            <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">

              {[...historyStack].reverse().map((action, idx) => {

                const displayIndex = historyStack.length - idx;

                let text = '';

                let color = '';

                if (action.type === 'paint') {

                  text = `涂色 (${action.x}, ${action.y})`;

                  color = action.newColor;

                } else if (action.type === 'batch_paint') {

                  text = `批量涂色 ${action.positions.length} 个`;

                  color = action.positions[0]?.newColor || 'var(--ai-border)';

                } else if (action.type === 'delete_color') {

                  text = `删除颜色 ${action.positions.length} 个`;

                  color = action.color;

                }

                return (

                  <div key={displayIndex} className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-[var(--surface-hover)] transition-colors">

                    <span className="text-[var(--text-muted)] w-5 text-right text-[11px]">#{displayIndex}</span>

                    <div

                      className="w-3 h-3 rounded-[3px] border border-[var(--ai-border)]"

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

          </div>

        )}

      </div>

    </div>

  );

}

