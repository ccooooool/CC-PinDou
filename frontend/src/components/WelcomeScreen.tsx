import { useUIStore } from '../store/usePerlerStore';
import { Image, Grid3X3, Upload, Sliders, Wand2, Lightbulb, Pencil } from 'lucide-react';

export function WelcomeScreen() {
  const setShowWelcome = useUIStore((s) => s.setShowWelcome);
  const setMode = useUIStore((s) => s.setMode);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)] z-10">
      <div className="text-center max-w-[700px] p-10">
        <h2 className="text-2xl font-bold text-[var(--text-secondary)] mb-10 flex items-center justify-center gap-3">
          <Grid3X3 className="w-8 h-8" />
          拼豆图案生成器
        </h2>

        <div className="flex gap-10 justify-center mb-10">
          <div
            onClick={() => { setMode('normal'); setShowWelcome(false); }}
            className="dop-panel p-7 px-6 w-[260px] hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="w-14 h-14 rounded-full bg-[var(--nook-paper)] text-[var(--text-secondary)] flex items-center justify-center mx-auto mb-4">
              <Image className="w-6 h-6" />
            </div>
            <div className="text-lg font-bold text-[var(--text-main)] mb-2">普通图片模式</div>
            <div className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
              上传任意图片，自动转换为拼豆图案
            </div>
            <div className="flex flex-col gap-2">
              <span className="dop-badge justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 上传图片
              </span>
              <span className="dop-badge justify-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 调整参数
              </span>
              <span className="dop-badge justify-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 生成图案
              </span>
            </div>
          </div>

          <div
            onClick={() => { setMode('pixel'); setShowWelcome(false); }}
            className="dop-panel p-7 px-6 w-[260px] hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="w-14 h-14 rounded-full bg-[var(--nook-paper)] text-[var(--text-secondary)] flex items-center justify-center mx-auto mb-4">
              <Grid3X3 className="w-6 h-6" />
            </div>
            <div className="text-lg font-bold text-[var(--text-main)] mb-2">像素图模式</div>
            <div className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
              专为像素风格设计的智能对齐模式
            </div>
            <div className="flex flex-col gap-2">
              <span className="dop-badge justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 上传像素原图
              </span>
              <span className="dop-badge justify-center gap-1.5">
                <Grid3X3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 自动检测像素
              </span>
              <span className="dop-badge justify-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 生成图案
              </span>
            </div>
          </div>

          <div
            onClick={() => { setMode('draw'); setShowWelcome(false); }}
            className="dop-panel p-7 px-6 w-[260px] hover:-translate-y-1 cursor-pointer overflow-hidden"
          >
            <div className="w-14 h-14 rounded-full bg-[var(--nook-paper)] text-[var(--text-secondary)] flex items-center justify-center mx-auto mb-4">
              <Pencil className="w-6 h-6" />
            </div>
            <div className="text-lg font-bold text-[var(--text-main)] mb-2">自由绘制</div>
            <div className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
              从空白画板开始，自由创作拼豆图案
            </div>
            <div className="flex flex-col gap-2">
              <span className="dop-badge justify-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 笔刷 & 形状工具
              </span>
              <span className="dop-badge justify-center gap-1.5">
                <Grid3X3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 对称绘制
              </span>
              <span className="dop-badge justify-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> 填充 & 橡皮
              </span>
            </div>
          </div>
        </div>

        <div className="text-sm text-[var(--text-muted)] flex items-center justify-center gap-2">
          <Lightbulb className="w-4 h-4 text-[var(--text-secondary)]" />
          选择模式开始使用
        </div>
      </div>
    </div>
  );
}
