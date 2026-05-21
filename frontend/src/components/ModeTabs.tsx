import { useParams, useNavigate } from 'react-router-dom';
import { Image, ClipboardPenLine, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getModeTheme } from '../utils/theme';
import { getPixelIcon, getPixelIconScale } from '../utils/pixelIcon';
import { triggerViewTransition } from '../utils/viewTransition';

const MODES = [
  { key: 'normal' as const, label: '转换模式', colorVar: 'var(--ac-blue)', textOnColor: 'text-white' },
  { key: 'pixel' as const, label: '像素模式', colorVar: 'var(--ac-yellow)', textOnColor: 'text-nook-brown' },
  { key: 'draw' as const, label: '绘制模式', colorVar: 'var(--ac-green)', textOnColor: 'text-white' },
];

interface ModeTabsProps {
  onModeChange?: (mode: string, e?: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ModeTabs({ onModeChange }: ModeTabsProps) {
  const navigate = useNavigate();
  const { mode: urlMode } = useParams<{ mode: string }>();
  const mode = urlMode || 'normal';
  const theme = getModeTheme(mode as 'normal' | 'pixel' | 'draw');
  const pixelIconClass = getPixelIcon();
  const pixelScale = getPixelIconScale(pixelIconClass, 16);

  const handleGoHome = (e: React.MouseEvent<HTMLDivElement>) => {
    triggerViewTransition(
      () => navigate('/'),
      {
        color: theme.main,
        icon: <Wand2 className="w-12 h-12" strokeWidth={1.5} />,
        originEl: e.currentTarget,
      }
    );
  };

  return (
    <div className="flex items-center bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shrink-0 h-14 relative">
      {/* 左侧：项目名称 */}
      <div
        className="flex items-center gap-2 absolute left-4 cursor-pointer transition-all duration-300 hover:opacity-80"
        onClick={handleGoHome}
      >
        <Wand2 className="w-5 h-5" style={{ color: theme.main }} />
        <span className="font-bold text-[var(--text-heading)] text-base tracking-tight">
          CC-PinDou
        </span>

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
                'group inline-flex items-center justify-center rounded-full font-nook font-bold text-[13px] transition-all duration-300 ease-nook overflow-hidden outline-none focus:outline-none border-[2px]',
                active
                  ? `${m.textOnColor} shadow-tabs-active h-9 max-w-[120px] px-4 border-transparent cursor-default`
                  : 'h-9 w-9 p-0 hover:max-w-[120px] hover:px-4 hover:w-auto'
              )}
              style={
                active
                  ? {
                      background: m.colorVar,
                      boxShadow: `0 4px 12px color-mix(in srgb, ${m.colorVar} 30%, transparent)`,
                    }
                  : {
                      color: m.colorVar,
                      borderColor: `color-mix(in srgb, ${m.colorVar} 35%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${m.colorVar} 10%, transparent)`,
                    }
              }
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = m.colorVar;
                  e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${m.colorVar} 18%, transparent)`;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${m.colorVar} 35%, transparent)`;
                  e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${m.colorVar} 10%, transparent)`;
                }
              }}
            >
              {m.key === 'normal' && <Image className="w-4 h-4 shrink-0" />}
              {m.key === 'pixel' && (
                <span className="relative flex items-center justify-center w-4 h-4 flex-shrink-0 overflow-hidden">
                  <i
                    className={pixelIconClass}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) scale(${pixelScale})`,
                      transformOrigin: 'center center',
                      imageRendering: 'pixelated',
                    }}
                  />
                </span>
              )}
              {m.key === 'draw' && <ClipboardPenLine className="w-4 h-4 shrink-0" />}
              <span
                className={cn(
                  'whitespace-nowrap overflow-hidden transition-all duration-300 ease-nook flex-shrink-0',
                  active
                    ? 'max-w-[80px] ml-1.5 opacity-100'
                    : 'max-w-0 ml-0 opacity-0 group-hover:max-w-[80px] group-hover:ml-1.5 group-hover:opacity-100'
                )}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
