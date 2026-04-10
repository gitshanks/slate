import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const skeletonVariants = cva("skeleton animate-pulse bg-muted", {
  variants: {
    shape: {
      text:   "h-4 w-full rounded",
      circle: "rounded-full",
      rect:   "rounded-md",
      avatar: "rounded-full",
      button: "rounded-md",
    },
  },
  defaultVariants: { shape: "rect" },
})

interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number
  height?: string | number
}

function Skeleton({ className, shape, width, height, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(skeletonVariants({ shape }), className)}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}

/** Pre-built skeleton card */
function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4 shadow">
      <div className="flex items-center space-x-4">
        <Skeleton shape="avatar" className="h-12 w-12" />
        <div className="space-y-2 flex-1">
          <Skeleton shape="text" className="h-4 w-1/2" />
          <Skeleton shape="text" className="h-3 w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton shape="text" />
        <Skeleton shape="text" className="w-4/5" />
        <Skeleton shape="text" className="w-3/5" />
      </div>
    </div>
  )
}

/** Pre-built skeleton table row */
function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} shape="text" className="h-4 flex-1" />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonTableRow }
