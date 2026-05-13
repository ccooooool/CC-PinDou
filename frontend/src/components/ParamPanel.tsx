import { useConfigStore } from '../store/useConfigStore';
import { getModeTheme } from '../utils/theme';
import { FormSlider } from '@/components/ui';
import { Select } from './ui/select';

interface ParamPanelProps {
  isSimple?: boolean;
}

export function ParamPanel({ isSimple = false }: ParamPanelProps) {
  const theme = getModeTheme('normal');
  const {
    gridSize,
    colorMode,
    setGridSize,
    setColorMode,
    colorSimplify,
    setColorSimplify,
    enhanceLines,
    setEnhanceLines,
    generateAlgorithm,
    setGenerateAlgorithm,
  } = useConfigStore();





  return (

    <div className="nook-panel flex flex-col">

      {/* 参数设置卡片 */}

      <div className="px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0">

        <div className="mb-2">
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            参数设置
          </div>
          <div className="h-[2px] w-6 rounded-full mt-1" style={{ background: theme.main }} />
        </div>

        <div className="flex flex-col gap-3.5">

          {/* 豆板大小 */}
          <FormSlider
            label="豆板大小"
            value={gridSize}
            onChange={setGridSize}
            min={8}
            max={128}
            themeColor={theme.main}
          />
          {/* 颜色简化 */}
          <FormSlider
            label="颜色简化"
            value={colorSimplify}
            onChange={setColorSimplify}
            min={0}
            max={100}
            themeColor={theme.main}
          />



          {/* 线条增强 */}
          <FormSlider
            label="线条增强"
            value={enhanceLines}
            onChange={setEnhanceLines}
            min={0}
            max={10}
            themeColor={theme.main}
          />
          {/* 颜色模式 */}
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">色数</label>
            <div className="flex-1">
              <Select
                value={colorMode}
                options={[
                  { key: 'full', label: '291色（全色）' },
                  { key: '221', label: '221色（常用）' },
                ]}
                onChange={(val) => setColorMode(val as 'full' | '221')}
              />
            </div>
          </div>

          {/* 生成算法 */}
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">生成算法</label>
            <div className="flex-1">
              <Select
                value={generateAlgorithm}
                options={
                  isSimple
                    ? [{ key: 'frontend', label: '前端算法' }]
                    : [
                        { key: 'frontend', label: '前端算法' },
                        { key: 'backend', label: '后端算法' },
                      ]
                }
                onChange={(val) => setGenerateAlgorithm(val as 'frontend' | 'backend')}
              />
            </div>
          </div>




        </div>

      </div>

    </div>

  );

}

