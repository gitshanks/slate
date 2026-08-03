import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
        outline:     "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        success:     "bg-success text-success-foreground hover:bg-success/90 shadow-sm",
        warning:     "bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm",
        link:        "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm:        "h-8 px-3 text-xs rounded-md",
        md:        "h-10 px-4 py-2",
        lg:        "h-11 px-8 text-base rounded-md",
        icon:      "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="loading-spinner mr-2 h-4 w-4" />
        ) : leftIcon ? (
          <span className="mr-2 flex shrink-0 items-center">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon && (
          <span className="ml-2 flex shrink-0 items-center">{rightIcon}</span>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button }
