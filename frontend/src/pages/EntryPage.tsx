import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { triggerViewTransition } from '../utils/viewTransition';
import {
  Wand2,
  Image,
  ClipboardPenLine,
  Sparkles,
  MousePointerClick,
} from 'lucide-react';
import { getPixelIcon, getPixelIconScale } from '../utils/pixelIcon';

/* ================================================================== */
/*  类型                                                               */
/* ================================================================== */

interface ModeItem {
  key: 'normal' | 'pixel' | 'draw';
  label: string;
  desc: string;
  themeVar: string;
  bgVar: string;
  icon: React.ReactNode;
  transitionIcon: React.ReactNode;
}

/* ================================================================== */
/*  常量 & 配置                                                         */
/* ================================================================== */

const MODES: ModeItem[] = [
  {
    key: 'normal',
    label: '转换模式',
    desc: '照片一键转拼豆',
    themeVar: 'var(--theme-normal)',
    bgVar: 'var(--theme-normal-light-9)',
    icon: <Image className="w-10 h-10" strokeWidth={1.8} />,
    transitionIcon: <Image className="w-20 h-20" strokeWidth={1.5} />,
  },
  {
    key: 'pixel',
    label: '像素模式',
    desc: '像素图自动对齐',
    themeVar: 'var(--theme-pixel)',
    bgVar: 'var(--theme-pixel-light-9)',
    icon: (() => {
      const cls = getPixelIcon();
      const scale = getPixelIconScale(cls, 40);
      return (
        <span className="relative flex items-center justify-center w-10 h-10">
          <i
            className={cls}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${scale})`,
              transformOrigin: 'center center',
              imageRendering: 'pixelated',
            }}
          />
        </span>
      );
    })(),
    transitionIcon: (
      <i
        className={getPixelIcon()}
        style={{
          transform: 'scale(1)',
          margin: 0,
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
    ),
  },
  {
    key: 'draw',
    label: '绘制模式',
    desc: '自由手绘拼豆',
    themeVar: 'var(--theme-draw)',
    bgVar: 'var(--theme-draw-light-9)',
    icon: <ClipboardPenLine className="w-10 h-10" strokeWidth={1.8} />,
    transitionIcon: <ClipboardPenLine className="w-20 h-20" strokeWidth={1.5} />,
  },
];

/* ================================================================== */
/*  随机背景生成器                                                        */
/* ================================================================== */

const BLOB_COLORS = [
  '#5783F7', '#FFCF01', '#2BB4AB', '#FFB7C5',
  '#FC4D50', '#C7B8E6', '#40BCB3', '#FFD41A',
];

const ORB_COLORS = [
  '#5783F7', '#FFCF01', '#2BB4AB', '#FFB7C5',
  '#FC4D50', '#C7B8E6', '#9AB5FA', '#FFD41A',
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomBlobs(count: number) {
  return Array.from({ length: count }, () => ({
    color: randomPick(BLOB_COLORS),
    size: randomInt(320, 580),
    x: `${randomInt(-25, 90)}%`,
    y: `${randomInt(-25, 85)}%`,
    delay: Math.random() * 10,
    duration: randomInt(20, 32),
  }));
}

function generateRandomOrbs(count: number) {
  return Array.from({ length: count }, () => ({
    color: randomPick(ORB_COLORS),
    size: randomInt(12, 30),
    x: `${randomInt(5, 95)}%`,
    y: `${randomInt(5, 95)}%`,
    delay: Math.random() * 6,
    duration: randomInt(7, 14),
  }));
}

/* ================================================================== */
/*  背景装饰组件（极简、大气）                                            */
/* ================================================================== */

/** 有机 Blob — 纯色柔和光晕 */
function BlobShape({
  color,
  size,
  x,
  y,
  delay = 0,
  duration = 25,
}: {
  color: string;
  size: number;
  x: string;
  y: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle at 45% 45%, ${color} 0%, ${color}88 40%, ${color}33 70%, transparent 100%)`,
        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
        animation: `blob-drift ${duration}s ease-in-out ${delay}s infinite alternate, blob-morph ${duration * 0.7}s ease-in-out ${delay}s infinite alternate`,
      }}
    />
  );
}

