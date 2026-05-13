import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const cardVariants = cva(
  "relative overflow-hidden bg-[var(--bg-surface)] border-[3px] border-transparent p-8 transition-all duration-500 ease-nook before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[6px] before:opacity-0 before:transition-opacity before:duration-500 before:ease-nook before:content-[''] hover:before:opacity-100",
  {
    variants: {
      variant: {
        default:
          "rounded-card shadow-soft hover:shadow-card-hover hover:-translate-y-2 hover:scale-[1.02] hover:border-ac-green before:bg-ac-green",
        blue:
          "rounded-card shadow-soft hover:shadow-card-hover-blue hover:-translate-y-2 hover:scale-[1.02] hover:border-ac-blue before:bg-ac-blue",
        green:
          "rounded-card shadow-soft hover:shadow-card-hover-green hover:-translate-y-2 hover:scale-[1.02] hover:border-ac-green before:bg-ac-green",
        coral:
          "rounded-card shadow-soft hover:shadow-card-hover-coral hover:-translate-y-2 hover:scale-[1.02] hover:border-ac-coral before:bg-ac-coral",
        yellow:
          "rounded-card shadow-soft hover:shadow-card-hover-yellow hover:-translate-y-2 hover:scale-[1.02] hover:border-ac-yellow before:bg-ac-yellow",
        ghost:
          "rounded-card border-[3px] border-dashed border-[var(--border-default)] hover:border-ac-green before:hidden",
        "3d":
          "rounded-card shadow-[0_4px_10px_rgba(107,92,67,0.42)] shadow-3d-btn hover:shadow-[0_8px_24px_rgba(107,92,67,0.3)] hover:shadow-3d-btn-hover hover:-translate-y-1 active:shadow-[0_1px_4px_rgba(107,92,67,0.2)] active:shadow-3d-btn-active active:translate-y-[4px] before:hidden",
        wonky:
          "rounded-[40px_35px_45px_38px/38px_45px_35px_40px] shadow-soft hover:shadow-card-hover hover:-translate-y-2 hover:scale-[1.02] hover:rounded-[38px_45px_35px_40px/40px_35px_45px_38px] hover:border-ac-green before:bg-ac-green",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-nook font-bold leading-none tracking-tight text-[var(--text-heading)]",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--text-caption)]", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
