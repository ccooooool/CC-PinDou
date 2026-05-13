import { useState } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';
import { useConfigStore } from '../store/useConfigStore';
import { getModeTheme } from '../utils/theme';
import { Switch } from '@/components/ui';
import { Select } from './ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  Grid3X3,
  Circle,
  Search,
  AlertTriangle,
  Merge,
  X,
} from 'lucide-react';
import { Slider } from './ui/slider';

const BRANDS = ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'] as const;

export function SettingsPanel() {
  const [showChecks, setShowChecks] = useState(false);
  const { brand, setBrand, canvasConfig, updateCanvasConfig } = useConfigStore();
  const {
    detectIsolatedPixels,
    mergeIsolatedPixels,
    detectUnstableStructures,
    clearQualityChecks,
    isolatedCells,
    unstableCells,
  } = useEditorStore();
  const { mode } = useUIStore();
  const theme = getModeTheme(mode);

  const { showCode, showMarkLines, markInterval, circleMode } = canvasConfig;

  return (
    <div className="nook-panel flex flex-col">
      <div className="px-4 py-3 flex flex-col gap-3.5">
        {/* 品牌 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[var(--text-muted)]">品牌</label>
          <Select
            value={brand}
            options={BRANDS.map((b) => ({ key: b, label: b }))}
            onChange={(val) => setBrand(val as typeof brand)}
          />
        </div>

        {/* 显示色号 */}
        <div className="flex items-center gap-2.5">
          <Switch checked={showCode} onChange={(v) => updateCanvasConfig({ showCode: v })} />
          <span className="text-xs font-bold text-[var(--text-muted)]">显示色号</span>
        </div>

        {/* 标识线 */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => updateCanvasConfig({ showMarkLines: !showMarkLines })}
            className={`nook-btn text-xs justify-center ${showMarkLines ? 'nook-btn-primary' : 'nook-btn-secondary'}`}
          >
            <Grid3X3 className="w-3 h-3" />
            标识线
          </button>
          {showMarkLines && (
            <Slider
              value={[markInterval]}
              onValueChange={([v]) => updateCanvasConfig({ markInterval: v })}
              min={2}
              max={20}
              step={1}
              className="w-full"
              themeColor={theme.main}
            />
          )}
        </div>

        {/* 圆形 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateCanvasConfig({ circleMode: !circleMode })}
            className={`nook-btn text-xs flex-1 justify-center ${circleMode ? 'nook-btn-primary' : 'nook-btn-secondary'}`}
          >
            <Circle className="w-3 h-3" />
            圆形
          </button>
        </div>

        {/* 质量检查 */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowChecks(!showChecks)}
            className={`nook-btn text-xs justify-center ${showChecks ? 'nook-btn-primary' : 'nook-btn-secondary'}`}
          >
            <Search className="w-3.5 h-3.5" />
            检查
          </button>
          {showChecks && (
            <div className="flex flex-wrap gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={detectIsolatedPixels}
                    className={`nook-badge ${isolatedCells.length > 0 ? '!border-[var(--color-danger)] !bg-[rgba(252,77,80,0.08)] !text-[var(--color-danger)]' : ''}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    孤立{isolatedCells.length > 0 ? `(${isolatedCells.length})` : ''}
                  </button>
                </TooltipTrigger>
                <TooltipContent>检测孤立像素</TooltipContent>
              </Tooltip>
              {isolatedCells.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={mergeIsolatedPixels}
                      className="nook-badge !border-[var(--color-danger)] !bg-[rgba(252,77,80,0.08)] !text-[var(--color-danger)]"
                    >
                      <Merge className="w-3.5 h-3.5" />
                      合并
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>合并孤立像素到最近颜色</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={detectUnstableStructures}
                    className={`nook-badge ${unstableCells.length > 0 ? '!border-[var(--color-accent)] !bg-[rgba(255,207,1,0.08)] !text-[var(--color-accent)]' : ''}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    结构{unstableCells.length > 0 ? `(${unstableCells.length})` : ''}
                  </button>
                </TooltipTrigger>
                <TooltipContent>检测细长不稳定结构</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={clearQualityChecks} className="nook-badge">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>清除所有标记</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
