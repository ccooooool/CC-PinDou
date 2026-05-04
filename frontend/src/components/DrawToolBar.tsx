import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore, useEditorStore } from '../store/usePerlerStore';
import { ColorPickerPopover } from './ColorPickerPopover';
import { ToolPropertiesPopover } from './ToolPropertiesPopover';
import { Modal } from './ui/modal';
import {
  Pencil, Minus, Square, Circle, PaintBucket, Eraser, Wand2, Replace,
  RotateCw, FlipHorizontal, FlipVertical, RotateCcw,
  Grid3X3, LayoutGrid, Slash, Trash2,
} from 'lucide-react';

const TOOLS = [
  { key: 'pen' as const, label: '笔刷', icon: Pencil, hasProps: true },
  { key: 'line' as const, label: '直线', icon: Minus, hasProps: true },
  { key: 'rect' as const, label: '矩形', icon: Square, hasProps: true },
  { key: 'circle' as const, label: '圆形', icon: Circle, hasProps: true },
  { key: 'fill' as const, label: '填充', icon: PaintBucket, hasProps: false },
  { key: 'eraser' as const, label: '橡皮', icon: Eraser, hasProps: true },
  { key: 'wand' as const, label: '魔棒', icon: Wand2, hasProps: false },
  { key: 'replace' as const, label: '替换', icon: Replace, hasProps: true },
];

const TRANSFORMS = [
  { key: 'flipH', label: '水平翻转', icon: FlipHorizontal, action: 'flipHorizontal' as const },
  { key: 'flipV', label: '垂直翻转', icon: FlipVertical, action: 'flipVertical' as const },
  { key: 'rotateCW', label: '顺时针90°', icon: RotateCw, action: 'rotateCW' as const },
  { key: 'rotateCCW', label: '逆时针90°', icon: RotateCcw, action: 'rotateCCW' as const },
];

function XDiagonalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="4" x2="20" y2="20" />
      <line x1="20" y1="4" x2="4" y2="20" />
    </svg>
  );
}

const SYMMETRIES = [
  { key: 'none' as const, label: '无对称', icon: Grid3X3 },
  { key: 'horizontal' as const, label: '水平对称', icon: FlipVertical },
  { key: 'vertical' as const, label: '垂直对称', icon: FlipHorizontal },
  { key: 'quad' as const, label: '四向对称', icon: LayoutGrid },
  { key: 'diagonal' as const, label: '对角线', icon: Slash },
  { key: 'diagonal_anti' as const, label: '反对角线', icon: Slash, iconClassName: 'scale-x-[-1]' },
  { key: 'diagonal_quad' as const, label: '四向对角', icon: XDiagonalIcon },
];

