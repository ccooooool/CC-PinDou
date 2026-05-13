import { useRef, useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';

export function usePanZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
  const gridData = useEditorStore((s) => s.gridData);
  const { updateCanvasConfig } = useConfigStore();

  const [spacePressed, setSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // 滚轮缩放（以鼠标位置为锚点）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let wheelRafId: number | null = null;
    let pendingDelta = 0;
    const lastMousePos = { x: 0, y: 0 };

    const handleWheel = (e: WheelEvent) => {
      if (!gridData) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const computedStyle = getComputedStyle(container);
      const padLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const padTop = parseFloat(computedStyle.paddingTop) || 0;
      lastMousePos.x = e.clientX - rect.left - padLeft;
      lastMousePos.y = e.clientY - rect.top - padTop;

      pendingDelta += e.deltaY;
      if (wheelRafId) return;
      wheelRafId = requestAnimationFrame(() => {
        wheelRafId = null;
        // 使用 getState() 获取最新 zoomLevel，避免闭包过期
        const currentZoom = useConfigStore.getState().canvasConfig.zoomLevel;
        const delta = pendingDelta;
        pendingDelta = 0;
        const newZoom = delta < 0
          ? Math.min(currentZoom + 0.1, 10)
          : Math.max(currentZoom - 0.1, 0.05);

        const scaleRatio = newZoom / currentZoom;
        // 鼠标指向的内容在当前滚动坐标系中的位置
        const contentX = container.scrollLeft + lastMousePos.x;
        const contentY = container.scrollTop + lastMousePos.y;
        const targetScrollLeft = contentX * scaleRatio - lastMousePos.x;
        const targetScrollTop = contentY * scaleRatio - lastMousePos.y;

        // 同步调整 canvas 显示尺寸 + scroll，避免中间态闪动
        const canvas = container.querySelector('canvas') as HTMLCanvasElement | null;
        if (canvas) {
          const currentW = parseFloat(canvas.style.width) || canvas.offsetWidth;
          const currentH = parseFloat(canvas.style.height) || canvas.offsetHeight;
          canvas.style.width = (currentW * scaleRatio) + 'px';
          canvas.style.height = (currentH * scaleRatio) + 'px';
        }
        container.scrollLeft = targetScrollLeft;
        container.scrollTop = targetScrollTop;

        // 最后更新状态，后续 drawGrid 会计算相同尺寸，不产生视觉变化
        updateCanvasConfig({ zoomLevel: newZoom });
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (wheelRafId) {
        cancelAnimationFrame(wheelRafId);
        wheelRafId = null;
      }
    };
  }, [gridData, updateCanvasConfig, containerRef]);

  // Space + 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        setSpacePressed(true);
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        setIsDragging(false);
      }
    };
    const handleBlur = () => {
      setSpacePressed(false);
      setIsDragging(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const startDrag = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      setIsDragging(true);
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
    },
    [containerRef],
  );

  const onDragMove = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container || !isDragging) return;
      container.scrollLeft = dragStartRef.current.scrollLeft - (clientX - dragStartRef.current.x);
      container.scrollTop = dragStartRef.current.scrollTop - (clientY - dragStartRef.current.y);
    },
    [containerRef, isDragging],
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  return { spacePressed, isDragging, startDrag, onDragMove, stopDrag };
}
