import { useUIStore } from '../store/usePerlerStore';
import { Image, Grid3X3, Pencil } from 'lucide-react';

const MODES = [
  { key: 'normal' as const, label: '普通图片', icon: Image },
  { key: 'pixel' as const, label: '像素图', icon: Grid3X3 },
  { key: 'draw' as const, label: '自由绘制', icon: Pencil },
];

export function ModeTabs() {
  const mode = useUIStore((s) => s.mode);
  const setMode = useUIStore((s) => s.setMode);

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2 bg-white border-b border-[rgba(255,107,157,0.08)] shrink-0">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.key;
        return (
          <button
            key={m.key}
            onClick={() => {
              setMode(m.key);
            }}
            className={[
              'dop-btn text-[13px]',
              active ? 'dop-btn-primary' : 'dop-btn-secondary',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
