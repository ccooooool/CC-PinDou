import { useState } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import { useUIStore } from '../store/useUIStore';
import { getModeTheme } from '../utils/theme';
import { Modal, Input, Switch, Button } from '@/components/ui';
import { Download, FileSpreadsheet, Save, Loader2, AlertCircle, Image, Table } from 'lucide-react';
import { exportImageFrontend } from '../engine/frontendAlgorithms';
import colorMappingJson from '../data/colorSystemMapping.json';
import type { ColorMapping } from '../types/perler';

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendAvailable: boolean;
}

export function SaveModal({ isOpen, onClose, backendAvailable }: SaveModalProps) {
  const { gridData, colorList, exportProject } = useEditorStore();
  const { brand, canvasConfig } = useConfigStore();
  const mode = useUIStore((s) => s.mode);
  const theme = getModeTheme(mode);
  const [activeTab, setActiveTab] = useState<'image' | 'csv' | 'excel' | 'project'>('image');

  // 图纸导出状态
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

  const hasGrid = !!gridData && gridData.length > 0;

  // 构建清单数据
  const buildListData = (): Array<[string, number]> => {
    if (!colorMappingData || !colorList.length) return [];
    const entries: Array<[string, number]> = [];
    const brandCodes: Array<{ code: string; hex: string }> = [];
    for (const [hex, codes] of Object.entries(colorMappingData)) {
      const code = codes[brand];
      if (code) brandCodes.push({ code, hex });
    }
    brandCodes.sort((a, b) => {
      const ca = a.code.charCodeAt(0);
      const cb = b.code.charCodeAt(0);
      if (ca !== cb) return ca - cb;
      return (parseInt(a.code.slice(1), 10) || 0) - (parseInt(b.code.slice(1), 10) || 0);
    });
    const usageMap = new Map<string, number>();
    for (const c of colorList) usageMap.set(c.hex, c.count);
    for (const { code, hex } of brandCodes) {
      entries.push([code, usageMap.get(hex) || 0]);
    }
    return entries;
  };

  // 导出图纸
  const handleExportImage = async () => {
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

  // 导出 CSV
  const handleExportCSV = () => {
    const data = buildListData();
    if (data.length === 0) return;
    let csv = '\uFEFF色号,用量\n';
    for (const [code, count] of data) csv += `${code},${count}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '@拼豆清单.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onClose();
  };

  // 导出 Excel
  const handleExportExcel = async () => {
    const data = buildListData();
    if (data.length === 0) return;
    const XLSX = await import('xlsx');
    const sheetData = [['色号', '用量'], ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '拼豆清单');
    XLSX.writeFile(workbook, '@拼豆清单.xlsx');
    onClose();
  };

  // 保存工程
  const handleSaveProject = () => {
    if (!gridData) return;
    const project = exportProject();
    const uiState = useUIStore.getState();
    const configState = useConfigStore.getState();
    const fullProject = {
      ...project,
      brand: configState.brand,
      colorMode: configState.colorMode,
      mode: uiState.mode,
      canvasConfig: configState.canvasConfig,
      drawTool: uiState.drawTool,
      symmetryMode: uiState.symmetryMode,
      brushSize: uiState.brushSize,
    };
    const blob = new Blob([JSON.stringify(fullProject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `拼豆工程_${new Date().toLocaleDateString()}.pindou.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onClose();
  };

  const tabs = [
    { key: 'image' as const, label: '图纸', icon: Image },
    { key: 'csv' as const, label: 'CSV', icon: Table },
    { key: 'excel' as const, label: 'Excel', icon: FileSpreadsheet },
    { key: 'project' as const, label: '工程', icon: Save },
  ];

  return (
    <Modal
      open={isOpen}
      title="保存"
      onClose={onClose}
      width={420}
      themeColor={theme.main}
    >
      {/* Tab 切换 */}
      <div className="flex gap-1 mb-4 p-1 bg-[var(--bg-surface-alt)] rounded-xl">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setExportError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-all duration-200 rounded-lg ${
                active
                  ? 'bg-[var(--bg-surface)] text-[var(--theme-draw)] shadow-[0_1px_4px_rgba(43,180,171,0.15)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 min-h-[200px]">
        {/* 图纸导出 */}
        {activeTab === 'image' && (
          <>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">文件名</label>
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} allowClear themeColor={theme.main} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1.5">格式</label>
              <div className="flex gap-2">
                <Button className="flex-1" variant={format === 'png' ? 'primary' : 'secondary'} color="green" onClick={() => setFormat('png')}>PNG</Button>
                <Button className="flex-1" variant={format === 'jpg' ? 'primary' : 'secondary'} color="green" onClick={() => setFormat('jpg')}>JPG</Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">选项</span>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
                <span className="text-[13px] font-medium text-[var(--text-main)]">显示色号</span>
                <Switch checked={showCode} onChange={(v) => setShowCode(v)} themeColor={theme.main} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
                <span className="text-[13px] font-medium text-[var(--text-main)]">显示图例</span>
                <Switch checked={showLegend} onChange={(v) => setShowLegend(v)} themeColor={theme.main} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
                <span className="text-[13px] font-medium text-[var(--text-main)]">圆形珠子</span>
                <Switch checked={circleMode} onChange={(v) => setCircleMode(v)} themeColor={theme.main} />
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors">
                <span className="text-[13px] font-medium text-[var(--text-main)]">标识线</span>
                <Switch checked={showMarkLines} onChange={(v) => setShowMarkLines(v)} themeColor={theme.main} />
              </div>
              {showMarkLines && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--theme-draw-light-9)]">
                  <span className="text-xs font-medium text-[var(--theme-draw)]">间隔</span>
                  <Input type="number" size="xs" className="w-[60px] text-center text-xs py-1" value={String(markInterval)} onChange={(e) => setMarkInterval(Number(e.target.value))} min={1} />
                  <span className="text-[10px] text-[var(--text-muted)]">格</span>
                </div>
              )}
            </div>
            {!backendAvailable && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-caption)] px-3 py-2 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                后端不可用，使用前端降级导出（质量可能略有差异）
              </div>
            )}
            <Button variant="primary" color="green" className="w-full justify-center mt-auto" disabled={isExporting || !hasGrid} onClick={handleExportImage}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              导出图纸
            </Button>
          </>
        )}

        {/* CSV */}
        {activeTab === 'csv' && (
          <div className="flex flex-col gap-4 h-full">
            <p className="text-sm text-[var(--text-body)]">
              导出当前图纸的色号用量清单为 CSV 格式，可用 Excel 直接打开。
            </p>
            <Button variant="primary" color="green" className="w-full justify-center mt-auto" disabled={!hasGrid} onClick={handleExportCSV}>
              <Table className="w-4 h-4" />
              导出 CSV
            </Button>
          </div>
        )}

        {/* Excel */}
        {activeTab === 'excel' && (
          <div className="flex flex-col gap-4 h-full">
            <p className="text-sm text-[var(--text-body)]">
              导出当前图纸的色号用量清单为 Excel 格式。
            </p>
            <Button variant="primary" color="green" className="w-full justify-center mt-auto" disabled={!hasGrid} onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4" />
              导出 Excel
            </Button>
          </div>
        )}

        {/* 工程 */}
        {activeTab === 'project' && (
          <div className="flex flex-col gap-4 h-full">
            <p className="text-sm text-[var(--text-body)]">
              保存完整的工程文件（.pindou.json），包含图层、颜色、画布设置等，之后可以重新打开继续编辑。
            </p>
            <Button variant="primary" color="green" className="w-full justify-center mt-auto" disabled={!hasGrid} onClick={handleSaveProject}>
              <Save className="w-4 h-4" />
              保存工程
            </Button>
          </div>
        )}

        {exportError && (
          <div className="text-[13px] text-[var(--color-danger)] px-3 py-2 bg-[rgba(252,77,80,0.06)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
            {exportError}
          </div>
        )}
      </div>
    </Modal>
  );
}
