import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  value?: string
  onChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs components must be used inside <Tabs>")
  return ctx
}

export interface TabsProps {
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  children?: React.ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onChange, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const activeValue = value !== undefined ? value : internalValue

  const handleChange = (val: string) => {
    setInternalValue(val)
    onChange?.(val)
  }

  return (
    <TabsContext.Provider value={{ value: activeValue, onChange: handleChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabTrigger({ className, value, children, ...props }: TabTriggerProps) {
  const { value: activeValue, onChange } = useTabs()
  const isActive = activeValue === value

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-nook font-bold transition-all duration-200 ease-nook",
        isActive
          ? "bg-[var(--bg-surface)] text-ac-green shadow-tabs-active"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        className
      )}
      onClick={() => onChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

export interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabContent({ className, value, children, ...props }: TabContentProps) {
  const { value: activeValue } = useTabs()
  if (activeValue !== value) return null

  return (
    <div className={cn("mt-4 animate-slide-up", className)} {...props}>
      {children}
    </div>
  )
}
