"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface ToastProps {
  id: string
  title?: string
  description?: string
  variant?: "success" | "error" | "info"
  icon?: React.ReactNode
  duration?: number
  onClose?: (id: string) => void
}

const variantIconMap: Record<string, React.ReactNode> = {
  success: "🌿",
  error: "💝",
  info: "💧",
}

function ToastItem({
  id,
  title,
  description,
  variant = "info",
  icon,
  duration = 3000,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose?.(id), 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  return (
    <div
      className={cn(
        "nook-toast transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      <div className={cn("nook-toast-icon", variant)}>
        {icon || variantIconMap[variant]}
      </div>
      <div className="nook-toast-content">
        {title && <div className="nook-toast-title">{title}</div>}
        {description && <div className="nook-toast-desc">{description}</div>}
      </div>
      <button
        type="button"
        className="nook-toast-close"
        onClick={() => {
          setVisible(false)
          setTimeout(() => onClose?.(id), 300)
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/* ---------- Toast Provider ---------- */
interface ToastItemData {
  id: string
  title?: string
  description?: string
  variant?: "success" | "error" | "info"
  icon?: React.ReactNode
  duration?: number
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastItemData, "id">) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>")
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItemData[]>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const addToast = React.useCallback((toast: Omit<ToastItemData, "id">) => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [...prev, { id, ...toast }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const portalContent = (
    <div className="nook-sonner">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          id={t.id}
          title={t.title}
          description={t.description}
          variant={t.variant}
          icon={t.icon}
          duration={t.duration}
          onClose={removeToast}
        />
      ))}
    </div>
  )

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {mounted && createPortal(portalContent, document.body)}
    </ToastContext.Provider>
  )
}
