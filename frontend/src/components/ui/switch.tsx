import type { FC } from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps {
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

export function Switch({
  checked = false,
  onChange,
  disabled,
  className,
}: SwitchProps) {
  return (
    <label className={cn("inline-flex items-center", className)}>
      <input
        type="checkbox"
        className="dop-switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  )
}
