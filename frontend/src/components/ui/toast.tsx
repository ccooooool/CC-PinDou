"use client"

import { Toaster as SonnerToaster, toast } from "sonner"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  NookUI-styled Sonner Toaster                                       */
/* ------------------------------------------------------------------ */

interface ToasterProps {
  position?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "top-center"
    | "bottom-center"
  richColors?: boolean
  expand?: boolean
  duration?: number
  visibleToasts?: number
  closeButton?: boolean
  className?: string
}

function Toaster({
  position = "top-center",
  richColors = false,
  expand = false,
  duration = 3000,
  visibleToasts = 4,
  closeButton = true,
  className,
}: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      richColors={richColors}
      expand={expand}
      duration={duration}
      visibleToasts={visibleToasts}
      closeButton={closeButton}
      className={cn("nook-toaster", className)}
      style={{
        // 使用 Sonner 默认堆叠行为
      }}
      toastOptions={{
        style: {
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          gap: '10px',
          boxShadow: 'var(--shadow-toast)',
        },
        classNames: {
          toast:
            "nook-toast-item group !rounded-[var(--radius-md)] !border !border-[var(--border-default)] !bg-[var(--bg-surface)] !shadow-[var(--shadow-toast)] font-nook !p-3.5 !pr-10 !gap-2.5",
          title: "nook-toast-title !text-[var(--text-heading)] !font-semibold !text-sm",
          description: "nook-toast-desc !text-[var(--text-secondary)] !text-xs !leading-relaxed",
          actionButton:
            "nook-toast-action !rounded-button !bg-ac-green !text-white !font-semibold !text-xs !px-4 !py-1.5 hover:!-translate-y-0.5 !transition-transform",
          cancelButton:
            "nook-toast-cancel !rounded-button !bg-[var(--bg-surface-alt)] !text-[var(--text-secondary)] !font-semibold !text-xs !px-4 !py-1.5 hover:!-translate-y-0.5 !transition-transform",
          closeButton:
            "nook-toast-close !absolute !top-1/2 !-translate-y-1/2 !right-2.5 !opacity-100 !text-[var(--text-muted)] hover:!text-[var(--text-heading)] hover:!scale-110 hover:!bg-[var(--bg-surface-alt)] !transition-all !w-6 !h-6 !rounded-full !flex !items-center !justify-center !p-0",
          success:
            "!border-l-4 !border-l-[var(--ac-green)] !border-t-[var(--border-default)] !border-r-[var(--border-default)] !border-b-[var(--border-default)]",
          error:
            "!border-l-4 !border-l-[var(--ac-coral)] !border-t-[var(--border-default)] !border-r-[var(--border-default)] !border-b-[var(--border-default)]",
          info:
            "!border-l-4 !border-l-[var(--ac-blue)] !border-t-[var(--border-default)] !border-r-[var(--border-default)] !border-b-[var(--border-default)]",
          warning:
            "!border-l-4 !border-l-[var(--ac-yellow)] !border-t-[var(--border-default)] !border-r-[var(--border-default)] !border-b-[var(--border-default)]",
          loading:
            "!border-l-4 !border-l-[var(--ac-green)] !border-t-[var(--border-default)] !border-r-[var(--border-default)] !border-b-[var(--border-default)]",
        },
      }}
      icons={{
        success: <IconWrap color="var(--ac-green)" bg="rgba(43,180,171,0.12)"><SuccessIcon /></IconWrap>,
        error: <IconWrap color="var(--ac-coral)" bg="rgba(252,77,80,0.12)"><ErrorIcon /></IconWrap>,
        info: <IconWrap color="var(--ac-blue)" bg="rgba(87,131,247,0.12)"><InfoIcon /></IconWrap>,
        warning: <IconWrap color="var(--ac-yellow)" bg="rgba(255,207,1,0.15)"><WarningIcon /></IconWrap>,
        loading: <IconWrap color="var(--ac-green)" bg="rgba(43,180,171,0.12)"><LoadingIcon /></IconWrap>,
      }}
    />
  )
}

/* ---------- Icon wrapper with NookUI circular bg ---------- */

function IconWrap({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 32,
        height: 32,
        background: bg,
        color,
      }}
    >
      {children}
    </div>
  )
}

/* ---------- Lucide-style inline icons ---------- */

function SuccessIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

function LoadingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ animationDuration: "1s" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

/* ---------- Legacy compatibility layer ---------- */

/** @deprecated Use `toast.success()` / `toast.error()` / `toast()` directly instead. */
function useToast() {
  return {
    addToast: (opts: {
      title?: string
      description?: string
      variant?: "success" | "error" | "info"
      duration?: number
    }) => {
      const { title, description, variant = "info", duration = 3000 } = opts
      const msg = title ? (
        <div>
          <div className="font-semibold">{title}</div>
          {description && (
            <div className="text-sm text-[var(--text-secondary)]">{description}</div>
          )}
        </div>
      ) : (
        description || ""
      )
      if (variant === "success") toast.success(msg, { duration })
      else if (variant === "error") toast.error(msg, { duration })
      else toast(msg, { duration })
    },
  }
}

/** @deprecated Use `<Toaster />` from sonner instead. */
function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}

export { Toaster, ToastProvider, useToast, toast }
export default Toaster
