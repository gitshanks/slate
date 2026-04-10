import * as React from "react"
import { Toaster as Sonner, toast } from "sonner"
import type { ToasterProps } from "sonner"

const SonnerToaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          "--normal-bg":     "hsl(var(--popover))",
          "--normal-text":   "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { SonnerToaster, toast }
