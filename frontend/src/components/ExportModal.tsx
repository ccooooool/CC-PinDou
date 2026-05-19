import { useState } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import { Modal, Input, Switch } from '@/components/ui';
import { Download, AlertCircle, Loader2 } from 'lucide-react';
import { exportImageFrontend } from '../engine/frontendAlgorithms';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendAvailable: boolean;
}

export function ExportModal({ isOpen, onClose, backendAvailable }: ExportModalProps) {
  const { gridData, colorList } = useEditorStore();
  const { brand, canvasConfig } = useConfigStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [fileName, setFileName] = useState('拼豆图纸');
  const [format, setFormat] = useState<'png' | 'jpg'>('png');
  const [showCode, setShowCode] = useState(canvasConfig.showCode);
  const [showLegend, setShowLegend] = useState(true);
  const [circleMode, setCircleMode] = useState(canvasConfig.circleMode);
  const [showMarkLines, setShowMarkLines] = useState(canvasConfig.showMarkLines);
  const [markInterval, setMarkInterval] = useState(canvasConfig.markInterval);
  const safeMarkInterval = Math.max(1, markInterval || 1);

  const handleExport = async () => {
    if (!gridData || !colorList.length) return;

    setIsExporting(true);
    setExportError(null);

    try {
      let blob: Blob;

      if (backendAvailable) {
        const payload = {
          grid_data: gridData,
          color_list: colorList,
          brand,
          show_code: showCode,
          show_legend: showLegend,
          circle_mode: circleMode,
          show_mark_lines: showMarkLines,
          mark_interval: safeMarkInterval,
          format,
        };

        const response = await fetch('/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || '导出失败');
        }

        blob = await response.blob();
      } else {
        // 前端降级：Canvas 导出
        blob = await exportImageFrontend(gridData, colorList, brand, {
          fileName,
          format,
          showCode,
          showLegend,
          circleMode,
          showMarkLines,
          markInterval,
        });
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err: unknown) {
      setExportError((err instanceof Error ? err.message : String(err)) || '导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      title="导出图纸"
      onClose={onClose}
      footer={
        <>
          <button className="nook-btn nook-btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="nook-btn nook-btn-primary"
            disabled={isExporting || !gridData}
            onClick={handleExport}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            导出
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">文件名</label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            allowClear
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">格式</label>
          <div className="flex gap-2">
            <button
              className={`nook-btn flex-1 ${format === 'png' ? 'nook-btn-primary' : 'nook-btn-secondary'}`}
              onClick={() => setFormat('png')}
            >
              PNG
            </button>
            <button
              className={`nook-btn flex-1 ${format === 'jpg' ? 'nook-btn-primary' : 'nook-btn-secondary'}`}
              onClick={() => setFormat('jpg')}
            >
              JPG
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="nook-label">选项</label>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
            <span className="text-[13px] font-medium text-[var(--text-main)]">显示色号</span>
            <Switch checked={showCode} onChange={(v) => setShowCode(v)} />
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
            <span className="text-[13px] font-medium text-[var(--text-main)]">显示图例</span>
            <Switch checked={showLegend} onChange={(v) => setShowLegend(v)} />
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
            <span className="text-[13px] font-medium text-[var(--text-main)]">圆形珠子</span>
            <Switch checked={circleMode} onChange={(v) => setCircleMode(v)} />
          </div>
          <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
            <span className="text-[13px] font-medium text-[var(--text-main)]">标识线</span>
            <Switch checked={showMarkLines} onChange={(v) => setShowMarkLines(v)} />
          </div>
          {showMarkLines && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--theme-draw-light-9)]">
              <span className="text-xs font-medium text-[var(--theme-draw)]">间隔</span>
              <input
                type="number"
                className="nook-input w-[60px] text-center text-xs py-1"
                value={String(markInterval)}
                onChange={(e) => setMarkInterval(Math.max(1, Number(e.target.value) || 1))}
                min={1}
              />
              <span className="text-[10px] text-[var(--text-muted)]">格</span>
            </div>
          )}
        </div>

        {!backendAvailable && (
          <div className="nook-panel flex items-center gap-2 text-xs text-[var(--text-caption)] px-3 py-2 bg-[var(--bg-surface-alt)]">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            后端不可用，使用前端降级导出（质量可能略有差异）
          </div>
        )}

        {exportError && (
          <div className="nook-panel text-[13px] text-[var(--color-danger)] px-3 py-2 bg-[rgba(252,77,80,0.06)]">
            {exportError}
          </div>
        )}
      </div>
    </Modal>
  );
}
