"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface UploaderProps {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
  onFiles?: (files: FileList) => void
}

function Uploader({
  accept,
  multiple,
  disabled,
  className,
  style,
  children,
  onFiles,
}: UploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = React.useState(false)

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) onFiles?.(files)
  }

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div
      className={cn(
        "nook-uploader",
        dragOver && "bg-[var(--nook-mint-8)] scale-[1.01]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={style}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {children || (
        <>
          <div className="nook-uploader-icon">📂</div>
          <div className="font-bold text-[var(--text-primary)]">点击或拖拽文件到这里</div>
          <div className="text-sm text-[var(--text-muted)] mt-1">支持 JPG、PNG，单个不超过 5MB</div>
        </>
      )}
    </div>
  )
}

export { Uploader }
