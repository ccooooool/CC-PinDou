import { useState, useEffect } from 'react';

import { useConfigStore } from '../store/usePerlerStore';

import { Switch } from '@/components/ui';

import { Select } from './ui/select';

import { Slider } from './ui/slider';

import { Settings, Grid3X3, Palette } from 'lucide-react';



const BRANDS = ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'] as const;



interface ParamPanelProps {

  backendAvailable?: boolean;

}



export function ParamPanel({ backendAvailable = true }: ParamPanelProps) {

  const {

    gridSize,

    colorMode,

    canvasConfig,

    brand,

    updateCanvasConfig,

    setGridSize,

    setColorMode,

    setBrand,

    removeBg,

    setRemoveBg,

    bgModel,

    setBgModel,

    colorSimplify,

    setColorSimplify,

    enhanceLines,

    setEnhanceLines,

    removeBgThreshold,

    setRemoveBgThreshold,

  } = useConfigStore();





  const [models, setModels] = useState<{ name: string; label: string; desc?: string }[]>([]);



  useEffect(() => {

    if (!backendAvailable) {

      setModels([{ name: 'u2net', label: 'U2-Net 通用' }]);

      return;

    }

    fetch('/api/models')

      .then((r) => r.json())

      .then((data) => {

        if (data.models?.length) {

          setModels(data.models);

        } else {

          setModels([{ name: 'u2net', label: 'U2-Net 通用' }]);

        }

      })

      .catch(() => setModels([{ name: 'u2net', label: 'U2-Net 通用' }]));

  }, [backendAvailable]);



  return (

    <div className="dop-panel flex flex-col">

      {/* 参数设置卡片 */}

      <div className="px-4 py-3 border-b border-[rgba(255,107,157,0.08)] last:border-b-0">

        <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-2">

          <Settings className="w-3.5 h-3.5" />

          参数设置

        </div>

        <div className="flex flex-col gap-3.5">

          {/* 豆板大小 */}

          <div className="flex items-center gap-2.5">

            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0 flex items-center gap-1">

              <Grid3X3 className="w-3.5 h-3.5" />

              豆板大小

            </label>

            <div className="flex-1 flex items-center gap-2.5">

              <Slider

                value={[gridSize]}

                onValueChange={([v]) => setGridSize(v)}

                min={8}

                max={128}

                step={1}

                className="w-full"

              />

              <input className="dop-input w-16 text-center px-1" value={String(gridSize)} onChange={(e) => setGridSize(Number(e.target.value))} />

            </div>

          </div>



          {/* 移除背景 */}

          <div className="flex items-center gap-2.5">

            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">移除背景</label>

            <div className="flex-1">

              <Switch checked={removeBg} onChange={(v) => setRemoveBg(v)} />

            </div>

          </div>



          {/* 分割模型 */}

          {removeBg && (

            <div className="flex items-center gap-2.5">

              <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">分割模型</label>

              <div className="flex-1">

                <Select

                  value={bgModel}

                  options={models.map((m) => ({ key: m.name, label: m.label }))}

                  onChange={(val) => setBgModel(val)}

                />

              </div>

            </div>

          )}



          {/* 颜色简化?*/}

          <div className="flex items-center gap-2.5">

            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">颜色简化?</label>

            <div className="flex-1 flex items-center gap-2.5">

              <Slider

                value={[colorSimplify]}

                onValueChange={([v]) => setColorSimplify(v)}

                min={0}

                max={100}

                step={1}

                className="w-full"

              />

              <input className="dop-input w-16 text-center px-1" value={String(colorSimplify)} onChange={(e) => setColorSimplify(Number(e.target.value))} />

            </div>

          </div>



          {/* 线条增强 */}

          <div className="flex items-center gap-2.5">

            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">线条增强</label>

            <div className="flex-1 flex items-center gap-2.5">

              <Slider

                value={[enhanceLines]}

                onValueChange={([v]) => setEnhanceLines(v)}

                min={0}

                max={10}

                step={1}

                className="w-full"

              />

              <input className="dop-input w-16 text-center px-1" value={String(enhanceLines)} onChange={(e) => setEnhanceLines(Number(e.target.value))} />

            </div>

          </div>



          {/* 背景阈值?*/}

          <div className="flex items-center gap-2.5">

            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">背景阈值?</label>

            <div className="flex-1 flex items-center gap-2.5">

              <Slider

                value={[removeBgThreshold]}

                onValueChange={([v]) => setRemoveBgThreshold(v)}

                min={10}

                max={100}

                step={1}

                className="w-full"

              />

              <input className="dop-input w-16 text-center px-1" value={String(removeBgThreshold)} onChange={(e) => setRemoveBgThreshold(Number(e.target.value))} />

            </div>

          </div>



          {/* 品牌 */}

          <div className="flex items-center gap-2.5">

            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0 flex items-center gap-1">

              <Palette className="w-3.5 h-3.5" />

              品牌

            </label>

            <div className="flex-1">

              <Select

                value={brand}

                options={BRANDS.map((b) => ({ key: b, label: b }))}

                onChange={(val) => setBrand(val as typeof brand)}

              />

            </div>

          </div>



          {/* 颜色模式 */}

          <div className="flex items-center gap-2.5">

            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">色数</label>

            <div className="flex-1">

              <div className="flex gap-2">

                <button type="button" className={`dop-btn text-xs flex-1 justify-center py-1 ${colorMode === 'full' ? 'dop-btn-primary' : 'dop-btn-secondary'}`} onClick={() => setColorMode('full')}>
                  291色
                </button>
                <button type="button" className={`dop-btn text-xs flex-1 justify-center py-1 ${colorMode === '221' ? 'dop-btn-primary' : 'dop-btn-secondary'}`} onClick={() => setColorMode('221')}>
                  221色
                </button>

              </div>

            </div>

          </div>




        </div>

      </div>

    </div>

  );

}

