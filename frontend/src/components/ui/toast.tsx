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
      toastOptions={{
        classNames: {
          toast:
            "nook-toast-item group rounded-[20px] border-[3px] bg-[var(--bg-surface)] shadow-toast font-nook",
          title: "nook-toast-title text-[var(--text-heading)] font-semibold",
          description: "nook-toast-desc text-[var(--text-secondary)] text-sm",
          actionButton:
            "nook-toast-action rounded-button bg-ac-green text-white font-semibold hover:-translate-y-0.5 transition-transform",
          cancelButton:
            "nook-toast-cancel rounded-button bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] font-semibold hover:-translate-y-0.5 transition-transform",
          closeButton:
            "nook-toast-close text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:scale-110 transition-all",
          success:
            "border-[var(--ac-green)] !bg-[var(--ac-green)]/10",
          error:
            "border-[var(--ac-coral)] !bg-[var(--ac-coral)]/10",
          info:
            "border-[var(--ac-blue)] !bg-[var(--ac-blue)]/10",
          warning:
            "border-[var(--ac-yellow)] !bg-[var(--ac-yellow)]/10",
        },
      }}
      icons={{
        success: <SuccessIcon />,
        error: <ErrorIcon />,
        info: <InfoIcon />,
        warning: <WarningIcon />,
        loading: <LoadingIcon />,
      }}
    />
  )
}

/* ---------- Lucide-style inline icons (no extra deps) ---------- */

function SuccessIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ac-green)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ac-coral)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ac-blue)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ac-yellow)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

function LoadingIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ac-green)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      style={{ animationDuration: "1s" }}
    >
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
