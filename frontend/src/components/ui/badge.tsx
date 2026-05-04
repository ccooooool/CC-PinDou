import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "pink"
    | "blue"
    | "yellow"
    | "orange"
    | "teal"
    | "green"
    | "red"
    | "lavender"
}

const variantClassMap: Record<string, string> = {
  default: "dop-badge",
  secondary: "dop-badge",
  destructive: "dop-badge-coral",
  outline: "dop-badge",
  pink: "dop-badge-pink",
  blue: "dop-badge-sky",
  yellow: "dop-badge-lemon",
  orange: "dop-badge-coral",
  teal: "dop-badge-mint",
  green: "dop-badge-mint",
  red: "dop-badge-coral",
  lavender: "dop-badge",
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn("dop-badge", variantClassMap[variant], className)}
      {...props}
    />
  )
}

export { Badge }
