import * as React from "react"
import { cn } from "@/lib/utils"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger"
  icon?: React.ReactNode
}

const variantClassMap: Record<string, string> = {
  info: "nook-alert-info",
  success: "nook-alert-success",
  warning: "nook-alert-warning",
  danger: "nook-alert-danger",
}

function Alert({
  className,
  variant = "info",
  icon,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      className={cn("nook-alert", variantClassMap[variant], className)}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <div className="flex-1">{children}</div>
    </div>
  )
}

export { Alert }
