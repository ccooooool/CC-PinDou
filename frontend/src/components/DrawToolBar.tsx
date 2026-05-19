import { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useEditorStore } from '../store/useEditorStore';
import { getModeTheme } from '../utils/theme';
import { ColorPickerPopover } from './ColorPickerPopover';
import { ToolPropertiesPopover } from './ToolPropertiesPopover';
import { Modal } from './ui/modal';
import { toast } from '@/components/ui/toast';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Pencil, Minus, Square, Circle, PaintBucket, Eraser, Wand2, Replace, Move, Pipette,
  RotateCw, FlipHorizontal, FlipVertical, RotateCcw,
  Grid3X3, LayoutGrid, Slash, Trash2, X,
} from 'lucide-react';

const TOOLS = [
  { key: 'move' as const, label: '移动', icon: Move, hasProps: false },
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
  const theme = getModeTheme('draw');
  const { drawTool, setDrawTool, symmetryMode, setSymmetryMode } = useUIStore();
  const { flipHorizontal, flipVertical, rotateCW, rotateCCW, gridData, setGridData, layers, activeLayerId } = useEditorStore();
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const prevActiveLayerIdRef = useRef<string | null>(null);

  // 根据激活图层类型自动切换工具（仅在 activeLayerId 变化时触发，不拦截用户手动选择）
  useEffect(() => {
    if (activeLayerId === prevActiveLayerIdRef.current) return;
    prevActiveLayerIdRef.current = activeLayerId;

    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (activeLayer?.type === 'image') {
      setDrawTool('move');
    } else if (activeLayer?.type === 'bead') {
      setDrawTool('pen');
    }
  }, [activeLayerId, layers, setDrawTool]);

  const handleContextMenu = useCallback((e: React.MouseEvent, toolKey: string) => {
    e.preventDefault();
    const tool = TOOLS.find((t) => t.key === toolKey);
    if (!tool?.hasProps) {
      toast.error('该工具没有可设置的选项');
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
    if (action === 'flipHorizontal') { flipHorizontal(); toast.success('已水平翻转'); }
    else if (action === 'flipVertical') { flipVertical(); toast.success('已垂直翻转'); }
    else if (action === 'rotateCW') { rotateCW(); toast.success('已顺时针旋转 90°'); }
    else if (action === 'rotateCCW') { rotateCCW(); toast.success('已逆时针旋转 90°'); }
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
    <div className="flex flex-col items-center gap-3 p-3 w-12 h-full">
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const active = drawTool === t.key;
        return (
          <Tooltip key={t.key} delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                ref={(el) => { buttonRefs.current[t.key] = el; }}
                onClick={() => setDrawTool(t.key)}
                onContextMenu={(e) => handleContextMenu(e, t.key)}
                className={'nook-tool relative' + (active ? ' active' : '')}
                style={active ? { background: theme.light8, borderColor: theme.main, color: theme.dark1 } : undefined}
              >
                <Icon className="w-[18px] h-[18px]" />
                {t.hasProps && (
                  <svg className="absolute bottom-[3px] right-[3px] opacity-60" width="5" height="5" viewBox="0 0 5 5">
                    <polygon points="0,5 5,5 5,0" fill="var(--text-muted)" />
                  </svg>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {t.label + '工具'}
            </TooltipContent>
          </Tooltip>
        );
      })}

      <div className="w-7 h-[2px] my-1 rounded-full" style={{ background: theme.main }} />

      {/* 变换按钮 */}
      {(() => {
        const tDef = TRANSFORMS.find((t) => t.key === currentTransform) || TRANSFORMS[0];
        const TIcon = tDef.icon;
        return (
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                ref={transformBtnRef}
                className="nook-tool relative"
                onClick={() => handleTransformAction(tDef.action)}
                onContextMenu={handleTransformContextMenu}
              >
                <TIcon className="w-[18px] h-[18px]" />
                <svg className="absolute bottom-[3px] right-[3px] opacity-60" width="5" height="5" viewBox="0 0 5 5">
                  <polygon points="0,5 5,5 5,0" fill="var(--text-muted)" />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              变换工具
            </TooltipContent>
          </Tooltip>
        );
      })()}

      {/* 对称模式按钮 */}
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            ref={symmetryBtnRef}
            className={'nook-tool relative' + (symmetryMode !== 'none' ? ' active' : '')}
            style={symmetryMode !== 'none' ? { background: theme.light8, borderColor: theme.main, color: theme.dark1 } : undefined}
            onClick={() => {
              const next = symmetryMode === 'none' ? 'horizontal' : 'none';
              setSymmetryMode(next);
              if (next === 'none') {
                toast.info('已关闭对称');
              } else {
                const label = SYMMETRIES.find((s) => s.key === next)?.label || '';
                toast.info('已开启' + label);
              }
            }}
            onContextMenu={(e) => { e.preventDefault(); setSymmetryOpen(true); }}
          >
            <SymmetryIcon className={`w-[18px] h-[18px] ${(currentSymmetry as any).iconClassName || ''}`} />
            <svg className="absolute bottom-[3px] right-[3px] opacity-60" width="5" height="5" viewBox="0 0 5 5">
              <polygon points="0,5 5,5 5,0" fill="var(--text-muted)" />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          对称工具
        </TooltipContent>
      </Tooltip>

      {/* 短隔断 + 吸管工具 */}
      <div className="w-7 h-[2px] my-1 rounded-full" style={{ background: theme.main }} />
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            className={'nook-tool' + (drawTool === 'eyedropper' ? ' active' : '')}
            style={drawTool === 'eyedropper' ? { background: theme.light8, borderColor: theme.main, color: theme.dark1 } : undefined}
            onClick={() => setDrawTool('eyedropper')}
            onContextMenu={(e) => {
              e.preventDefault();
              toast.error('该工具没有可设置的选项');
            }}
          >
            <Pipette className="w-[18px] h-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          吸管工具
        </TooltipContent>
      </Tooltip>

      <ColorPickerPopover />

      {/* 删除图层按钮 */}
      <div className="mt-auto" />
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            className="nook-tool"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          删除图层工具
        </TooltipContent>
      </Tooltip>

      {/* 清空画板按钮 */}
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            className="nook-tool"
            onClick={() => setClearConfirmOpen(true)}
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          清空画板工具
        </TooltipContent>
      </Tooltip>

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
          className="nook-panel fixed flex flex-col z-[200] py-1.5 gap-0.5"
          style={{ left: transformPos.left, top: transformPos.top, width: 170 }}
        >
          {TRANSFORMS.map((t) => {
            const Icon = t.icon;
            const active = currentTransform === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setCurrentTransform(t.key);
                  handleTransformAction(t.action);
                  setTransformOpen(false);
                }}
                className={`flex items-center gap-2.5 mx-1 px-3 py-2 text-xs font-semibold transition-all duration-150 rounded-lg text-left ${
                  active
                    ? 'bg-[var(--theme-draw-light-8)] text-[var(--theme-draw)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]'
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
          className="nook-panel fixed flex flex-col z-[200] py-1.5 gap-0.5"
          style={{ left: symmetryPos.left, top: symmetryPos.top, width: 170 }}
        >
          {SYMMETRIES.map((s) => {
            const Icon = s.icon;
            const isActive = symmetryMode === s.key;
            return (
              <button
                key={s.key}
                onClick={() => { setSymmetryMode(s.key); setSymmetryOpen(false); }}
                className={`flex items-center gap-2.5 mx-1 px-3 py-2 text-xs font-semibold transition-all duration-150 rounded-lg text-left ${
                  isActive
                    ? 'bg-[var(--theme-draw-light-8)] text-[var(--theme-draw)]'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${(s as any).iconClassName || ''}`} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 删除图层二次确认 */}
      <Modal
        open={deleteConfirmOpen}
        title="确认删除图层"
        onClose={() => setDeleteConfirmOpen(false)}
        footer={
          <div className="flex items-center gap-2 justify-end">
            <button className="nook-btn nook-btn-secondary" onClick={() => setDeleteConfirmOpen(false)}>
              取消
            </button>
            <button
              className="nook-btn nook-btn-primary"
              style={{ background: 'var(--theme-danger)', borderColor: 'var(--theme-danger-light-1)' }}
              onClick={() => {
                useEditorStore.setState({
                  gridData: [],
                  colorList: [],
                  layers: [],
                  activeLayerId: null,
                  historyStack: [],
                  redoStack: [],
                  selectedCells: [],
                });
                setDeleteConfirmOpen(false);
              }}
            >
              确认删除
            </button>
          </div>
        }
      >
        <p className="text-sm text-[var(--text-primary)]">
          删除后将移除所有图层和绘制内容，回到初始创建画板的状态。此操作不可撤销，是否继续？
        </p>
      </Modal>

      {/* 清空画板二次确认 */}
      <Modal
        open={clearConfirmOpen}
        title="确认清空画板"
        onClose={() => setClearConfirmOpen(false)}
        footer={
          <div className="flex items-center gap-2 justify-end">
            <button className="nook-btn nook-btn-secondary" onClick={() => setClearConfirmOpen(false)}>
              取消
            </button>
            <button
              className="nook-btn nook-btn-primary"
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
