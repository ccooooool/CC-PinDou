import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("dop-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
