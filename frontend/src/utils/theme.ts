/**
 * 模式主题色系统
 * 普通模式(normal)=天蓝, 像素模式(pixel)=暖黄, 绘制模式(draw)=动森绿
 */

export interface ModeTheme {
  main: string;
  light1: string;
  light3: string;
  light5: string;
  light8: string;
  light9: string;
  dark1: string;
  dark2: string;
}

export const MODE_THEMES: Record<string, ModeTheme> = {
  normal: {
    main: 'var(--theme-normal)',
    light1: 'var(--theme-normal-light-1)',
    light3: 'var(--theme-normal-light-3)',
    light5: 'var(--theme-normal-light-5)',
    light8: 'var(--theme-normal-light-8)',
    light9: 'var(--theme-normal-light-9)',
    dark1: 'var(--theme-normal-dark-1)',
    dark2: 'var(--theme-normal-dark-2)',
  },
  pixel: {
    main: 'var(--theme-pixel)',
    light1: 'var(--theme-pixel-light-1)',
    light3: 'var(--theme-pixel-light-3)',
    light5: 'var(--theme-pixel-light-5)',
    light8: 'var(--theme-pixel-light-8)',
    light9: 'var(--theme-pixel-light-9)',
    dark1: 'var(--theme-pixel-dark-1)',
    dark2: 'var(--theme-pixel-dark-2)',
  },
  draw: {
    main: 'var(--theme-draw)',
    light1: 'var(--theme-draw-light-1)',
    light3: 'var(--theme-draw-light-3)',
    light5: 'var(--theme-draw-light-5)',
    light8: 'var(--theme-draw-light-8)',
    light9: 'var(--theme-draw-light-9)',
    dark1: 'var(--theme-draw-dark-1)',
    dark2: 'var(--theme-draw-dark-2)',
  },
};

export function getModeTheme(mode: string): ModeTheme {
  return MODE_THEMES[mode] || MODE_THEMES.normal;
}
