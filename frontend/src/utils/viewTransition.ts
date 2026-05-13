import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';

export interface TransitionIconConfig {
  normal: ReactNode;
  pixel: ReactNode;
  draw: ReactNode;
}

export interface TransitionColorConfig {
  normal: string;
  pixel: string;
  draw: string;
}

const DEFAULT_COLORS: TransitionColorConfig = {
  normal: 'var(--theme-normal)',
  pixel: 'var(--theme-pixel)',
  draw: 'var(--theme-draw)',
};

/** 触发 View Transitions API 转场动画（与 EntryPage 入口导航页同步风格） */
export function triggerViewTransition(
  navigateFn: () => void,
  options: {
    color: string;
    icon: ReactNode;
    originEl: HTMLElement;
  }
) {
  const rect = options.originEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const maxDist = Math.max(
    Math.sqrt((originX - 0) ** 2 + (originY - 0) ** 2),
    Math.sqrt((originX - w) ** 2 + (originY - 0) ** 2),
    Math.sqrt((originX - 0) ** 2 + (originY - h) ** 2),
    Math.sqrt((originX - w) ** 2 + (originY - h) ** 2)
  );
  const radius = Math.ceil(maxDist + 20);

  const html = document.documentElement;
  html.style.setProperty('--vt-origin-x', `${originX}px`);
  html.style.setProperty('--vt-origin-y', `${originY}px`);
  html.style.setProperty('--vt-radius', `${radius}px`);

  if (!('startViewTransition' in document)) {
    navigateFn();
    return;
  }

  // 1. 颜色扩散层
  const bgLayer = document.createElement('div');
  bgLayer.style.cssText = `
    position: fixed;
    inset: 0;
    background: ${options.color};
    view-transition-name: vt-bg;
  `;
  document.body.appendChild(bgLayer);

  // 2. 图标元素
  const iconWrapper = document.createElement('div');
  iconWrapper.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    width: 96px;
    height: 96px;
    margin: -48px 0 0 -48px;
    view-transition-name: vt-icon;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  `;
  const iconRoot = createRoot(iconWrapper);
  iconRoot.render(options.icon);
  document.body.appendChild(iconWrapper);

  // 3. 白色粒子
  const PARTICLE_COUNT = 8;
  const particleContainer = document.createElement('div');
  particleContainer.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    view-transition-name: vt-particles;
  `;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT;
    const distance = 32 + Math.random() * 16;
    const length = 5 + Math.random() * 3;
    const thickness = 2.5 + Math.random() * 1;
    const particle = document.createElement('div');
    const px = Math.cos(angle) * distance;
    const py = Math.sin(angle) * distance;
    const deg = (angle * 180) / Math.PI + 90;
    particle.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      width: ${thickness}px;
      height: ${length}px;
      margin-left: -${thickness / 2}px;
      margin-top: -${length / 2}px;
      border-radius: 9999px;
      background: #fff;
      transform: translate(${px}px, ${py}px) rotate(${deg}deg) scale(${0.8 + Math.random() * 0.4});
    `;
    particleContainer.appendChild(particle);
  }
  document.body.appendChild(particleContainer);

  // 4. 启动 View Transition
  (
    document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }
  ).startViewTransition(() => {
    flushSync(() => navigateFn());
    bgLayer.style.opacity = '0';
    iconWrapper.style.opacity = '0';
  });

  // 5. 清理
  setTimeout(() => {
    iconRoot.unmount();
    iconWrapper.remove();
    bgLayer.remove();
    particleContainer.remove();
    html.style.removeProperty('--vt-origin-x');
    html.style.removeProperty('--vt-origin-y');
    html.style.removeProperty('--vt-radius');
  }, 1600);
}

export { DEFAULT_COLORS };
