import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface BlobSpec {
  color: string;
  colorAlt: string;
  top: string;
  left: string;
  width: string;
  height: string;
  duration: number;
  delay: number;
  xRange: [number, number];
  yRange: [number, number];
  scaleRange: [number, number];
}

const BLOB_COLOR_PAIRS: Record<'normal' | 'pixel' | 'draw', [string, string][]> = {
  normal: [
    ['var(--theme-normal-light-1)', 'var(--theme-normal-light-5)'],
    ['var(--theme-normal-light-5)', 'var(--theme-normal-light-3)'],
    ['var(--theme-normal)', 'var(--theme-normal-light-3)'],
    ['var(--theme-normal-dark-1)', 'var(--theme-normal)'],
  ],
  pixel: [
    ['var(--theme-pixel-light-1)', 'var(--theme-pixel-light-5)'],
    ['var(--theme-pixel-light-5)', 'var(--theme-pixel-light-3)'],
    ['var(--theme-pixel)', 'var(--theme-pixel-light-3)'],
    ['var(--theme-pixel-dark-1)', 'var(--theme-pixel)'],
  ],
  draw: [
    ['var(--theme-draw-light-1)', 'var(--theme-draw-light-5)'],
    ['var(--theme-draw-light-5)', 'var(--theme-draw-light-3)'],
    ['var(--theme-draw)', 'var(--theme-draw-light-3)'],
    ['var(--theme-draw-dark-1)', 'var(--theme-draw)'],
  ],
};

const OVERLAY_COLORS: Record<'normal' | 'pixel' | 'draw', string[]> = {
  normal: [
    'rgba(238,243,254,0.55)',
    'rgba(255,248,240,0.35)',
    'rgba(255,248,240,0.2)',
    'rgba(234,248,247,0.45)',
  ],
  pixel: [
    'rgba(255,250,230,0.55)',
    'rgba(255,248,240,0.35)',
    'rgba(255,248,240,0.2)',
    'rgba(255,245,220,0.45)',
  ],
  draw: [
    'rgba(234,248,247,0.55)',
    'rgba(255,248,240,0.35)',
    'rgba(255,248,240,0.2)',
    'rgba(234,248,247,0.5)',
  ],
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomBlobs(mode: 'normal' | 'pixel' | 'draw'): BlobSpec[] {
  const pairs = BLOB_COLOR_PAIRS[mode];
  return pairs.map(([color, colorAlt]) => ({
    color,
    colorAlt,
    top: `${randomInt(-20, 80)}%`,
    left: `${randomInt(-10, 70)}%`,
    width: `${randomInt(120, 180)}%`,
    height: `${randomInt(50, 90)}%`,
    duration: randomInt(18, 30),
    delay: randomInt(0, 5),
    xRange: [randomInt(-60, -10), randomInt(10, 60)] as [number, number],
    yRange: [randomInt(-40, -10), randomInt(10, 40)] as [number, number],
    scaleRange: [0.88 + Math.random() * 0.08, 1.02 + Math.random() * 0.08] as [number, number],
  }));
}

function generateRandomOverlay(mode: 'normal' | 'pixel' | 'draw'): string {
  const colors = OVERLAY_COLORS[mode];
  const p1 = randomInt(22, 42);
  const p2 = randomInt(52, 72);
  const angle = randomInt(150, 210);
  return `linear-gradient(${angle}deg, ${colors[0]} 0%, ${colors[1]} ${p1}%, ${colors[2]} ${p2}%, ${colors[3]} 100%)`;
}

function ThemeBlob({ blob }: { blob: BlobSpec }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        top: blob.top,
        left: blob.left,
        width: blob.width,
        height: blob.height,
        background: `radial-gradient(ellipse at center, ${blob.color} 0%, ${blob.colorAlt} 40%, transparent 75%)`,
        filter: 'blur(80px)',
        opacity: 0.42,
      }}
      animate={{
        x: blob.xRange,
        y: blob.yRange,
        scale: blob.scaleRange,
      }}
      transition={{
        duration: blob.duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay: blob.delay,
      }}
    />
  );
}

/**
 * 工作模式动态主题背景
 * 每次进入页面时 blob 位置、大小、动画参数和 overlay 渐变分布都是随机的
 */
export default function ModeBackground({ mode }: { mode: 'normal' | 'pixel' | 'draw' }) {
  const blobs = useMemo(() => generateRandomBlobs(mode), [mode]);
  const overlay = useMemo(() => generateRandomOverlay(mode), [mode]);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden="true"
    >
      {/* 4 层主题色光晕 */}
      {blobs.map((blob, i) => (
        <ThemeBlob key={`${mode}-${i}`} blob={blob} />
      ))}

      {/* 细微噪点纹理 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* 模式色调渐变遮罩，确保前景可读 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: overlay }}
      />
    </div>
  );
}
