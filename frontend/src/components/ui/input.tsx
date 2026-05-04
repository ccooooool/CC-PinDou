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
            "dop-input",
            size === "sm" && "h-8 px-3 text-xs rounded-xl",
            size === "default" && "h-10",
            allowClear && "pr-9",
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
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#C8C8D8] transition-colors hover:bg-[rgba(255,107,157,0.08)] hover:text-[var(--dop-pink)]"
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