/** 装饰圆点 — 纯色柔和光晕 */
function DecoOrb({
  color,
  size,
  x,
  y,
  delay,
  duration,
}: {
  color: string;
  size: number;
  x: string;
  y: string;
  delay: number;
  duration: number;
}) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: `radial-gradient(circle, ${color} 0%, ${color}66 50%, transparent 100%)`,
        animation: `orb-float ${duration}s ease-in-out ${delay}s infinite alternate`,
      }}
    />
  );
}

/* ================================================================== */
/*  主页面                                                              */
/* ================================================================== */

export default function EntryPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* 入场动画 */
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleNavigate = useCallback(
    (mode?: string) => {
      if (mode) navigate(`/${mode}`);
      else navigate('/');
    },
    [navigate]
  );

  const handleModeClick = useCallback(
    (e: React.MouseEvent, mode: ModeItem) => {
      triggerViewTransition(
        () => handleNavigate(mode.key),
        {
          color: mode.themeVar,
          icon: mode.transitionIcon,
          originEl: e.currentTarget as HTMLElement,
        }
      );
    },
    [handleNavigate]
  );

  return (
    <div
      ref={containerRef}
      className="nookui min-h-screen relative overflow-hidden flex flex-col items-center justify-center select-none"
      style={{ background: 'var(--nook-cream)' }}
    >
      {/* ==================== 极简背景层 ==================== */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* 随机超大 blob */}
        {useMemo(() => generateRandomBlobs(randomInt(5, 8)), []).map((blob, i) => (
          <BlobShape key={`blob-${i}`} {...blob} />
        ))}

        {/* 随机装饰圆点 */}
        {useMemo(() => generateRandomOrbs(randomInt(5, 10)), []).map((orb, i) => (
          <DecoOrb key={`orb-${i}`} {...orb} />
        ))}
      </div>

      {/* 全屏毛玻璃覆盖层 — 覆盖在所有不规则圆上方 */}
      <div
        className="fixed inset-0 pointer-events-none z-[5]"
        style={{
          backdropFilter: 'blur(60px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(60px) saturate(1.3)',
          background: 'rgba(248,248,240,0.15)',
        }}
      />

      {/* ==================== 内容层 ==================== */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-[720px] px-8 py-12">
        {/* --- Logo 区域（更大、更聚焦） --- */}
        <div
          className={`flex flex-col items-center mb-10 transition-all duration-700 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          {/* 主 Logo */}
          <div
            className="relative w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] mb-6 rounded-[40px] flex items-center justify-center"
            style={{
              background: 'var(--ac-green)',
              boxShadow: '0 12px 40px rgba(43,180,171,0.22)',
              animation: 'logo-breathe 4s ease-in-out infinite',
            }}
          >
            <Wand2 className="w-14 h-14 sm:w-16 sm:h-16 text-white" strokeWidth={1.6} />
            {/* 小星星装饰 */}
            <div
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[var(--ac-yellow)] flex items-center justify-center"
              style={{ animation: 'star-bob 3s ease-in-out infinite' }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>

          {/* 标题 */}
          <h1 className="text-[36px] sm:text-[44px] font-extrabold text-[var(--nook-brown)] tracking-tight leading-none mb-3">
            CC-PinDou
          </h1>
          <p className="text-base sm:text-lg text-[var(--text-secondary)] font-semibold">
            把任意图片变成拼豆制作图纸
          </p>
        </div>

        {/* --- 三模式选择（NookUI Card 风格） --- */}
        <div className="flex gap-5 sm:gap-6 mb-10 w-full justify-center">
          {MODES.map((mode, i) => {
            const accentClass =
              mode.key === 'normal'
                ? 'before:bg-ac-blue hover:border-ac-blue hover:shadow-card-hover-blue'
                : mode.key === 'pixel'
                ? 'before:bg-ac-yellow hover:border-ac-yellow hover:shadow-card-hover-yellow'
                : 'before:bg-ac-green hover:border-ac-green hover:shadow-card-hover-green';
            return (
              <button
                key={mode.key}
                onClick={(e) => handleModeClick(e, mode)}
                onMouseEnter={() => setHoveredMode(mode.key)}
                onMouseLeave={() => setHoveredMode(null)}
                className={`group flex flex-col items-center transition-all duration-500 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
                style={{
                  transitionDelay: `${350 + i * 120}ms`,
                  transitionTimingFunction: 'var(--ease-bounce)',
                  outline: 'none',
                }}
              >
                {/* NookUI Card 骨架 */}
                <div
                  className={`
                    relative overflow-hidden bg-[var(--bg-surface)] border-[3px] border-transparent
                    w-[160px] h-[220px] sm:w-[190px] sm:h-[260px] rounded-card
                    p-5 sm:p-6 flex flex-col items-center justify-center gap-3
                    transition-all duration-500 ease-nook
                    shadow-soft hover:-translate-y-2 hover:scale-[1.02]
                    before:pointer-events-none before:absolute before:inset-x-0 before:top-0
                    before:h-[6px] before:opacity-0 before:transition-opacity before:duration-500 before:ease-nook
                    before:content-[''] hover:before:opacity-100
                    ${accentClass}
                  `}
                >
                  {/* 图标 */}
                  <div
                    className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-[24px] flex items-center justify-center text-white mt-2 transition-transform duration-300 ease-nook"
                    style={{
                      background: mode.themeVar,
                      boxShadow: `0 6px 20px ${mode.themeVar}35`,
                      transform: hoveredMode === mode.key ? 'rotate(-3deg) scale(1.06)' : 'rotate(0deg) scale(1)',
                    }}
                  >
                    {mode.icon}
                  </div>

                  {/* 装饰入口按钮 */}
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ease-nook"
                    style={{
                      background: hoveredMode === mode.key ? mode.themeVar : `${mode.themeVar}20`,
                      color: hoveredMode === mode.key ? '#fff' : mode.themeVar,
                      transform: hoveredMode === mode.key ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* 名称 + 描述 */}
                  <div className="text-center mb-1">
                    <div className="text-[15px] sm:text-base font-extrabold text-[var(--nook-brown)] leading-tight">
                      {mode.label}
                    </div>
                    <div className="text-[11px] sm:text-xs font-semibold text-[var(--text-caption)] mt-1.5 leading-relaxed">
                      {mode.desc}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* --- 主按钮 --- */}
        <div
          className={`flex flex-col items-center gap-4 w-full transition-all duration-700 delay-600 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <button
            className="group relative overflow-hidden w-full max-w-[320px] h-[56px] rounded-[24px] font-extrabold text-base text-white flex items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: 'var(--ac-green)',
              boxShadow: '0 6px 24px rgba(43,180,171,0.28)',
              transitionTimingFunction: 'var(--ease-bounce)',
              outline: 'none',
            }}
            onClick={(e) => {
              const drawMode = MODES[2];
              triggerViewTransition(
                () => handleNavigate(drawMode.key),
                {
                  color: drawMode.themeVar,
                  icon: drawMode.transitionIcon,
                  originEl: e.currentTarget as HTMLElement,
                }
              );
            }}
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <MousePointerClick className="w-5 h-5 relative z-10" />
            <span className="relative z-10">开始制作</span>
          </button>
        </div>

        {/* --- 底部 footer --- */}
        <div
          className={`mt-12 text-sm text-[var(--text-muted)] font-semibold transition-all duration-700 delay-800 ${
            mounted ? 'opacity-40' : 'opacity-0'
          }`}
        >
          CC-PinDou
        </div>
      </div>

      {/* ==================== 注入关键帧动画 ==================== */}
      <style>{`
        @keyframes blob-drift {
          0% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(24px, -18px) rotate(2deg); }
          66% { transform: translate(-12px, 12px) rotate(-1deg); }
          100% { transform: translate(18px, -10px) rotate(1deg); }
        }
        @keyframes blob-morph {
          0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
          33% { border-radius: 40% 60% 70% 30% / 50% 60% 30% 60%; }
          66% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
          100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
        }
        @keyframes orb-float {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(10px, -14px) rotate(3deg); }
          100% { transform: translate(-6px, 8px) rotate(-2deg); }
        }
        @keyframes logo-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes star-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(8deg); }
        }
      `}</style>
    </div>
  );
}
