import * as React from "react"
import { Loader2 } from "lucide-react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-nook font-semibold transition-all duration-300 ease-nook focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden active:scale-[0.96]",
  {
    variants: {
      variant: {
        primary:   "rounded-button px-7 py-3",
        secondary: "rounded-button px-7 py-3 bg-transparent",
        ghost:     "rounded-button px-7 py-3 bg-transparent",
        text:      "bg-transparent px-2 py-1",
        link:      "underline-offset-4 hover:underline bg-transparent px-2 py-1",
        dashed:    "border-2 border-dashed bg-transparent rounded-button px-7 py-3",
        '3d':      "bg-[var(--bg-surface)] shadow-3d-btn hover:shadow-3d-btn-hover hover:-translate-y-[1px] active:shadow-3d-btn-active active:translate-y-[2px] rounded-button px-7 py-3 border border-[var(--border-default)]",
        icon:      "rounded-full h-10 w-10 p-0 flex items-center justify-center",
      },
      color: {
        green:  "",
        blue:   "",
        coral:  "",
        yellow: "",
        none:   "",
      },
      size: {
        default: "text-base",
        sm:      "text-sm px-5 py-2",
        lg:      "text-lg px-10 py-4",
      },
    },
    compoundVariants: [
      // primary / icon: 填充色 + 边框 + 阴影
      { variant: ["primary", "icon"], color: "green",  class: "bg-ac-green text-white border-[4px] border-btn-ring-green shadow-btn-green hover:-translate-y-[3px] hover:shadow-btn-green-hover active:translate-y-0 active:shadow-none" },
      { variant: ["primary", "icon"], color: "blue",   class: "bg-ac-blue text-white border-[4px] border-btn-ring-blue shadow-btn-blue hover:-translate-y-[3px] hover:shadow-btn-blue-hover active:translate-y-0 active:shadow-none" },
      { variant: ["primary", "icon"], color: "coral",  class: "bg-ac-coral text-white border-[4px] border-btn-ring-coral shadow-btn-coral hover:-translate-y-[3px] hover:shadow-btn-coral-hover active:translate-y-0 active:shadow-none" },
      { variant: ["primary", "icon"], color: "yellow", class: "bg-ac-yellow text-nook-brown border-[4px] border-btn-ring-yellow shadow-btn-yellow hover:-translate-y-[3px] hover:shadow-btn-yellow-hover active:translate-y-0 active:shadow-none" },
      // secondary / ghost
      { variant: ["secondary", "ghost"], color: "green", class: "border-[3px] border-[var(--ac-green)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] hover:-translate-y-[3px] active:translate-y-0" },
      { variant: ["secondary", "ghost"], color: "blue",  class: "border-[3px] border-[var(--ac-blue)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] hover:-translate-y-[3px] active:translate-y-0" },
      { variant: ["secondary", "ghost"], color: "coral", class: "border-[3px] border-[var(--ac-coral)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] hover:-translate-y-[3px] active:translate-y-0" },
      // text
      { variant: "text", color: "none", class: "text-[var(--text-secondary)] hover:text-[var(--text-primary)]" },
      // link
      { variant: "link", color: "green", class: "text-ac-green" },
      { variant: "link", color: "blue",  class: "text-ac-blue" },
      { variant: "link", color: "coral", class: "text-ac-coral" },
      // dashed
      { variant: "dashed", color: "none", class: "border-[var(--border-default)] text-[var(--text-primary)] hover:border-ac-green hover:text-ac-green" },
    ],
    defaultVariants: {
      variant: "primary",
      color: "green",
      size: "default",
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "text" | "link" | "dashed" | "3d" | "icon"
  color?: "green" | "blue" | "coral" | "yellow" | "none"
  size?: "default" | "sm" | "lg"
  loading?: boolean
  block?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      color,
      size = "default",
      loading,
      block,
      children,
      disabled,
      onClick,
      ...props
    },
    forwardedRef
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    React.useImperativeHandle(forwardedRef, () => {
      if (!buttonRef.current) {
        throw new Error("Button ref is not attached to a DOM element")
      }
      return buttonRef.current
    })

    // 自动推断颜色：primary 默认 green，danger 场景可用 coral
    const resolvedColor = color ?? (
      variant === "primary" || variant === "icon" ? "green" :
      variant === "secondary" || variant === "ghost" ? "green" :
      variant === "link" ? "green" :
      "none"
    )

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (loading || disabled) return
        onClick?.(e)

        const btn = buttonRef.current
        if (!btn) return

        const rect = btn.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const ripple = document.createElement("span")
        ripple.className = "absolute rounded-full pointer-events-none animate-ripple-splash"
        ripple.style.left = `${x}px`
        ripple.style.top = `${y}px`
        ripple.style.width = "20px"
        ripple.style.height = "20px"

        const isGhost =
          variant === "ghost" || variant === "secondary"
        const isNight =
          typeof document !== "undefined" &&
          document.documentElement.dataset.theme === "night"
        if (isGhost) {
          ripple.style.backgroundColor = isNight
            ? "rgba(240, 236, 248, 0.15)"
            : "rgba(93, 64, 55, 0.15)"
        } else {
          ripple.style.backgroundColor = "rgba(255, 255, 255, 0.45)"
        }

        btn.appendChild(ripple)
        setTimeout(() => ripple.remove(), 500)
      },
      [onClick, variant, loading, disabled]
    )

    return (
      <button
        className={cn(
          buttonVariants({ variant, color: resolvedColor, size, className }),
          block && "w-full",
          loading && "cursor-wait"
        )}
        ref={buttonRef}
        onClick={handleClick}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
