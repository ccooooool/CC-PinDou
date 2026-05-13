import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useUIStore } from '../store/useUIStore';
import { useConfigStore } from '../store/useConfigStore';
import { saveAutoBackup, loadAutoBackup } from '../utils/autoSave';

export function useAutoSave() {
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gridData = useEditorStore((s) => s.gridData);
  const colorList = useEditorStore((s) => s.colorList);
  const layers = useEditorStore((s) => s.layers);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const importProject = useEditorStore((s) => s.importProject);
  const mode = useUIStore((s) => s.mode);
  const setLastSavedAt = useUIStore((s) => s.setLastSavedAt);
  const lastSavedAt = useUIStore((s) => s.lastSavedAt);
  const brand = useConfigStore((s) => s.brand);

  // 自动保存定时器
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
    if (gridData) return;
    loadAutoBackup()
      .then((backup) => {
        if (backup && backup.gridData && backup.gridData.length > 0) {
          setLastSavedAt(backup.timestamp);
        }
      })
      .catch(() => {});
  }, [gridData, setLastSavedAt]);

  const handleRestore = useCallback(async () => {
    const backup = await loadAutoBackup();
    if (!backup) return;
    const ok = importProject(backup);
    if (!ok) return;
    if (backup.brand) useConfigStore.setState({ brand: backup.brand as typeof brand });
    if (backup.mode) useUIStore.setState({ mode: backup.mode as typeof mode });
  }, [importProject, brand, mode]);

  const formatTime = useCallback((ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }, []);

  return { lastSavedAt, handleRestore, formatTime };
}
