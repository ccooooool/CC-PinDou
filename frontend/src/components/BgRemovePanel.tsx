import { useState, useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { getModeTheme } from '../utils/theme';
import { FormSlider } from '@/components/ui';
import { Select } from './ui/select';

export function BgRemovePanel() {
  const theme = getModeTheme('normal');
  const {
    bgModel,
    setBgModel,
    removeBgThreshold,
    setRemoveBgThreshold,
  } = useConfigStore();

  const [models] = useState<{ name: string; label: string; desc?: string }[]>([
    { name: 'frontend', label: '前端算法' }
  ]);

  // 当模型列表加载完成或 bgModel 变化时，同步为第一个可用选项
  useEffect(() => {
    if (models.length > 0 && !models.some((m) => m.name === bgModel)) {
      setBgModel(models[0].name);
    }
  }, [models, bgModel, setBgModel]);

  return (
    <div className="flex flex-col rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="px-4 py-3">
        <div className="mb-2">
          <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            参数设置
          </div>
          <div className="h-[2px] w-6 rounded-full mt-1" style={{ background: theme.main }} />
        </div>
        <div className="flex flex-col gap-3.5">
          {/* 分割模型 */}
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">分割模型</label>
            <div className="flex-1">
              <Select
                value={bgModel}
                options={models.map((m) => ({ key: m.name, label: m.label }))}
                onChange={(val) => setBgModel(val)}
                themeColor={theme.main}
              />
            </div>
          </div>

          {/* 背景阈值 */}
          <FormSlider
            label="背景阈值"
            value={removeBgThreshold}
            onChange={setRemoveBgThreshold}
            min={10}
            max={100}
            themeColor={theme.main}
          />
        </div>
      </div>
    </div>
  );
}
