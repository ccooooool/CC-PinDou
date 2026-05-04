import { useState } from 'react';
import { useEditorStore } from '../store/usePerlerStore';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Image,
  Trash2,
  ArrowUp,
  ArrowDown,
  Merge,
  Plus,
} from 'lucide-react';

export function LayerPanel() {
  const {
    layers,
    activeLayerId,
    setActiveLayer,
    toggleLayerVisible,
    toggleLayerLock,
    reorderLayer,
    deleteLayer,
    updateLayerOpacity,
    mergeLayerDown,
    addBeadLayer,
    addImageLayer,
  } = useEditorStore();

  const [newImageUrl, setNewImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="dop-panel flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,107,157,0.08)]">
        <Layers className="w-4 h-4 text-[var(--dop-pink)]" />
        <span className="text-sm font-bold text-[var(--text-main)]">图层</span>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="flex flex-col gap-3">
          {/* 图层列表 */}
          <div className="max-h-60 overflow-y-auto">
            {[...layers].sort((a, b) => b.zIndex - a.zIndex).map((layer) => {
              const isActive = layer.id === activeLayerId;
              const Icon = layer.type === 'bead' ? Layers : Image;
              return (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`dop-layer ${isActive ? 'active' : ''}`}
                >
                  <div
                    className="dop-layer-thumb"
                    style={{ background: 'var(--nook-wood)' }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`flex-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap ${
                      isActive ? 'font-semibold' : 'font-normal'
                    } ${layer.visible ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
                    title={layer.name}
                  >
                    {layer.name}
                  </span>

                  {/* 可见性?*/}
                  <button
                    title={layer.visible ? '隐藏' : '显示'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisible(layer.id);
                    }}
                    className={`w-[22px] h-[22px] flex items-center justify-center rounded bg-transparent cursor-pointer ${
                      layer.visible ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {layer.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* 锁定 */}
                  <button
                    title={layer.locked ? '解锁' : '锁定'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerLock(layer.id);
                    }}
                    className={`w-[22px] h-[22px] flex items-center justify-center rounded bg-transparent cursor-pointer ${
                      layer.locked ? 'text-[var(--dop-pink)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {layer.locked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 激活图层不透明度*/}
          {activeLayer && (
            <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-main)] flex-shrink-0">不透明度</span>
                <span className="text-xs font-bold text-[var(--dop-pink)] min-w-[32px]">
                  {activeLayer.opacity}%
                </span>
              </div>
              <input
                type="range"
                className="dop-slider"
                value={activeLayer.opacity}
                onChange={(e) => updateLayerOpacity(activeLayer.id, Number(e.target.value))}
                min={0}
                max={100}
                step={5}
              />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0 flex flex-col gap-2">
            <div className="flex gap-1.5">
              <button
                className="dop-btn dop-btn-secondary flex-1 text-xs"
                onClick={() => addBeadLayer('', 32)}
              >
                <Plus className="w-3.5 h-3.5" />
                新建
              </button>
              <button
                className="dop-btn dop-btn-secondary flex-1 text-xs"
                onClick={() => setShowImageInput(!showImageInput)}
              >
                <Image className="w-3.5 h-3.5" />
                图片
              </button>
            </div>

            {showImageInput && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="图片 URL"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="dop-input flex-1 text-xs"
                />
                <button
                  className="dop-btn dop-btn-primary text-xs"
                  onClick={() => {
                    if (newImageUrl.trim()) {
                      addImageLayer('', newImageUrl.trim());
                      setNewImageUrl('');
                      setShowImageInput(false);
                    }
                  }}
                >
                  添加
                </button>
              </div>
            )}

            <div className="flex gap-1.5">
              <button
                title="上移"
                onClick={() => activeLayerId && reorderLayer(activeLayerId, 'up')}
                disabled={!activeLayerId}
                className={`flex-1 px-1 py-1.5 rounded-lg border border-[#f1f5f9] bg-white flex items-center justify-center text-[var(--text-muted)] ${
                  activeLayerId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40'
                }`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                title="下移"
                onClick={() => activeLayerId && reorderLayer(activeLayerId, 'down')}
                disabled={!activeLayerId}
                className={`flex-1 px-1 py-1.5 rounded-lg border border-[#f1f5f9] bg-white flex items-center justify-center text-[var(--text-muted)] ${
                  activeLayerId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40'
                }`}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                title="合并"
                onClick={() => activeLayerId && mergeLayerDown(activeLayerId)}
                disabled={!activeLayerId}
                className={`flex-1 px-1 py-1.5 rounded-lg border border-[#f1f5f9] bg-white flex items-center justify-center text-[var(--text-muted)] ${
                  activeLayerId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40'
                }`}
              >
                <Merge className="w-3.5 h-3.5" />
              </button>
              <button
                title="删除"
                onClick={() => activeLayerId && deleteLayer(activeLayerId)}
                disabled={!activeLayerId}
                className={`flex-1 px-1 py-1.5 rounded-lg border border-[#f1f5f9] bg-white flex items-center justify-center text-[var(--dop-danger)] ${
                  activeLayerId ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
