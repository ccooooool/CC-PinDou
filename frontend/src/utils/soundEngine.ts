/**
 * 拼豆音效引擎
 * 基于 Web Audio API，无需外部音频文件
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 五声音阶频率 (C 大调)：好听且任意组合不刺耳
const PENTATONIC = [261.6, 293.7, 329.6, 392.0, 440.0, 523.2, 587.3, 659.3];

function hexToHue(hex: string): number {
  if (hex === 'transparent') return 0;
  const r = parseInt(hex.substr(1, 2), 16) / 255;
  const g = parseInt(hex.substr(3, 2), 16) / 255;
  const b = parseInt(hex.substr(5, 2), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return h;
}

function colorToFrequency(hex: string): number {
  const hue = hexToHue(hex);
  const idx = Math.floor(hue * PENTATONIC.length) % PENTATONIC.length;
  return PENTATONIC[idx];
}

let lastSoundTime = 0;
const SOUND_COOLDOWN_MS = 40; // 避免过于密集的声音重叠

/**
 * 播放放置拼豆的"咔嗒"声
 */
export function playBeadSound(hexColor: string): void {
  const now = performance.now();
  if (now - lastSoundTime < SOUND_COOLDOWN_MS) return;
  lastSoundTime = now;

  try {
    const ctx = getAudioContext();
    const freq = colorToFrequency(hexColor);

    // 主音：短促正弦波
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = freq;

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.start(t);
    osc.stop(t + 0.08);

    // 高频泛音：增加"咔嗒"质感
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);

    clickOsc.type = 'triangle';
    clickOsc.frequency.value = freq * 2.5;
    clickGain.gain.setValueAtTime(0, t);
    clickGain.gain.linearRampToValueAtTime(0.08, t + 0.003);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    clickOsc.start(t);
    clickOsc.stop(t + 0.04);
  } catch {
    // AudioContext 可能不支持，静默失败
  }
}

/**
 * 播放填充/大面积操作的低频确认音
 */
export function playFillSound(): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // 静默失败
  }
}

/**
 * 播放错误/警告提示音
 */
export function playAlertSound(): void {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.setValueAtTime(250, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // 静默失败
  }
}
