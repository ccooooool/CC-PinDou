import { useState } from 'react';
import { getModeTheme } from '../utils/theme';
import { Switch, Button, Badge } from '@/components/ui';
import { Select } from './ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  Search,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { Slider } from './ui/slider';

const BRANDS = ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'] as const;

export interface SettingsConfig {
  brand: string;
  showCode: boolean;
  showMarkLines: boolean;
  markInterval: number;
  circleMode: boolean;
}

interface SettingsPanelProps {
  mode: string;
  config: SettingsConfig;
  onChange: (config: Partial<SettingsConfig>) => void;
}

export function SettingsPanel({ mode, config, onChange }: SettingsPanelProps) {
  const [showChecks, setShowChecks] = useState(false);
  const theme = getModeTheme(mode);

  const { brand, showCode, showMarkLines, markInterval, circleMode } = config;

  return (
    <div className="flex flex-col gap-4 min-w-[280px]">
      {/* 品牌 */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">拼豆品牌</label>
        <Select
          value={brand}
          options={BRANDS.map((b) => ({ key: b, label: b }))}
          onChange={(val) => onChange({ brand: val })}
          themeColor={theme.main}
        />
      </div>

      {/* 选项列表 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">显示选项</label>

        <div className="flex items-center justify-between px-3 py-2 rounded-xl transition-colors hover:bg-[var(--bg-surface-alt)]">
          <span className="text-sm font-medium text-[var(--text-main)]">显示色号</span>
          <Switch checked={showCode} onChange={(v) => onChange({ showCode: v })} themeColor={theme.main} />
        </div>

        <div className="flex items-center justify-between px-3 py-2 rounded-xl transition-colors hover:bg-[var(--bg-surface-alt)]">
          <span className="text-sm font-medium text-[var(--text-main)]">圆形珠子</span>
          <Switch checked={circleMode} onChange={(v) => onChange({ circleMode: v })} themeColor={theme.main} />
        </div>

        <div className="flex items-center justify-between px-3 py-2 rounded-xl transition-colors hover:bg-[var(--bg-surface-alt)]">
          <span className="text-sm font-medium text-[var(--text-main)]">标识线</span>
          <Switch checked={showMarkLines} onChange={(v) => onChange({ showMarkLines: v })} themeColor={theme.main} />
        </div>

        {showMarkLines && (
          <div className="px-3 py-2 rounded-lg bg-[var(--theme-draw-light-9)] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--theme-draw)]">间隔格数</span>
              <span className="text-xs font-bold text-[var(--theme-draw)] min-w-[24px] text-right">{markInterval}</span>
            </div>
            <Slider
              value={[markInterval]}
              onValueChange={([v]) => onChange({ markInterval: v })}
              min={2}
              max={20}
              step={1}
              className="w-full"
              themeColor={theme.main}
            />
          </div>
        )}
      </div>

      {/* 质量检查（仅展示按钮，实际检测在父组件触发） */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">质量检查</label>
        <Button
          size="xs"
          variant={showChecks ? 'primary' : 'secondary'}
          color="green"
          block
          onClick={() => setShowChecks(!showChecks)}
        >
          <Search className="w-3.5 h-3.5" />
          {showChecks ? '收起检查工具' : '展开检查工具'}
        </Button>
        {showChecks && (
          <div className="flex flex-wrap gap-1.5 px-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help text-xs py-0.5 px-2">
                  <AlertTriangle className="w-3 h-3" />
                  孤立像素
                </Badge>
              </TooltipTrigger>
              <TooltipContent>请在画布右键菜单中使用检测功能</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="cursor-help text-xs py-0.5 px-2">
                  <AlertTriangle className="w-3 h-3" />
                  结构不稳
                </Badge>
              </TooltipTrigger>
              <TooltipContent>请在画布右键菜单中使用检测功能</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* 提示 */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--bg-surface-alt)] text-[11px] text-[var(--text-muted)] leading-relaxed">
        <Settings2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--theme-draw)]" />
        <span>修改后点击「确认」生效，或点击「取消」放弃更改。</span>
      </div>
    </div>
  );
}
