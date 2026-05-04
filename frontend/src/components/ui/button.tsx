import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "danger"
    | "ghost"
    | "text"
  size?: "default" | "sm" | "lg" | "icon"
  loading?: boolean
  block?: boolean
}

const variantClassMap: Record<string, string> = {
  primary: "dop-btn-primary",
  default: "dop-btn-secondary",
  secondary: "dop-btn-secondary",
  danger: "dop-btn-danger",
  ghost: "dop-btn-ghost",
  text: "dop-btn-ghost",
}

const sizeClassMap: Record<string, string> = {
  default: "",
  sm: "dop-btn-sm",
  lg: "dop-btn-lg",
  icon: "dop-btn w-10 h-10",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading,
      block,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={cn(
          "dop-btn",
          variantClassMap[variant],
          sizeClassMap[size],
          block && "w-full",
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
