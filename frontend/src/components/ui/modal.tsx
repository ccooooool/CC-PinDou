import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

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
  title,
  onClose,
  footer,
  children,
  className,
  width = 420,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!mounted) return null

  const modalContent = (
    <div className={cn("dop-modal-overlay", open && "open")}>
      <div
        className={cn("dop-modal", className)}
        style={{ width }}
      >
        {title && (
          <div className="dop-modal-header">
            <h3 className="dop-modal-title">{title}</h3>
            {onClose && (
              <button onClick={onClose} className="dop-modal-close">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        <div className="dop-modal-body">{children}</div>
        {footer && <div className="dop-modal-footer">{footer}</div>}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
