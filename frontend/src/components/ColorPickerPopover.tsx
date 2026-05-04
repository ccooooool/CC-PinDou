import { useState, useMemo, useRef, useEffect } from 'react';
import { useEditorStore, useConfigStore } from '../store/usePerlerStore';
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
      <button
        ref={buttonRef}
        onClick={handleToggle}
        title="选择颜色"
        className={`dop-swatch ${open ? 'active' : ''}`}
        style={{
          backgroundColor: isTransparent ? '#fff' : selectedColor?.hex || '#E8E8F0',
        }}
      >
        {isTransparent && (
          <div
            className="w-full h-full"
            style={{
              backgroundImage: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%)',
              backgroundSize: '8px 8px',
            }}
          />
        )}
      </button>
      {/* 当前色号 */}
      <div className="text-[10px] font-medium text-[var(--text-muted)] text-center mt-1 max-w-[28px] overflow-hidden text-ellipsis whitespace-nowrap">
        {selectedColor?.codes?.[brand] || (selectedColor?.hex === 'transparent' ? '透明' : '')}
      </div>

      {/* Popover 面板 */}
      {open && (
        <div
          ref={popoverRef}
          className="dop-panel fixed flex flex-col overflow-hidden z-[100]"
          style={{
            left: panelPos.left,
            top: panelPos.top,
            width: 280,
            maxHeight: 420,
          }}
        >
          {/* 顶部全色/221色切换*/}
          <div className="flex gap-1 px-3 py-2.5 border-b border-[#f1f5f9]">
            <button
              onClick={() => setColorMode('full')}
              className={`dop-btn flex-1 ${colorMode === 'full' ? 'dop-btn-primary' : 'dop-btn-secondary'}`}
            >
              全色
            </button>
            <button
              onClick={() => setColorMode('221')}
              className={`dop-btn flex-1 ${colorMode === '221' ? 'dop-btn-primary' : 'dop-btn-secondary'}`}
            >
              221色            </button>
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
                    className={`dop-swatch ${isSelected ? 'active' : ''}`}
                    style={{ background: color.hex }}
                  />
                  <span
                    className={`text-[10px] font-medium ${
                      isSelected ? 'text-[var(--dop-pink)]' : 'text-[var(--text-caption)]'
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