export function DrawToolBar() {
  const { drawTool, setDrawTool, symmetryMode, setSymmetryMode } = useUIStore();
  const { flipHorizontal, flipVertical, rotateCW, rotateCCW, gridData, setGridData } = useEditorStore();
  const [toolPropsOpen, setToolPropsOpen] = useState(false);
  const [toolPropsAnchor, setToolPropsAnchor] = useState<HTMLElement | null>(null);
  const [toolPropsTarget, setToolPropsTarget] = useState<string | undefined>(undefined);
  const [transformOpen, setTransformOpen] = useState(false);
  const transformBtnRef = useRef<HTMLButtonElement>(null);
  const transformPopoverRef = useRef<HTMLDivElement>(null);
  const [currentTransform, setCurrentTransform] = useState('flipH');
  const [symmetryOpen, setSymmetryOpen] = useState(false);
  const symmetryBtnRef = useRef<HTMLButtonElement>(null);
  const symmetryPopoverRef = useRef<HTMLDivElement>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleContextMenu = useCallback((e: React.MouseEvent, toolKey: string) => {
    e.preventDefault();
    const tool = TOOLS.find((t) => t.key === toolKey);
    if (!tool?.hasProps) {
      alert('该工具没有可设置的选项');
      return;
    }
    const btn = buttonRefs.current[toolKey];
    if (btn) { setToolPropsAnchor(btn); setToolPropsTarget(toolKey); setToolPropsOpen(true); }
  }, []);

  const handleTransformContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setTransformOpen(true);
  }, []);

  const handleTransformAction = useCallback((action: string) => {
    if (action === 'flipHorizontal') flipHorizontal();
    else if (action === 'flipVertical') flipVertical();
    else if (action === 'rotateCW') rotateCW();
    else if (action === 'rotateCCW') rotateCCW();
  }, [flipHorizontal, flipVertical, rotateCW, rotateCCW]);

  // 点击外部关闭变换菜单
  useEffect(() => {
    if (!transformOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        transformPopoverRef.current &&
        !transformPopoverRef.current.contains(e.target as Node) &&
        transformBtnRef.current &&
        !transformBtnRef.current.contains(e.target as Node)
      ) {
        setTransformOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [transformOpen]);

  // 点击外部关闭对称菜单
  useEffect(() => {
    if (!symmetryOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        symmetryPopoverRef.current &&
        !symmetryPopoverRef.current.contains(e.target as Node) &&
        symmetryBtnRef.current &&
        !symmetryBtnRef.current.contains(e.target as Node)
      ) {
        setSymmetryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [symmetryOpen]);

  const transformPos = transformBtnRef.current
    ? { left: transformBtnRef.current.getBoundingClientRect().right + 8, top: transformBtnRef.current.getBoundingClientRect().top - 4 }
    : { left: 0, top: 0 };

  const symmetryPos = symmetryBtnRef.current
    ? { left: symmetryBtnRef.current.getBoundingClientRect().right + 8, top: symmetryBtnRef.current.getBoundingClientRect().top - 4 }
    : { left: 0, top: 0 };

  const currentSymmetry = SYMMETRIES.find((s) => s.key === symmetryMode) || SYMMETRIES[0];
  const SymmetryIcon = currentSymmetry.icon;

  return (
    <div className="flex flex-col items-center gap-3 p-3" style={{ width: 48, height: '100%' }}>
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = drawTool === t.key;
        return (
          <button
            key={t.key}
            ref={(el) => { buttonRefs.current[t.key] = el; }}
            title={t.label + (t.hasProps ? '（右键打开设置）' : '')}
            onClick={() => setDrawTool(t.key)}
            onContextMenu={(e) => handleContextMenu(e, t.key)}
            className={'dop-tool' + (active ? ' active' : '')}
          >
            <Icon className="w-[18px] h-[18px]" />
          </button>
        );
      })}

      <div className="w-7 h-[2px] bg-[var(--dop-pink)] my-1 rounded-full" />

      {/* 变换按钮 */}
      {(() => {
        const tDef = TRANSFORMS.find((t) => t.key === currentTransform) || TRANSFORMS[0];
        const TIcon = tDef.icon;
        return (
          <button
            ref={transformBtnRef}
            title={tDef.label + '（右键展开选项）'}
            className="dop-tool"
            onClick={() => handleTransformAction(tDef.action)}
            onContextMenu={handleTransformContextMenu}
          >
            <TIcon className="w-[18px] h-[18px]" />
          </button>
        );
      })()}

      {/* 对称模式按钮 */}
      <button
        ref={symmetryBtnRef}
        title={currentSymmetry.label + '（右键展开选项）'}
        className={'dop-tool' + (symmetryMode !== 'none' ? ' active' : '')}
        onClick={() => setSymmetryMode(symmetryMode === 'none' ? 'horizontal' : 'none')}
        onContextMenu={(e) => { e.preventDefault(); setSymmetryOpen(true); }}
      >
        <SymmetryIcon className={`w-[18px] h-[18px] ${(currentSymmetry as any).iconClassName || ''}`} />
      </button>

      <ColorPickerPopover />

      {/* 清空画板按钮 */}
      <div className="mt-auto" />
      <button
        title="清空画板"
        className="dop-tool"
        onClick={() => setClearConfirmOpen(true)}
      >
        <Trash2 className="w-[18px] h-[18px]" />
      </button>

      <ToolPropertiesPopover
        open={toolPropsOpen}
        onClose={() => { setToolPropsOpen(false); setToolPropsTarget(undefined); }}
        anchorEl={toolPropsAnchor}
        targetTool={toolPropsTarget}
      />

      {/* 变换右键菜单 */}
      {transformOpen && (
        <div
          ref={transformPopoverRef}
          className="dop-panel fixed flex flex-col z-[100] py-1"
          style={{ left: transformPos.left, top: transformPos.top, width: 160 }}
        >
          {TRANSFORMS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setCurrentTransform(t.key);
                  handleTransformAction(t.action);
                  setTransformOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                  currentTransform === t.key
                    ? 'bg-[var(--nook-wood-light)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 对称模式右键菜单 */}
      {symmetryOpen && (
        <div
          ref={symmetryPopoverRef}
          className="dop-panel fixed flex flex-col z-[100] py-1"
          style={{ left: symmetryPos.left, top: symmetryPos.top, width: 160 }}
        >
          {SYMMETRIES.map((s) => {
            const Icon = s.icon;
            const isActive = symmetryMode === s.key;
            return (
              <button
                key={s.key}
                onClick={() => { setSymmetryMode(s.key); setSymmetryOpen(false); }}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-[var(--nook-wood-light)] text-[var(--text-primary)] font-semibold'
                    : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${(s as any).iconClassName || ''}`} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 清空画板二次确认 */}
      <Modal
        open={clearConfirmOpen}
        title="确认清空画板"
        onClose={() => setClearConfirmOpen(false)}
        footer={
          <div className="flex items-center gap-2 justify-end">
            <button className="dop-btn dop-btn-secondary" onClick={() => setClearConfirmOpen(false)}>
              取消
            </button>
            <button
              className="dop-btn dop-btn-primary"
              onClick={() => {
                if (gridData) {
                  const newGrid = gridData.map((row) =>
                    row.map((cell) => ({ ...cell, color: 'transparent' as string, codes: {} as Record<string, string> }))
                  );
                  setGridData(newGrid, []);
                }
                setClearConfirmOpen(false);
              }}
            >
              确认清空
            </button>
          </div>
        }
      >
        <p className="text-sm text-[var(--text-primary)]">
          确定要清空当前画板吗？所有绘制内容将被清除，此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
}
