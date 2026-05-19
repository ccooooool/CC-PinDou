import { useState, useCallback } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import { useUIStore } from '../store/useUIStore';
import { useAutoSave } from '../hooks/useAutoSave';
import { SaveModal } from './SaveModal';
import { SettingsPanel, type SettingsConfig } from './SettingsPanel';
import { Modal } from './ui/modal';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  Save,
  Settings,
  Clock,
  CloudOff,
  Cloud,
  Check,
  X,
} from 'lucide-react';

interface ToolbarProps {
  backendAvailable: boolean;
  variant?: 'simple' | 'full';
  onSwitchMode?: () => void;
}

export function Toolbar({ backendAvailable, variant = 'full', onSwitchMode }: ToolbarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { gridData } = useEditorStore();
  const { lastSavedAt, handleRestore, formatTime } = useAutoSave();

  // 配置 store
  const { brand, setBrand, canvasConfig, updateCanvasConfig } = useConfigStore();
  const { mode } = useUIStore();

  // 设置弹窗的临时状态
  const [draftConfig, setDraftConfig] = useState<SettingsConfig>({
    brand,
    showCode: canvasConfig.showCode,
    showMarkLines: canvasConfig.showMarkLines,
    markInterval: canvasConfig.markInterval,
    circleMode: canvasConfig.circleMode,
  });

  const openSettings = useCallback(() => {
    // 打开时从 store 同步最新值
    setDraftConfig({
      brand,
      showCode: canvasConfig.showCode,
      showMarkLines: canvasConfig.showMarkLines,
      markInterval: canvasConfig.markInterval,
      circleMode: canvasConfig.circleMode,
    });
    setSettingsOpen(true);
  }, [brand, canvasConfig]);

  const handleConfirmSettings = useCallback(() => {
    if (draftConfig.brand !== brand) setBrand(draftConfig.brand as typeof brand);
    updateCanvasConfig({
      showCode: draftConfig.showCode,
      showMarkLines: draftConfig.showMarkLines,
      markInterval: draftConfig.markInterval,
      circleMode: draftConfig.circleMode,
    });
    setSettingsOpen(false);
  }, [draftConfig, brand, setBrand, updateCanvasConfig]);

  const handleCancelSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 px-5 py-2 z-10 backdrop-blur-lg border-b border-[var(--border-subtle)]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.45)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px rgba(93, 64, 55, 0.06)',
        }}
      >
        {/* 左侧：自动保存状态 */}
        <div className="flex items-center gap-2 min-w-0">
          {!gridData && lastSavedAt && (
            <>
              <Save className="w-3.5 h-3.5 shrink-0 text-[var(--color-success)]" />
              <span className="text-xs font-bold text-[var(--color-success)] truncate">
                自动备份（{formatTime(lastSavedAt)}）
              </span>
              <button
                className="nook-btn nook-btn-primary text-xs py-1 px-2.5 shrink-0"
                onClick={handleRestore}
              >
                恢复
              </button>
            </>
          )}
          {gridData && lastSavedAt && (
            <>
              <Clock className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />
              <span className="text-[11px] text-[var(--text-muted)]">
                自动保存于 {formatTime(lastSavedAt)}
              </span>
            </>
          )}
        </div>

        {/* 右侧：保存 / 设置 / 模式切换 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {gridData && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="nook-btn nook-btn-icon nook-btn-primary" onClick={() => setSaveOpen(true)}>
                    <Save className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>保存（图纸 / CSV / Excel / 工程）</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="nook-btn nook-btn-icon nook-btn-secondary" onClick={openSettings}>
                    <Settings className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>设置（品牌 / 色号 / 标识线 / 预览）</TooltipContent>
              </Tooltip>
            </>
          )}
          {onSwitchMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`nook-btn nook-btn-icon ${variant === 'simple' ? 'nook-btn-secondary' : backendAvailable ? 'nook-btn-primary' : 'nook-btn-secondary'}`}
                  onClick={onSwitchMode}
                >
                  {variant === 'simple' ? <CloudOff className="w-4 h-4" /> : backendAvailable ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {variant === 'simple'
                  ? '离线模式 - 点击切换完整模式'
                  : backendAvailable
                    ? '在线 - 点击切换离线模式'
                    : '离线 - 后端不可用'}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <SaveModal isOpen={saveOpen} onClose={() => setSaveOpen(false)} backendAvailable={backendAvailable} />

      <Modal
        open={settingsOpen}
        title="设置"
        onClose={handleCancelSettings}
        width={360}
        footer={
          <>
            <button className="nook-btn nook-btn-secondary" onClick={handleCancelSettings}>
              <X className="w-3.5 h-3.5" />
              取消
            </button>
            <button className="nook-btn nook-btn-primary" onClick={handleConfirmSettings}>
              <Check className="w-3.5 h-3.5" />
              确认
            </button>
          </>
        }
      >
        <SettingsPanel
          mode={mode}
          config={draftConfig}
          onChange={(patch) => setDraftConfig((prev) => ({ ...prev, ...patch }))}
        />
      </Modal>
    </>
  );
}
