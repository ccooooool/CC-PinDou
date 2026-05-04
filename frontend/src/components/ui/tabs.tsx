"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs components must be used inside <Tabs>")
  return ctx
}

/* ---------- Tabs ---------- */
interface TabsProps {
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  children?: React.ReactNode
  className?: string
}

function Tabs({ defaultValue, value, onChange, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const activeTab = value !== undefined ? value : internalValue
  const setActiveTab = (v: string) => {
    setInternalValue(v)
    onChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("nook-tabs", className)}>{children}</div>
    </TabsContext.Provider>
  )
}

/* ---------- TabTrigger ---------- */
interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  children?: React.ReactNode
}

function TabTrigger({ value, children, className, ...props }: TabTriggerProps) {
  const { activeTab, setActiveTab } = useTabs()
  return (
    <button
      type="button"
      className={cn("nook-tab", activeTab === value && "active", className)}
      onClick={() => setActiveTab(value)}
      {...props}
    >
      {children}
    </button>
  )
}

/* ---------- TabContent ---------- */
interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  children?: React.ReactNode
}

function TabContent({ value, children, className, ...props }: TabContentProps) {
  const { activeTab } = useTabs()
  if (activeTab !== value) return null
  return (
    <div className={cn("nook-tab-panel active", className)} {...props}>
      {children}
    </div>
  )
}

export { Tabs, TabTrigger, TabContent }
