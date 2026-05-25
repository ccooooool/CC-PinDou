import { useCallback, useRef } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';
import { useConfigStore } from '../store/useConfigStore';
import { toast } from '@/components/ui/toast';
import type { ColorMapping } from '../types/perler';
import colorMappingJson from '../data/colorSystemMapping.json';

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

export function useProjectExport() {
  const { colorList, gridData, exportProject, importProject } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildListData = useCallback((): Array<[string, number]> => {
    if (!colorMappingData) return [];
    const { brand } = useConfigStore.getState();
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
  }, [colorList]);

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
    try {
      const XLSX = await import('xlsx');
      const sheetData = [['色号', '用量'], ...data];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '拼豆清单');
      XLSX.writeFile(workbook, '@拼豆清单.xlsx');
    } catch {
      // 动态导入失败时静默处理，避免未捕获错误导致应用崩溃
    }
  }, [buildListData]);

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
          toast.error('无效的工程文件');
          return;
        }
        if (data.brand) useConfigStore.setState({ brand: data.brand });
        if (data.colorMode) useConfigStore.setState({ colorMode: data.colorMode });
        if (data.canvasConfig) useConfigStore.setState({ canvasConfig: data.canvasConfig });
        if (data.mode) useUIStore.setState({ mode: data.mode });
        if (data.drawTool) useUIStore.setState({ drawTool: data.drawTool });
        if (data.symmetryMode) useUIStore.setState({ symmetryMode: data.symmetryMode });
        if (data.brushSize) useUIStore.setState({ brushSize: data.brushSize });
        toast.success('工程文件导入成功');
      } catch {
        toast.error('文件解析失败');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importProject]);

  return {
    colorMappingData,
    buildListData,
    exportCSV,
    exportExcel,
    handleSaveProject,
    handleOpenProject,
    handleFileSelected,
    fileInputRef,
  };
}
