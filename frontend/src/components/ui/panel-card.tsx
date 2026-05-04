import * as React from "react"
import { cn } from "@/lib/utils"

export interface PanelCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  icon?: React.ReactNode
  className?: string
  children?: React.ReactNode
}

export function PanelCard({
  title,
  icon,
  className,
  children,
  ...props
}: PanelCardProps) {
  return (
    <div className={cn("dop-panel-card", className)} {...props}>
      {title && (
        <div className="dop-panel-card-header">
          {icon && <span className="dop-panel-card-header-icon">{icon}</span>}
          <h3 className="dop-panel-card-header-title">{title}</h3>
        </div>
      )}
      <div className="dop-panel-card-body">{children}</div>
    </div>
  )
}
