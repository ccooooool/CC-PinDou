import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

// 模块级计数器：跟踪当前打开的 Modal 数量，避免多 Modal 嵌套时 body.overflow 互相覆盖
let _modalOpenCount = 0

function _lockBodyScroll() {
  _modalOpenCount++
  if (_modalOpenCount === 1) {
    document.body.style.overflow = "hidden"
  }
}

function _unlockBodyScroll() {
  _modalOpenCount = Math.max(0, _modalOpenCount - 1)
  if (_modalOpenCount === 0) {
    document.body.style.overflow = ""
  }
}

export interface ModalProps {
  open?: boolean
  title?: React.ReactNode
  onClose?: () => void
  footer?: React.ReactNode
  children?: React.ReactNode
  className?: string
  width?: number | string
}

export function Modal({
  open,
  onClose,
  title,
  footer,
  children,
  className,
  width = 420,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false)
  const modalRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  React.useEffect(() => {
    if (open) {
      _lockBodyScroll()
      return () => _unlockBodyScroll()
    }
  }, [open])

  // Escape 关闭
  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // 打开时聚焦到 modal
  React.useEffect(() => {
    if (open) {
      modalRef.current?.focus()
    }
  }, [open])

  if (!mounted || !open) return null

  const isTitleString = typeof title === "string"

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative bg-[var(--bg-surface)] rounded-card border-4 border-ac-green shadow-modal w-full overflow-hidden animate-pop outline-none",
          className
        )}
        style={{
          maxWidth: typeof width === "number" ? `${width}px` : width,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-10">
          {title && (
            <div className="flex items-center justify-between mb-6">
              {isTitleString ? (
                <h3 className="text-xl font-nook font-bold text-[var(--text-heading)]">
                  {title}
                </h3>
              ) : (
                <div>{title}</div>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full border-none bg-[var(--border-default)] text-[var(--text-body)] cursor-pointer transition-all duration-200 ease-nook grid place-items-center hover:bg-[var(--border-strong)] hover:rotate-90 shrink-0 ml-4"
                  aria-label="关闭"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          <div>{children}</div>

          {footer && (
            <div className="flex items-center justify-end gap-3 mt-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
