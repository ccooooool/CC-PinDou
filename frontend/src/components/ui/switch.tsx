import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  themeColor?: string
}

export function Switch({
  checked = false,
  onChange,
  disabled,
  className,
  themeColor,
}: SwitchProps) {
  const focusColor = themeColor || 'var(--color-primary)'
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.checked)
  }

  return (
    <label className={cn("inline-flex items-center cursor-pointer select-none", className)}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
        />
        <div
          className="w-12 h-7 bg-[var(--bg-surface-alt)] rounded-full peer-checked:bg-ac-green transition-colors duration-300 ease-nook border border-[var(--border-default)] peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--switch-focus-color,var(--color-primary))]"
          style={{ ['--switch-focus-color' as string]: focusColor }}
        />
        <div className="absolute left-1 top-1 w-5 h-5 bg-[var(--bg-surface)] rounded-full shadow-switch-thumb transition-transform duration-300 ease-nook peer-checked:translate-x-5" />
      </div>
    </label>
  )
}
