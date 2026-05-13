/* ─── NES 像素图标彩蛋 ─── */
const NES_ICONS = [
  'nes-mario',
  'nes-ash',
  'nes-pokeball',
  'nes-bulbasaur',
  'nes-charmander',
  'nes-squirtle',
  'nes-kirby',
];

/** 各 NES 图标的原始 CSS 尺寸（width × height）—— 用于小空间内精确缩放 */
export const NES_ICON_SIZES: Record<string, { w: number; h: number }> = {
  'nes-mario': { w: 84, h: 96 },
  'nes-ash': { w: 84, h: 90 },
  'nes-pokeball': { w: 84, h: 84 },
  'nes-bulbasaur': { w: 120, h: 102 },
  'nes-charmander': { w: 126, h: 108 },
  'nes-squirtle': { w: 126, h: 102 },
  'nes-kirby': { w: 96, h: 96 },
};

/** 从 sessionStorage 读取缓存的 NES 图标，没有则随机抽取并缓存。
 *  关闭浏览器后 sessionStorage 自动清除，下次进入重新抽取。 */
export function getPixelIcon(): string {
  const cached = sessionStorage.getItem('pixel-icon');
  if (cached) return cached;
  const picked = NES_ICONS[Math.floor(Math.random() * NES_ICONS.length)];
  sessionStorage.setItem('pixel-icon', picked);
  return picked;
}

/** 计算将 NES 图标完整放入目标容器所需的 scale 值 */
export function getPixelIconScale(iconClass: string, containerSize: number): number {
  const size = NES_ICON_SIZES[iconClass];
  if (!size) return containerSize / 96;
  const maxDim = Math.max(size.w, size.h);
  return containerSize / maxDim;
}
