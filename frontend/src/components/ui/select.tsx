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
            "dop-select",
            className
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-[var(--nook-wood)] bg-[var(--surface-solid)] text-[var(--text-main)] shadow-[var(--shadow-md)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="p-1.5">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.key}
                  value={option.key}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-xl px-3 py-2 text-sm font-bold outline-none transition-colors",
                    "focus:bg-[var(--surface-hover)] focus:text-[var(--text-primary)] data-[state=checked]:bg-[var(--nook-wood-light)] data-[state=checked]:text-[var(--text-primary)]"
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <Check className="h-4 w-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText className="pl-5">
                    {option.label}
                  </SelectPrimitive.ItemText>
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
