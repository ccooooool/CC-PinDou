import { useParams } from 'react-router-dom';
import { Image, ClipboardPenLine, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getModeTheme } from '../utils/theme';
import { getPixelIcon, getPixelIconScale } from '../utils/pixelIcon';

const MODES = [
  { key: 'normal' as const, label: '普通图片', themeVar: 'var(--theme-normal)' },
  { key: 'pixel' as const, label: '像素图', themeVar: 'var(--theme-pixel)' },
  { key: 'draw' as const, label: '自由绘制', themeVar: 'var(--theme-draw)' },
];

interface ModeTabsProps {
  isSimple?: boolean;
  onModeChange?: (mode: string, e?: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ModeTabs({ isSimple, onModeChange }: ModeTabsProps) {
  const { mode: urlMode } = useParams<{ mode: string }>();
  const mode = urlMode || 'normal';
  const theme = getModeTheme(mode as 'normal' | 'pixel' | 'draw');
  const pixelIconClass = getPixelIcon();
  const pixelScale = getPixelIconScale(pixelIconClass, 20);

  return (
    <div
      className="flex items-center bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0 h-12 relative"
    >
      {/* 左侧：项目名称 */}
      <div className="flex items-center gap-2 absolute left-4">
        <Wand2 className="w-5 h-5" style={{ color: theme.main }} />
        <span className="font-bold text-[var(--text-heading)] text-base tracking-tight">
          拼豆图案生成器
        </span>
        {isSimple && (
          <span
            className="text-[11px] font-bold rounded-full bg-[rgba(252,77,80,0.08)] px-2 py-0.5"
            style={{
              color: 'var(--color-danger)',
            }}
          >
            离线模式
          </span>
        )}
      </div>

      {/* 中间：模式导航 */}
      <div className="flex items-center justify-center gap-1 mx-auto">
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={(e) => onModeChange?.(m.key, e)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full font-nook font-bold text-[13px] transition-all duration-300 ease-nook',
                active
                  ? 'text-white shadow-md hover:-translate-y-0.5'
                  : 'text-[var(--text-body)] hover:bg-[var(--bg-surface-alt)] hover:text-[var(--text-heading)]'
              )}
              style={
                active
                  ? {
                      background: m.themeVar,
                      boxShadow: `0 2px 8px ${m.themeVar}80`,
                    }
                  : undefined
              }
            >
              {m.key === 'normal' && <Image className="w-3.5 h-3.5" />}
              {m.key === 'pixel' && (
                <span
                  style={{
                    width: 20,
                    height: 20,
                    display: 'inline-block',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0,
                    verticalAlign: 'middle',
                  }}
                >
                  <i
                    className={pixelIconClass}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      transform: `scale(${pixelScale})`,
                      transformOrigin: 'top left',
                      imageRendering: 'pixelated',
                    }}
                  />
                </span>
              )}
              {m.key === 'draw' && <ClipboardPenLine className="w-3.5 h-3.5" />}
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
