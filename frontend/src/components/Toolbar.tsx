import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditorStore, useUIStore, useConfigStore } from '../store/usePerlerStore';
import { Switch } from '@/components/ui';
import { Select } from './ui/select';
import { ExportModal } from './ExportModal';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import {
  Pencil,
  Download,
  Grid3X3,
  Circle,
  FileSpreadsheet,
  Search,
  Merge,
  AlertTriangle,
  X,
  Save,
  Clock,
  Flame,
  CloudOff,
  Cloud,
  ArrowRightLeft,
  FolderOpen,
} from 'lucide-react';
import type { ColorMapping } from '../types/perler';
import { saveAutoBackup, loadAutoBackup } from '../utils/autoSave';
import { Slider } from './ui/slider';
import colorMappingJson from '../data/colorSystemMapping.json';

const BRANDS = ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝'] as const;

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

interface ToolbarProps {
  backendAvailable: boolean;
  variant?: 'simple' | 'full';
  onSwitchMode?: () => void;
}

export function Toolbar({ backendAvailable, variant = 'full', onSwitchMode }: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { brand, setBrand, canvasConfig, updateCanvasConfig } = useConfigStore();
  const {
    colorList,
    gridData,
    layers,
    activeLayerId,
    detectIsolatedPixels,
    mergeIsolatedPixels,
    detectUnstableStructures,
    clearQualityChecks,
    isolatedCells,
    unstableCells,
    exportProject,
    importProject,
  } = useEditorStore();
  const { mode, setMode, setLastSavedAt, lastSavedAt, previewMode, setPreviewMode } = useUIStore();

  const { showCode, showMarkLines, markInterval, circleMode } = canvasConfig;

  const handleSaveProject = useCallback(() => {
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
  }, [gridData, exportProject]);

  const handleOpenProject = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const ok = importProject(data);
        if (!ok) {
          alert('无效的工程文件');
          return;
        }
        if (data.brand) useConfigStore.setState({ brand: data.brand });
        if (data.colorMode) useConfigStore.setState({ colorMode: data.colorMode });
        if (data.canvasConfig) useConfigStore.setState({ canvasConfig: data.canvasConfig });
        if (data.mode) useUIStore.setState({ mode: data.mode, showWelcome: false });
        if (data.drawTool) useUIStore.setState({ drawTool: data.drawTool });
        if (data.symmetryMode) useUIStore.setState({ symmetryMode: data.symmetryMode });
        if (data.brushSize) useUIStore.setState({ brushSize: data.brushSize });
      } catch {
        alert('文件解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importProject]);

  // 自动保存
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!gridData) return;

    autoSaveTimerRef.current = setInterval(() => {
      saveAutoBackup(mode, gridData, colorList, brand, layers, activeLayerId)
        .then(() => setLastSavedAt(Date.now()))
        .catch(() => {});
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [gridData, colorList, mode, brand, setLastSavedAt, layers, activeLayerId]);

  // 页面加载时恢复自动备份
  useEffect(() => {
    if (gridData) return; // 已有数据，不需要恢复
    loadAutoBackup().then((backup) => {
      if (backup && backup.gridData && backup.gridData.length > 0) {
        // 不自动恢复，而是显示提示让用户选择
        // 这里只更新 lastSavedAt 用于显示状态
        setLastSavedAt(backup.timestamp);
      }
    }).catch(() => {});
  }, [gridData, setLastSavedAt]);

  const handleRestore = useCallback(async () => {
    const backup = await loadAutoBackup();
    if (!backup) return;
    const ok = importProject(backup);
    if (!ok) return;
    if (backup.brand) useConfigStore.setState({ brand: backup.brand });
    if (backup.mode) useUIStore.setState({ mode: backup.mode, showWelcome: false });
  }, [importProject]);

  const buildListData = useCallback((): Array<[string, number]> => {
    if (!colorMappingData) return [];
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
  }, [brand, colorList]);

  const exportCSV = useCallback(() => {
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
  }, [buildListData]);

  const exportExcel = useCallback(async () => {
    const data = buildListData();
    if (data.length === 0) return;
    const XLSX = await import('xlsx');
    const sheetData = [['色号', '用量'], ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '拼豆清单');
    XLSX.writeFile(workbook, '@拼豆清单.xlsx');
  }, [buildListData]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap px-5 py-2.5 z-10">
        {/* 品牌选择 */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--ai-border)]">
          <span className="text-xs font-bold text-[var(--text-muted)] whitespace-nowrap">品牌</span>
          <Select value={brand} options={BRANDS.map((b) => ({ key: b, label: b }))} onChange={(val) => setBrand(val as typeof brand)} />
        </div>

        {/* 显示色号 */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--ai-border)]">
          <Switch checked={showCode} onChange={(v) => updateCanvasConfig({ showCode: v })} />
          <span className="text-xs font-bold text-[var(--text-muted)]">显示色号</span>
        </div>

        {/* 标识线 */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--ai-border)]">
          <button
            onClick={() => updateCanvasConfig({ showMarkLines: !showMarkLines })}
            className={`dop-btn text-xs ${showMarkLines ? 'dop-btn-primary' : 'dop-btn-secondary'}`}
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
              className="w-[100px]"
            />
          )}
        </div>

        {/* 圆形 */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--ai-border)]">
          <button
            onClick={() => updateCanvasConfig({ circleMode: !circleMode })}
            className={`dop-btn text-xs ${circleMode ? 'dop-btn-primary' : 'dop-btn-secondary'}`}
          >
            <Circle className="w-3 h-3" />
            圆形
          </button>
        </div>

        {/* 预览模式 */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--ai-border)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setPreviewMode(previewMode === '3d' ? 'normal' : '3d')}
                className={`dop-btn text-xs ${previewMode === '3d' ? 'dop-btn-primary' : 'dop-btn-secondary'}`}
              >
                <Flame className="w-3 h-3" />
                {previewMode === '3d' ? '3D' : '预览'}
              </button>
            </TooltipTrigger>
            <TooltipContent>{previewMode === '3d' ? '切换到普通预览' : '切换到3D预览'}</TooltipContent>
          </Tooltip>
        </div>

        {/* 质量检查 */}
        <div className="flex items-center gap-1 pr-3 border-r border-[var(--ai-border)]">
          <button
            onClick={() => setShowChecks(!showChecks)}
            className={`dop-btn text-xs ${showChecks ? 'dop-btn-primary' : 'dop-btn-secondary'}`}
          >
            <Search className="w-3.5 h-3.5" />
            检查
          </button>
          {showChecks && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={detectIsolatedPixels}
                    className={`dop-badge ${isolatedCells.length > 0 ? '!border-[var(--dop-danger)] !bg-[rgba(255,71,87,0.08)] !text-[var(--dop-danger)]' : ''}`}
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
                      className="dop-badge !border-[var(--dop-danger)] !bg-[rgba(255,71,87,0.08)] !text-[var(--dop-danger)]"
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
                    className={`dop-badge ${unstableCells.length > 0 ? '!border-[var(--dop-warning)] !bg-[rgba(255,165,2,0.08)] !text-[var(--dop-warning)]' : ''}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    结构{unstableCells.length > 0 ? `(${unstableCells.length})` : ''}
                  </button>
                </TooltipTrigger>
                <TooltipContent>检测细长不稳定结构</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={clearQualityChecks}
                    className="dop-badge"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>清除所有标记</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>

        {/* 编辑 + 导出 + 清单 + 模式切换 */}
        <div className="flex items-center gap-1.5 ml-auto">
          {variant === 'simple' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="dop-badge !border-[var(--dop-warning)] !bg-[rgba(255,165,2,0.08)] !text-[var(--dop-warning)]">
                  <CloudOff className="w-3 h-3" />
                  离线模式
                </span>
              </TooltipTrigger>
              <TooltipContent>纯前端模式，所有功能使用浏览器本地计算</TooltipContent>
            </Tooltip>
          ) : backendAvailable ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="dop-badge !border-[var(--dop-mint)] !bg-[rgba(107,203,119,0.08)] !text-[var(--dop-mint)]">
                  <Cloud className="w-3 h-3" />
                  在线
                </span>
              </TooltipTrigger>
              <TooltipContent>后端服务已连接</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="dop-badge !border-[var(--dop-warning)] !bg-[rgba(255,165,2,0.08)] !text-[var(--dop-warning)]">
                  <CloudOff className="w-3 h-3" />
                  离线
                </span>
              </TooltipTrigger>
              <TooltipContent>后端服务不可用，部分 AI 功能已降级</TooltipContent>
            </Tooltip>
          )}
          {onSwitchMode && (
            <button className="dop-btn dop-btn-secondary" onClick={onSwitchMode}>
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {variant === 'simple' ? '完整模式' : '离线模式'}
            </button>
          )}
          {mode !== 'draw' && gridData && (
            <button className="dop-btn dop-btn-secondary" onClick={() => setMode('draw')}>
              <Pencil className="w-3.5 h-3.5" />
              编辑
            </button>
          )}
          <button className="dop-btn dop-btn-primary" onClick={() => setExportOpen(true)}>
            <Download className="w-3.5 h-3.5" />
            图纸
          </button>
          <button className="dop-btn dop-btn-secondary" disabled={!colorMappingData || !gridData} onClick={exportCSV}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV
          </button>
          <button className="dop-btn dop-btn-secondary" disabled={!colorMappingData || !gridData} onClick={exportExcel}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button className="dop-btn dop-btn-secondary" disabled={!gridData} onClick={handleSaveProject}>
            <Save className="w-3.5 h-3.5" />
            保存
          </button>
          <button className="dop-btn dop-btn-secondary" onClick={handleOpenProject}>
            <FolderOpen className="w-3.5 h-3.5" />
            打开
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pindou.json,.json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {/* 自动保存状态条 */}
      {!gridData && lastSavedAt && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-[rgba(107,203,119,0.08)] border-b border-[rgba(107,203,119,0.2)] text-xs font-bold text-[var(--dop-mint)]">
          <Save className="w-3.5 h-3.5" />
          检测到自动备份（{formatTime(lastSavedAt)}）
          <button className="dop-btn dop-btn-primary" onClick={handleRestore}>
            恢复备份
          </button>
        </div>
      )}
      {gridData && lastSavedAt && (
        <div className="flex items-center justify-end gap-1.5 px-5 py-1 text-[11px] text-[var(--text-muted)]">
          <Clock className="w-3 h-3" />
          自动保存于 {formatTime(lastSavedAt)}
        </div>
      )}

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} backendAvailable={backendAvailable} />
    </>
  );
}
