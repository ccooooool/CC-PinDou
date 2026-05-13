import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  allowClear?: boolean
  size?: "sm" | "default"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, allowClear, size = "default", value, onChange, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => inputRef.current!)

    const handleClear = () => {
      if (inputRef.current) {
        inputRef.current.value = ""
        inputRef.current.focus()
        const event = new Event("input", { bubbles: true })
        inputRef.current.dispatchEvent(event)
        onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>)
      }
    }

    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "w-full font-nook font-semibold text-[var(--text-heading)]",
            "bg-[var(--bg-surface)] border-[3px] border-[var(--nook-wood-light)]",
            "rounded-input",
            "placeholder:text-[var(--text-caption)]",
            "transition-all duration-200 ease-nook",
            "focus:outline-none focus:border-ac-green focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            size === "sm" && "h-9 px-3 text-sm",
            size === "default" && "h-11 px-4 text-base",
            allowClear && "pr-10",
            className
          )}
          ref={inputRef}
          value={value}
          onChange={onChange}
          {...props}
        />
        {allowClear && value && String(value).length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2",
              "rounded-full p-1 text-[var(--text-caption)]",
              "transition-all duration-200 ease-nook",
              "hover:bg-[var(--ac-coral)]/10 hover:text-[var(--ac-coral)] hover:scale-110",
              "active:scale-95"
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
