import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  themeColor?: string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, themeColor, ...props }, ref) => {
  const thumbBorder = themeColor || 'var(--color-primary)';
  const rangeBg = themeColor || 'var(--color-primary)';

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-[var(--bg-surface-alt)]">
        <SliderPrimitive.Range
          className="absolute h-full rounded-full"
          style={{ background: rangeBg }}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block h-5 w-5 rounded-full border-[3px] bg-white shadow-md",
          "transition-all duration-200 ease-nook",
          "hover:scale-125 hover:shadow-lg",
          "active:scale-110",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          "cursor-grab active:cursor-grabbing"
        )}
        style={{ borderColor: thumbBorder }}
      />
    </SliderPrimitive.Root>
  );
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
