import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-4 py-[5px] text-sm font-nook font-bold transition-all duration-300 ease-nook shadow-soft hover:-translate-y-0.5 hover:scale-105 hover:shadow-colored active:scale-95 active:translate-y-0",
  {
    variants: {
      variant: {
        default: "bg-ac-green/15 text-ac-green-dark",
        blue: "bg-ac-blue/15 text-ac-blue-dark",
        yellow: "bg-ac-yellow/20 text-nook-brown",
        coral: "bg-ac-coral/15 text-ac-coral-dark",
        ghost: "bg-transparent border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-ac-green hover:text-ac-green hover:shadow-soft",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/* 拼豆兼容 variant 映射 */
const pindouVariantMap: Record<string, string> = {
  default: "default",
  secondary: "ghost",
  destructive: "coral",
  outline: "ghost",
  pink: "default",
  blue: "blue",
  yellow: "yellow",
  orange: "coral",
  teal: "default",
  green: "default",
  red: "coral",
  lavender: "default",
}

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

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const mapped = pindouVariantMap[variant] || variant
  return (
    <div
      className={cn(badgeVariants({ variant: mapped as any, className }))}
      {...props}
    />
  )
}

export { Badge }
