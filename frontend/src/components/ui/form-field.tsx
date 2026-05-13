import { ReactNode } from 'react';
import { Slider } from './slider';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, children, className }: FormFieldProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

interface FormSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  themeColor?: string;
  inputWidth?: string;
  className?: string;
}

export function FormSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  themeColor,
  inputWidth = 'w-16',
  className,
}: FormSliderProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <label className="text-xs font-bold text-[var(--text-muted)] w-20 shrink-0">{label}</label>
      <div className="flex-1 flex items-center gap-2.5">
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min}
          max={max}
          step={step}
          className="w-full"
          themeColor={themeColor}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn('nook-input text-center px-1', inputWidth)}
        />
      </div>
    </div>
  );
}
