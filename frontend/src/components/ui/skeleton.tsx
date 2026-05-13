import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("nook-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
