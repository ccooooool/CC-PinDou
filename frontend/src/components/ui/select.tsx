import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

interface SelectOption {
  key: string
  label: string
}

interface SelectProps {
  value?: string
  options: SelectOption[]
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const Select = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Root>, SelectProps>(
  ({ value, options, onChange, placeholder = "请选择...", disabled, className }, ref) => {
    return (
      <SelectPrimitive.Root
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          ref={ref as any}
          className={cn(
            "inline-flex w-full items-center justify-between",
            "h-11 px-4 py-2",
            "font-nook font-semibold text-base text-[var(--text-heading)]",
            "bg-[var(--bg-surface)] border-[3px] border-[var(--nook-wood-light)] rounded-input",
            "transition-all duration-200 ease-nook",
            "focus:outline-none focus:border-ac-green focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1",
            "hover:border-[var(--nook-wood)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "data-[state=open]:border-ac-green",
            className
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 text-[var(--text-caption)] transition-transform duration-200 ease-nook data-[state=open]:rotate-180" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className={cn(
              "relative z-50 max-h-96 min-w-[8rem] overflow-hidden",
              "rounded-card border-[3px] border-[var(--nook-wood-light)]",
              "bg-[var(--bg-surface)] shadow-modal",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2",
              "data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2",
              "data-[side=top]:slide-in-from-bottom-2"
            )}
            position="popper"
            sideOffset={6}
          >
            <SelectPrimitive.Viewport className="p-2">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.key}
                  value={option.key}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center",
                    "rounded-button px-3 py-2.5 text-sm font-semibold",
                    "text-[var(--text-heading)] outline-none",
                    "transition-all duration-150 ease-nook",
                    "hover:bg-[var(--bg-surface-alt)] hover:translate-x-0.5",
                    "data-[state=checked]:bg-ac-green data-[state=checked]:text-white data-[state=checked]:shadow-btn-green",
                    "data-[state=checked]:hover:bg-ac-green data-[state=checked]:hover:text-white"
                  )}
                >
                  <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <span className="pl-6">
                    <SelectPrimitive.ItemText>
                      {option.label}
                    </SelectPrimitive.ItemText>
                  </span>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    )
  }
)

Select.displayName = "Select"

export { Select }
