import { useState, useMemo, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { useConfigStore } from '../store/useConfigStore';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui';
import colorMappingJson from '../data/colorSystemMapping.json';
import type { ColorMapping } from '../types/perler';

const colorMappingData: ColorMapping = colorMappingJson as ColorMapping;

function parseCode(code: string): [string, number] {
  const match = code.match(/^([A-Z]+)(\d+)$/i);
  if (match) return [match[1].toUpperCase(), parseInt(match[2], 10)];
  return [code, 0];
}

function sortByCode(a: string, b: string): number {
  const [aLetters, aNum] = parseCode(a);
  const [bLetters, bNum] = parseCode(b);
  if (aLetters !== bLetters) return aLetters.localeCompare(bLetters);
  return aNum - bNum;
}

export function ColorPickerPopover() {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ left: 0, top: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { selectedColor, setSelectedColor } = useEditorStore();
  const { brand, colorMode, setColorMode } = useConfigStore();

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({ left: rect.right + 8, top: rect.top - 4 });
    }
    setOpen(!open);
  };

  const colors = useMemo(() => {
    const entries = Object.entries(colorMappingData)
      .map(([hex, codes]) => ({
        hex,
        code: codes[brand] || '',
        codes,
      }))
      .filter((c) => c.code);

    const filtered =
      colorMode === '221'
        ? entries.filter((c) => {
            const firstChar = c.code[0];
            return firstChar >= 'A' && firstChar <= 'M';
          })
        : entries;

    return filtered.sort((a, b) => sortByCode(a.code, b.code));
  }, [brand, colorMode]);

  const isTransparent = selectedColor?.hex === 'transparent';

  return (
    <div className="relative">
      {/* 颜色方块 */}
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            onClick={handleToggle}
            onContextMenu={(e) => {
              e.preventDefault();
              handleToggle();
            }}
            className="relative flex-shrink-0 overflow-hidden cursor-pointer"
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--nook-wood)',
              backgroundColor: isTransparent ? '#fff' : selectedColor?.hex || '#fff',
              transition: 'transform 0.1s, box-shadow 0.15s',
              boxShadow: open ? '0 0 0 2px var(--text-secondary)' : undefined,
            }}
          >
            {(isTransparent || !selectedColor) && (
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%)',
                  backgroundSize: '8px 8px',
                }}
              />
            )}
            <svg
              className="absolute opacity-60 pointer-events-none"
              width="5"
              height="5"
              viewBox="0 0 5 5"
              style={{
                bottom: 2,
                right: 2,
                filter: isTransparent || !selectedColor ? 'none' : 'drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.5))',
              }}
            >
              <polygon
                points="0,5 5,5 5,0"
                fill={isTransparent || !selectedColor ? 'var(--text-muted)' : '#fff'}
              />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          选择颜色工具
        </TooltipContent>
      </Tooltip>
      {/* 当前色号 */}
      <div className="text-[10px] font-medium text-[var(--text-muted)] text-center mt-1 max-w-[28px] overflow-hidden text-ellipsis whitespace-nowrap">
        {selectedColor?.codes?.[brand] || (selectedColor?.hex === 'transparent' ? '透明' : '无')}
      </div>

      {/* Popover 面板 */}
      {open && (
        <div
          ref={popoverRef}
          className="fixed flex flex-col overflow-hidden z-[100] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden"
          style={{
            left: panelPos.left,
            top: panelPos.top,
            width: 280,
            maxHeight: 420,
          }}
        >
          {/* 顶部全色/221色切换 */}
          <div className="flex gap-1 px-3 py-2.5 border-b border-[var(--border-subtle)]">
            <Button
              size="xs"
              onClick={() => setColorMode('full')}
              variant={colorMode === 'full' ? 'primary' : 'secondary'}
              color="green"
              className={`flex-1 transition-all duration-150 ${
                colorMode === 'full'
                  ? 'shadow-[0_1px_6px_rgba(43,180,171,0.25)]'
                  : ''
              }`}
            >
              全色
            </Button>
            <Button
              size="xs"
              onClick={() => setColorMode('221')}
              variant={colorMode === '221' ? 'primary' : 'secondary'}
              color="green"
              className={`flex-1 transition-all duration-150 ${
                colorMode === '221'
                  ? 'shadow-[0_1px_6px_rgba(43,180,171,0.25)]'
                  : ''
              }`}
            >
              221色
            </Button>
          </div>

          {/* 颜色网格 */}
          <div className="px-3 py-2.5 overflow-y-auto grid grid-cols-5 gap-1.5">
            {colors.map((color) => {
              const isSelected = selectedColor?.hex === color.hex;
              return (
                <button
                  key={color.hex}
                  onClick={() => {
                    setSelectedColor({ hex: color.hex, count: 0, codes: color.codes });
                    setOpen(false);
                  }}
                  title={color.code}
                  className="flex flex-col items-center gap-0.5 p-1 cursor-pointer"
                >
                  <div
                    className="relative flex-shrink-0 overflow-hidden cursor-pointer"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '2px solid var(--theme-draw)' : '1px solid var(--nook-wood)',
                      background: color.hex,
                      transition: 'transform 0.1s, box-shadow 0.15s, border-color 0.15s',
                      boxShadow: isSelected ? '0 0 0 3px var(--theme-draw-light-7), 0 2px 6px rgba(43,180,171,0.2)' : undefined,
                      transform: isSelected ? 'scale(1.08)' : undefined,
                    }}
                  />
                  <span
                    className={`text-[10px] font-medium ${
                      isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--text-caption)]'
                    }`}
                  >
                    {color.code}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
