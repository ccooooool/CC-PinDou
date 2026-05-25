import { useConfigStore } from '../store/useConfigStore';
import { getModeTheme } from '../utils/theme';
import { FormSlider } from '@/components/ui';

export function BgRemovePanel() {
  const theme = getModeTheme('normal');
  const {
    removeBgThreshold,
    setRemoveBgThreshold,
  } = useConfigStore();

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
