import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

import { WelcomeScreen } from './components/WelcomeScreen';
import { LegendBar } from './components/LegendBar';
import { FloatingZoom } from './components/FloatingZoom';
import { EditPanel } from './components/EditPanel';
import { PerlerEngine } from './engine/PerlerEngine';
import { useEditorStore, useUIStore, useConfigStore } from './store/usePerlerStore';
import type { ColorMapping, GridCell, ColorInfo } from './types/perler';
import { simplifyColorsFrontend, enhanceLinesFrontend } from './engine/frontendAlgorithms';
import { TooltipProvider } from './components/ui/tooltip';
import { Loader2, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBackendHealth } from './hooks/useBackendHealth';
import { Skeleton } from './components/ui/skeleton';
import colorMappingJson from './data/colorSystemMapping.json';

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

interface AppProps {
  variant?: 'simple' | 'full';
}

function App({ variant = 'full' }: AppProps) {
  const isSimple = variant === 'simple';
  const [colorMapping] = useState<ColorMapping | null>(colorMappingData);
  const [engine, setEngine] = useState<PerlerEngine | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // simple 模式下不检测后端，强制不可用；full 模式下正常检测
  const health = useBackendHealth(!isSimple);
  const backendAvailable = isSimple ? false : health.available;

  const { setGridData } = useEditorStore();
  const gridData = useEditorStore((s) => s.gridData);
  const { showWelcome, leftPanelCollapsed, toggleLeftPanel, mode } = useUIStore();
  const { colorMode, gridSize, colorSimplify, enhanceLines } = useConfigStore();

  // 初始化引擎
  useEffect(() => {
    setEngine(new PerlerEngine(colorMappingData, colorMode));
  }, [colorMode]);



  const handleImageSelect = useCallback(
    (file: File, dataUrl: string) => {
      setPreviewImage(dataUrl);
      setSelectedFile(file);
      setProcessedImage(null);
      setError(null);
    },
    []
  );

  const handleBgRemoved = useCallback((blobUrl: string) => {
    setProcessedImage(blobUrl);
    setPreviewImage(blobUrl);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!engine || !previewImage) return;

    setIsGenerating(true);
    setError(null);

    try {
      const img = new Image();
      img.src = previewImage;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败'));
      });

      const canvas = document.createElement('canvas');
      const maxSize = 800;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 前端降级：颜色简化
      if (colorSimplify > 0) {
        imageData = simplifyColorsFrontend(imageData, colorSimplify);
      }
      // 前端降级：线条增强
      if (enhanceLines > 0) {
        imageData = enhanceLinesFrontend(imageData, enhanceLines);
      }

      // 尝试 offload 到 Web Worker，失败后降级到主线程同步计算
      let mergedGrid: GridCell[][];
      let colorList: ColorInfo[];

      try {
        const result = await new Promise<{
          grid: GridCell[][];
          colorList: ColorInfo[];
        }>((resolve, reject) => {
          const worker = new Worker(
            new URL('./workers/perler.worker.ts', import.meta.url),
            { type: 'module' }
          );

          worker.onmessage = (e: MessageEvent) => {
            worker.terminate();
            const data = e.data as {
              status: 'success' | 'error';
              grid?: GridCell[][];
              colorList?: ColorInfo[];
              error?: string;
            };
            if (data.status === 'success' && data.grid && data.colorList) {
              resolve({ grid: data.grid, colorList: data.colorList });
            } else {
              reject(new Error(data.error || 'Worker 返回无效数据'));
            }
          };

          worker.onerror = (err) => {
            worker.terminate();
            reject(err);
          };

          worker.postMessage({
            type: 'generate',
            imageData: {
              data: imageData.data,
              width: imageData.width,
              height: imageData.height,
            },
            gridSize,
            colorMapping: colorMappingData,
            mode: colorMode,
            bfsThreshold: 25,
          });
        });
        mergedGrid = result.grid;
        colorList = result.colorList;
      } catch (workerErr) {
        console.warn('Worker 计算失败，降级到主线程:', workerErr);
        // 降级 fallback：主线程同步计算
        const { grid } = engine.generateGrid(imageData, gridSize);
        mergedGrid = engine.bfsMerge(grid, 25);

        const finalColorMap = new Map<string, ColorInfo>();
        for (const row of mergedGrid) {
          for (const cell of row) {
            if (cell.color === 'transparent') continue;
            if (!finalColorMap.has(cell.color)) {
              finalColorMap.set(cell.color, {
                hex: cell.color,
                count: 0,
                codes: { ...cell.codes },
              });
            }
            finalColorMap.get(cell.color)!.count++;
          }
        }
        colorList = Array.from(finalColorMap.values()).sort((a, b) => b.count - a.count);
      }

      setGridData(mergedGrid, colorList);
    } catch (err: any) {
      setError('生成失败: ' + (err.message || String(err)));
    } finally {
      setIsGenerating(false);
    }
  }, [engine, previewImage, gridSize, colorSimplify, enhanceLines, colorMode, setGridData]);

  const showImage = processedImage || previewImage;

  return (
    <TooltipProvider>
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 主体内容 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* 左侧栏 */}
        <aside
          className="bg-transparent"
          style={{
            width: mode === 'draw' ? 48 : (leftPanelCollapsed ? 0 : 320),
            minWidth: mode === 'draw' ? 48 : (leftPanelCollapsed ? 0 : 320),
            borderRight: '1px solid var(--ai-border)',
            overflowY: mode === 'draw' ? 'hidden' : 'auto',
            overflowX: 'hidden',
            zIndex: 20,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
          }}
        >
          {mode === 'draw' ? (
            <DrawToolBar />
          ) : !leftPanelCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* 标题区 */}
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--ai-border)' }}>
                <h1
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--ai-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    letterSpacing: -0.3,
                    margin: 0,
                  }}
                >
                  <Wand2 style={{ width: 20, height: 20 }} />
                  拼豆图案生成器
                </h1>
                {isSimple && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: 'var(--dop-coral)',
                      background: 'var(--ai-primary-light)',
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontWeight: 600,
                      marginTop: 6,
                    }}
                  >
                    离线模式
                  </span>
                )}
              </div>

              {mode === 'normal' ? (
                <>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--ai-border)' }}>
                    <ImageUploader onImageSelect={handleImageSelect} />
                    {showImage && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div
                          style={{
                            borderRadius: 12,
                            overflow: 'hidden',
                            border: '1px solid var(--ai-border)',
                            display: 'inline-block',
                          }}
                        >
                          <img
                            src={showImage}
                            alt="预览"
                            style={{ display: 'block', maxWidth: '100%', maxHeight: 140 }}
                          />
                        </div>
                        <RemoveBgButton imageFile={selectedFile} onBgRemoved={handleBgRemoved} backendAvailable={backendAvailable} />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--ai-border)' }}>
                    <Button variant="primary" block loading={isGenerating} disabled={!engine || !previewImage} onClick={handleGenerate}>
                      {isGenerating ? (
                        <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />生成中...</>
                      ) : (
                        <><Wand2 style={{ width: 16, height: 16 }} />生成拼豆图案</>
                      )}
                    </Button>
                  </div>
                  <ParamPanel backendAvailable={backendAvailable} />
                </>
              ) : (
                <>
                  <PixelPanel backendAvailable={backendAvailable} />
                </>
              )}
            </div>
          )}
        </aside>

        {/* 折叠按钮（仅非 draw 模式） */}
        {mode !== 'draw' && (
          <button
            onClick={toggleLeftPanel}
            style={{
              position: 'absolute',
              top: 44,
              left: leftPanelCollapsed ? 12 : 308,
              width: 28,
              height: 28,
              background: '#fff',
              border: '1px solid var(--ai-border)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.25s',
              zIndex: 25,
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              color: 'var(--ai-text-secondary)',
              fontSize: 12,
              padding: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--ai-primary-light)';
              e.currentTarget.style.color = 'var(--ai-primary)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.color = 'var(--ai-text-secondary)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {leftPanelCollapsed ? (
              <ChevronRight style={{ width: 14, height: 14 }} />
            ) : (
              <ChevronLeft style={{ width: 14, height: 14 }} />
            )}
          </button>
        )}

        {/* 画布区域 */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--bg-base)',
          }}
        >
          {/* 模式切换栏 */}
          <ModeTabs />

          {/* 顶部工具栏 */}
          {gridData && (
            <Toolbar
              backendAvailable={backendAvailable}
              variant={variant}
              onSwitchMode={() => navigate(isSimple ? '/full' : '/simple')}
            />
          )}

          {/* 错误提示 */}
          {error && (
            <div
              style={{
                background: 'rgba(255,71,87,0.06)',
                border: '1px solid rgba(255,71,87,0.2)',
                color: 'var(--ai-danger)',
                padding: '12px 20px',
                fontSize: 14,
                zIndex: 10,
              }}
            >
              {error}
            </div>
          )}

          {/* 欢迎弹窗 */}
          {showWelcome && <WelcomeScreen />}

          {/* Loading */}
          {isGenerating && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                zIndex: 100,
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                padding: '40px 50px',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              <Skeleton className="h-12 w-12 rounded-full" />
              <p style={{ marginTop: 16, color: 'var(--ai-text-secondary)', fontSize: 14, fontWeight: 500 }}>
                处理中，请稍候...
              </p>
            </div>
          )}

          {/* Canvas */}
          {!showWelcome && (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, minHeight: 0, overflow: 'auto' }}>
                <CanvasEditor />
              </div>

              {/* 悬浮缩放 */}
              {gridData && mode !== 'draw' && <FloatingZoom />}

              {/* 图例区（draw 模式下隐藏） */}
              {mode !== 'draw' && <LegendBar />}
            </>
          )}
        </main>

        {/* 右侧栏（仅 draw 模式） */}
        {mode === 'draw' && (
          <aside
            className="p-3 gap-3 flex flex-col w-[280px] min-w-[280px] overflow-y-auto overflow-x-hidden flex-shrink-0 z-20"
          >
            {gridData && <div className="dop-panel"><EditPanel colorMapping={colorMapping} /></div>}
            <div className="dop-panel"><LayerPanel /></div>
          </aside>
        )}
      </div>


    </div>
    </TooltipProvider>
  );
}

export default App;
