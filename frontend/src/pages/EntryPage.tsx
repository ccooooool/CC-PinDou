import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { triggerViewTransition } from '../utils/viewTransition';
import {
  Loader2,
  Wifi,
  WifiOff,
  ArrowRight,
  Wand2,
  Image,
  ClipboardPenLine,
} from 'lucide-react';
import { getPixelIcon } from '../utils/pixelIcon';

export default function EntryPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const pixelIconClass = getPixelIcon();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/models', { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'online' : 'offline'))
      .catch(() => setStatus('offline'));
    return () => controller.abort();
  }, []);

  const handleNavigate = (base: 'full' | 'simple', mode?: string) => {
    if (mode) {
      navigate(`/${base}/${mode}`);
    } else {
      navigate(`/${base}`);
    }
  };

  const handleCardClick = (
    e: React.MouseEvent,
    base: 'full' | 'simple',
    targetMode: string,
    color: string,
    icon: React.ReactNode
  ) => {
    triggerViewTransition(
      () => handleNavigate(base, targetMode),
      {
        color,
        icon,
        originEl: e.currentTarget as HTMLElement,
      }
    );
  };

  const cards = [
    {
      icon: <Image className="w-7 h-7" />,
      transitionIcon: <Image className="w-24 h-24" />,
      title: '普通图片',
      desc: '上传照片，AI 自动转拼豆图纸',
      themeColor: 'var(--theme-normal)',
      themeShadow: 'var(--shadow-card-hover-blue)',
      mode: 'normal' as const,
    },
    {
      icon: <i className={pixelIconClass} style={{ transform: 'scale(0.2916)', margin: -34, imageRendering: 'pixelated', display: 'block' }} />,
      transitionIcon: <i className={pixelIconClass} style={{ transform: 'scale(1)', margin: 0, imageRendering: 'pixelated', display: 'block' }} />,
      title: '像素图',
      desc: '像素风素材优化，自动检测格子',
      themeColor: 'var(--theme-pixel)',
      themeShadow: 'var(--shadow-card-hover-yellow)',
      mode: 'pixel' as const,
    },
    {
      icon: <ClipboardPenLine className="w-7 h-7" />,
      transitionIcon: <ClipboardPenLine className="w-24 h-24" />,
      title: '自由绘制',
      desc: '空白画板，手动绘制与编辑',
      themeColor: 'var(--theme-draw)',
      themeShadow: 'var(--shadow-card-hover-green)',
      mode: 'draw' as const,
    },
  ];

  const bubbles = [
    { color: 'var(--theme-normal)', size: 300, top: '-8%', left: '2%', duration: 14, delay: 0, bx: 22, by: -28, bx2: -18, by2: 20 },
    { color: 'var(--theme-normal)', size: 200, top: '55%', left: '-6%', duration: 18, delay: -5, bx: 16, by: -20, bx2: -12, by2: 14 },
    { color: 'var(--theme-pixel)', size: 340, top: '5%', right: '-4%', duration: 16, delay: -3, bx: -24, by: -18, bx2: 20, by2: 22 },
    { color: 'var(--theme-pixel)', size: 220, bottom: '-8%', left: '35%', duration: 20, delay: -8, bx: 18, by: 24, bx2: -22, by2: -16 },
    { color: 'var(--theme-draw)', size: 180, top: '45%', right: '5%', duration: 15, delay: -2, bx: -20, by: 16, bx2: 14, by2: -20 },
    { color: 'var(--theme-draw)', size: 260, bottom: '15%', left: '10%', duration: 17, delay: -6, bx: 14, by: -22, bx2: -16, by2: 18 },
  ];

  return (
    <div className="nookui min-h-screen bg-[var(--nook-cream)] flex items-center justify-center p-6 relative">
      {/* 背景彩色色块层 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {bubbles.map((b, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: b.size,
              height: b.size,
              top: b.top,
              left: b.left,
              right: b.right,
              bottom: b.bottom,
              background: `color-mix(in srgb, ${b.color} 55%, transparent)`,
              filter: 'blur(2px)',
              animation: `bubble-float ${b.duration}s ease-in-out ${b.delay}s infinite alternate`,
              ['--bx' as string]: `${b.bx}px`,
              ['--by' as string]: `${b.by}px`,
              ['--bx2' as string]: `${b.bx2}px`,
              ['--by2' as string]: `${b.by2}px`,
            }}
          />
        ))}
      </div>

      {/* 全屏毛玻璃覆盖层 */}
      <div
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          backdropFilter: 'blur(80px) saturate(150%)',
          WebkitBackdropFilter: 'blur(80px) saturate(150%)',
          background: 'rgba(255,248,240,0.15)',
        }}
      />

      <div className="max-w-[780px] w-full relative z-[2]">
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <div className="w-[72px] h-[72px] rounded-3xl bg-[var(--ac-green)] flex items-center justify-center mx-auto mb-4 shadow-[var(--shadow-colored)]">
            <Wand2 className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-[26px] font-extrabold text-[var(--text-primary)] mb-1.5 tracking-tight">
            拼豆图案生成器
          </h1>
          <p className="text-sm text-[var(--text-secondary)] m-0 font-semibold">
            上传图片，一键生成拼豆制作图纸
          </p>
        </div>

        {/* 状态卡片 */}
        <div className="nook-panel px-5 py-4 mb-6 text-center">
          {status === 'checking' && (
            <div className="flex items-center justify-center gap-2.5">
              <Loader2 className="animate-spin w-5 h-5 text-[var(--ac-green)]" />
              <span className="text-sm text-[var(--text-secondary)] font-bold">
                正在检测后端服务…
              </span>
            </div>
          )}
          {status === 'online' && (
            <div className="flex items-center justify-center gap-2 text-[var(--ac-green)]">
              <Wifi className="w-[18px] h-[18px]" />
              <span className="text-sm font-bold">后端已连接，完整模式可用</span>
            </div>
          )}
          {status === 'offline' && (
            <div className="flex items-center justify-center gap-2 text-[var(--ac-coral)]">
              <WifiOff className="w-[18px] h-[18px]" />
              <span className="text-sm font-bold">未检测到后端服务，仅离线模式可用</span>
            </div>
          )}
        </div>

        {/* 三列卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {cards.map((card) => (
            <ModeCard
              key={card.mode}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              themeColor={card.themeColor}
              themeShadow={card.themeShadow}
              onClick={(e) =>
                handleCardClick(
                  e,
                  status === 'online' ? 'full' : 'simple',
                  card.mode,
                  card.themeColor,
                  card.transitionIcon
                )
              }
            />
          ))}
        </div>

        {/* 底部分割 + 模式切换 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--border-light)]" />
          <span className="text-xs text-[var(--text-muted)] font-bold">或选择工作模式</span>
          <div className="flex-1 h-px bg-[var(--border-light)]" />
        </div>

        <div className="flex gap-3">
          <button
            className="nook-btn nook-btn-primary flex-1 justify-center bg-[var(--ac-green)]"
            style={{
              opacity: status === 'offline' ? 0.5 : 1,
              cursor: status === 'offline' ? 'not-allowed' : 'pointer',
            }}
            onClick={() => status === 'online' && handleNavigate('full')}
            disabled={status === 'offline'}
          >
            <Wifi className="w-4 h-4" />
            完整模式
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            className="nook-btn nook-btn-secondary flex-1 justify-center"
            onClick={() => handleNavigate('simple')}
          >
            <WifiOff className="w-4 h-4" />
            离线模式
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  desc,
  themeColor,
  themeShadow,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  themeColor: string;
  themeShadow: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className="nook-panel p-0 flex flex-col items-center text-center w-full border-none cursor-pointer rounded-[var(--radius-card)] overflow-hidden bg-white"
      onClick={onClick}
      style={{
        transition: 'transform 0.25s var(--ease-bounce), box-shadow 0.25s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-6px)';
        e.currentTarget.style.boxShadow = themeShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-soft)';
      }}
    >
      {/* 顶部主题色条 */}
      <div className="w-full h-[5px]" style={{ background: themeColor }} />

      <div className="px-[18px] pt-6 pb-5 flex flex-col items-center gap-2.5 w-full">
        {/* 图标 */}
        <div
          className="w-[60px] h-[60px] rounded-[var(--radius-lg)] flex items-center justify-center text-white shrink-0"
          style={{
            background: themeColor,
            boxShadow: `0 6px 16px ${themeColor}35`,
          }}
        >
          {icon}
        </div>

        {/* 标题 */}
        <div className="text-base font-extrabold text-[var(--text-primary)] mt-0.5">
          {title}
        </div>

        {/* 描述 */}
        <div className="text-xs text-[var(--text-secondary)] font-semibold leading-relaxed min-h-[36px]">
          {desc}
        </div>

        {/* 进入按钮 */}
        <div
          className="mt-1.5 flex items-center gap-1.5 text-[13px] font-bold rounded-[var(--radius-full)]"
          style={{
            color: themeColor,
            padding: '6px 14px',
            background: `${themeColor}12`,
            transition: 'background 0.2s',
          }}
        >
          进入
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </button>
  );
}
