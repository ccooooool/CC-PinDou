import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { ImageUploader } from './components/ImageUploader';
import { ParamPanel } from './components/ParamPanel';
import { PixelPanel } from './components/PixelPanel';

import { DrawToolBar } from './components/DrawToolBar';
import { LayerPanel } from './components/LayerPanel';
import { ModeTabs } from './components/ModeTabs';
import { CanvasEditor } from './components/CanvasEditor';
import { Toolbar } from './components/Toolbar';
import { RemoveBgButton } from './components/RemoveBgButton';
import { BgRemovePanel } from './components/BgRemovePanel';

import { LegendBar } from './components/LegendBar';
import { FloatingZoom } from './components/FloatingZoom';
import { EditPanel } from './components/EditPanel';
import { PerlerEngine } from './engine/PerlerEngine';
import { useEditorStore } from './store/useEditorStore';
import { useUIStore } from './store/useUIStore';
import { useConfigStore } from './store/useConfigStore';
import { useImageUpload } from './hooks/useImageUpload';
import { usePatternGenerator } from './hooks/usePatternGenerator';
import { TooltipProvider } from './components/ui/tooltip';
import { Loader2, Wand2, Trash2, Image, ClipboardPenLine } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { useBackendHealth } from './hooks/useBackendHealth';
import { getModeTheme } from './utils/theme';
import { Skeleton } from './components/ui/skeleton';
import ModeBackground from './components/ModeBackground';
import { triggerViewTransition, DEFAULT_COLORS } from './utils/viewTransition';
import { getPixelIcon } from './utils/pixelIcon';
import type { ColorMapping } from './types/perler';
import colorMappingJson from './data/colorSystemMapping.json';

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

interface AppProps {
  variant?: 'simple' | 'full';
}

function App({ variant = 'full' }: AppProps) {
  const isSimple = variant === 'simple';
  const [engine, setEngine] = useState<PerlerEngine | null>(null);
  const {
    previewImage,
    selectedFile,
    processedImage,
    handleImageSelect: onImageSelectRaw,
    handleBgRemoved: onBgRemovedRaw,
    clearImages,
  } = useImageUpload();
  const { gridSize, colorSimplify, enhanceLines, colorMode } = useConfigStore();
  const { setGridData } = useEditorStore();

  const {
    handleGenerate,
    isGenerating,
    error,
    setError,
  } = usePatternGenerator({
    engine,
    previewImage,
    gridSize,
    colorSimplify,
    enhanceLines,
    colorMode,
    onSuccess: useCallback((grid, colors) => setGridData(grid, colors), [setGridData]),
  });
  const [activeTab, setActiveTab] = useState<'removeBg' | 'generate'>('generate');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const navigate = useNavigate();
  const { mode: urlMode } = useParams<{ mode: string }>();
  const mode = (urlMode as 'normal' | 'pixel' | 'draw') || 'normal';

  // simple 模式下不检测后端，强制不可用；full 模式下正常检测
  const health = useBackendHealth(!isSimple);
  const backendAvailable = isSimple ? false : health.available;

  const gridData = useEditorStore((s) => s.gridData);
  const { setMode } = useUIStore();

  const theme = getModeTheme(mode);

  // URL mode 同步到 store，供其他组件使用
  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);

  // 模式切换确认弹窗
  const [modeSwitchConfirm, setModeSwitchConfirm] = useState<{ open: boolean; targetMode: string }>({ open: false, targetMode: '' });

  const pixelIconClass = getPixelIcon();

  const getTransitionIcon = (targetMode: string) => {
    if (targetMode === 'normal') return <Image className="w-24 h-24" />;
    if (targetMode === 'pixel') return <i className={pixelIconClass} style={{ transform: 'scale(1)', margin: 0, imageRendering: 'pixelated', display: 'block' }} />;
    return <ClipboardPenLine className="w-24 h-24" />;
  };

  const handleModeChange = useCallback((targetMode: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    const basePath = isSimple ? '/simple' : '/full';
    const hasGridData = gridData && gridData.length > 0;
    const hasNormalImage = !!previewImage || !!selectedFile || !!processedImage;
    const hasPixelImage = !!useConfigStore.getState().pixelImageUrl;
    const hasAnyImage = hasNormalImage || hasPixelImage;

    const originEl = e?.currentTarget;
    const color = DEFAULT_COLORS[targetMode as 'normal' | 'pixel' | 'draw'] || 'var(--theme-normal)';
    const icon = getTransitionIcon(targetMode);

    const navigateFn = () => navigate(`/${basePath}/${targetMode}`, { replace: true });

    const runTransition = (fn: () => void) => {
      if (originEl) {
        triggerViewTransition(fn, { color, icon, originEl });
      } else {
        // 弹窗确认时没有按钮事件，用屏幕中心作为原点
        const centerEl = document.createElement('div');
        centerEl.style.cssText = `position:fixed;top:50%;left:50%;width:1px;height:1px;`;
        document.body.appendChild(centerEl);
        triggerViewTransition(fn, { color, icon, originEl: centerEl });
        setTimeout(() => centerEl.remove(), 1600);
      }
    };

    // 场景1：没有任何内容，随意切换
    if (!hasGridData && !hasAnyImage) {
      runTransition(navigateFn);
      return;
    }

    // 场景2：有图片但没图纸，直接跳转并清空图片缓存
    if (!hasGridData && hasAnyImage) {
      runTransition(() => {
        clearImages();
        useConfigStore.setState({ pixelImageUrl: null });
        navigateFn();
      });
      return;
    }

    // 场景3：有图纸
    // 3a: normal/pixel → draw：带着图纸进入绘制模式，不需要弹窗
    if (hasGridData && (mode === 'normal' || mode === 'pixel') && targetMode === 'draw') {
      runTransition(navigateFn);
      return;
    }

    // 3b: 其他有图纸的切换，需要弹窗确认（不立即转场，等确认后再转场）
    setModeSwitchConfirm({ open: true, targetMode });
  }, [mode, gridData, previewImage, selectedFile, processedImage, isSimple, navigate, pixelIconClass]);

  const confirmModeSwitch = useCallback(() => {
    const basePath = isSimple ? '/simple' : '/full';
    const targetMode = modeSwitchConfirm.targetMode;
    const color = DEFAULT_COLORS[targetMode as 'normal' | 'pixel' | 'draw'] || 'var(--theme-normal)';
    const icon = getTransitionIcon(targetMode);

    const centerEl = document.createElement('div');
    centerEl.style.cssText = `position:fixed;top:50%;left:50%;width:1px;height:1px;`;
    document.body.appendChild(centerEl);

    triggerViewTransition(() => {
      setGridData([], []);
      clearImages();
      useConfigStore.setState({ pixelImageUrl: null });
      navigate(`/${basePath}/${targetMode}`, { replace: true });
      setModeSwitchConfirm({ open: false, targetMode: '' });
    }, { color, icon, originEl: centerEl });

    setTimeout(() => centerEl.remove(), 1600);
  }, [modeSwitchConfirm.targetMode, isSimple, navigate, setGridData, clearImages]);

  // 初始化引擎
  useEffect(() => {
    setEngine(new PerlerEngine(colorMappingData, colorMode));
  }, [colorMode]);



  const handleImageSelect = useCallback(
    (file: File, dataUrl: string) => {
      onImageSelectRaw(file, dataUrl);
      setError(null);
    },
    [onImageSelectRaw, setError]
  );

  const handleBgRemoved = useCallback(
    (blobUrl: string) => {
      onBgRemovedRaw(blobUrl);
    },
    [onBgRemovedRaw]
  );

  const handleClearImage = useCallback(() => {
    clearImages();
    setGridData([], []);
    setShowClearConfirm(false);
  }, [clearImages, setGridData]);

  const showImage = processedImage || previewImage;

  return (
    <TooltipProvider>
    <div className="h-screen flex flex-col overflow-hidden">
      {/* 全局顶部导航栏 */}
      <ModeTabs isSimple={isSimple} onModeChange={handleModeChange} />

      {/* 主体内容 */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 左侧栏 */}
        <aside
          className="bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] overflow-x-hidden z-20 shrink-0"
          style={{
            width: mode === 'draw' ? 48 : 320,
            minWidth: mode === 'draw' ? 48 : 320,
            overflowY: mode === 'draw' ? 'hidden' : 'auto',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {mode === 'draw' ? (
            <DrawToolBar />
          ) : (
            <div className="flex flex-col">
              {mode === 'normal' ? (
                <>
                  {/* 图片上传/预览区 */}
                  <div className="px-5 py-4 border-b border-[var(--border-default)]">
                    {!showImage ? (
                      <ImageUploader onImageSelect={handleImageSelect} />
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        <div
                          className="rounded-xl overflow-hidden border border-[var(--border-default)] flex items-center justify-center"
                          style={{ background: 'repeating-linear-gradient(45deg, #ddd, #ddd 4px, #fff 4px, #fff 8px)' }}
                        >
                          <img
                            src={showImage}
                            alt="预览"
                            className="block max-w-full max-h-[140px]"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          block
                          color="coral"
                          onClick={() => setShowClearConfirm(true)}
                        >
                          <Trash2 className="w-4 h-4" />
                          清除图片
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Tab 切换区 */}
                  {showImage && (
                    <div className="pt-3 px-5 flex-1 flex flex-col">
                      <div className="flex border-b-2 border-[var(--border-subtle)] mb-3">
                        <button
                          type="button"
                          onClick={() => setActiveTab('removeBg')}
                          className="flex-1 py-2 text-[13px] font-semibold bg-transparent border-none cursor-pointer"
                          style={{
                            color: activeTab === 'removeBg' ? theme.main : 'var(--text-muted)',
                            borderBottom: activeTab === 'removeBg' ? `2px solid ${theme.main}` : '2px solid transparent',
                            marginBottom: -2,
                            transition: 'all 0.2s',
                          }}
                        >
                          背景消除
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('generate')}
                          className="flex-1 py-2 text-[13px] font-semibold bg-transparent border-none cursor-pointer"
                          style={{
                            color: activeTab === 'generate' ? theme.main : 'var(--text-muted)',
                            borderBottom: activeTab === 'generate' ? `2px solid ${theme.main}` : '2px solid transparent',
                            marginBottom: -2,
                            transition: 'all 0.2s',
                          }}
                        >
                          图片转图纸
                        </button>
                      </div>

                      {activeTab === 'removeBg' && (
                        <div className="flex flex-col gap-3">
                          <BgRemovePanel backendAvailable={backendAvailable} />
                          <RemoveBgButton imageFile={selectedFile} onBgRemoved={handleBgRemoved} backendAvailable={backendAvailable} />
                        </div>
                      )}

                      {activeTab === 'generate' && (
                        <div className="flex flex-col gap-3">
                          <ParamPanel isSimple={isSimple} />
                          <Button
                            variant="primary"
                            block
                            loading={isGenerating}
                            disabled={!engine || !previewImage}
                            onClick={handleGenerate}
                            style={{ background: theme.main, borderColor: theme.light5, boxShadow: `0 2px 8px ${theme.main}40` }}
                          >
                            {isGenerating ? (
                              <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
                            ) : (
                              <><Wand2 className="w-4 h-4" />生成拼豆图案</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 清除图片二次确认弹窗 */}
                  <Modal
                    open={showClearConfirm}
                    onClose={() => setShowClearConfirm(false)}
                    title="确认清除图片"
                    footer={
                      <>
                        <Button variant="ghost" onClick={() => setShowClearConfirm(false)}>
                          取消
                        </Button>
                        <Button variant="primary" color="coral" onClick={handleClearImage}>
                          确认清除
                        </Button>
                      </>
                    }
                  >
                    <p className="text-sm text-[var(--text-body)]">
                      清除后图片预览和已生成的图纸都会被重置，是否继续？
                    </p>
                  </Modal>
                </>
              ) : (
                <>
                  <PixelPanel backendAvailable={backendAvailable} />
                </>
              )}
            </div>
          )}
        </aside>



        {/* 画布区域 */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-[var(--bg-base)]">
          {/* 错误提示 */}
          {error && (
            <div className="bg-[rgba(252,77,80,0.06)] border border-[var(--border-default)] text-[var(--color-danger)] px-5 py-3 text-sm z-10">
              {error}
            </div>
          )}

          {/* Loading */}
          {isGenerating && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-[100] bg-[var(--bg-surface)] px-[50px] py-10 rounded-xl"
              style={{
                backdropFilter: 'blur(10px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              <Skeleton className="h-12 w-12 rounded-full" style={{ background: theme.light5 }} />
              <p className="mt-4 text-sm text-[var(--text-body)] font-medium">
                处理中，请稍候...
              </p>
            </div>
          )}

          {/* Toolbar — 绝对定位覆盖在 Canvas 容器上方，backdrop-filter 才能采样到下方滚动的内容 */}
          <div className="absolute top-0 left-0 right-0 z-[30]">
            <Toolbar
              backendAvailable={backendAvailable}
              variant={variant}
              onSwitchMode={() => navigate(isSimple ? `/full/${mode}` : `/simple/${mode}`)}
            />
          </div>

          {/* Canvas 容器 — 内容从顶部开始，Toolbar 用 z-index 浮在上方 */}
          <div className="flex-1 overflow-auto relative">
            <div className="absolute inset-0 overflow-hidden">
              <ModeBackground mode={mode} />
            </div>
            <CanvasEditor onImageSelect={handleImageSelect} />
          </div>

          {/* 悬浮缩放 */}
          {gridData && mode !== 'draw' && <FloatingZoom />}

          {/* 图例区（draw 模式下隐藏） */}
          {mode !== 'draw' && <LegendBar />}
        </main>

        {/* 右侧栏 */}
        {mode === 'draw' ? (
          <aside
            className="p-3 gap-3 flex flex-col w-[280px] min-w-[280px] overflow-y-auto overflow-x-hidden flex-shrink-0 z-20 bg-[var(--bg-surface)] border-l border-[var(--border-subtle)]"
          >
            {gridData && <div className="nook-panel"><EditPanel colorMapping={colorMappingData} /></div>}
            <div className="nook-panel"><LayerPanel /></div>
          </aside>
        ) : gridData ? (
          <aside
            className="p-3 flex flex-col w-[200px] min-w-[200px] overflow-y-auto overflow-x-hidden flex-shrink-0 z-20 bg-[var(--bg-surface)] border-l border-[var(--border-subtle)]"
          >
            <div className="nook-panel">
              <div className="px-4 py-3 flex flex-col gap-3">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1 h-3 rounded-full" style={{ background: theme.main }} />
                  自由绘制
                </div>
                <p className="text-xs text-[var(--text-body)] leading-relaxed">
                  进入自由绘制模式，可对图案进行手动编辑、颜色填充、魔法棒选区等操作。
                </p>
                <button
                  className="nook-btn nook-btn-primary text-xs justify-center"
                  style={{ background: theme.main, borderColor: theme.light5 }}
                  onClick={() => {
                    const basePath = isSimple ? '/simple' : '/full';
                    navigate(`${basePath}/draw`);
                  }}
                >
                  进入编辑
                </button>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {/* 模式切换确认弹窗 */}
      <Modal
        open={modeSwitchConfirm.open}
        onClose={() => setModeSwitchConfirm({ open: false, targetMode: '' })}
        title="确认切换模式"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModeSwitchConfirm({ open: false, targetMode: '' })}>
              取消
            </Button>
            <Button variant="primary" color="coral" onClick={confirmModeSwitch}>
              确认切换
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--text-body)]">
          {mode === 'draw'
            ? '切换后将清空当前绘制内容，此操作不可撤销，是否继续？'
            : '直接切换会清空当前图纸，如需编辑请前往绘制模式。确认后图纸将被清空，是否继续？'}
        </p>
      </Modal>
    </div>
    </TooltipProvider>
  );
}

export default App;
