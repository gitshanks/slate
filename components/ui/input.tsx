import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const inputVariants = cva(
  "flex w-full rounded-md border bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
  {
    variants: {
      inputSize: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-3 py-2",
        lg: "h-12 px-4 text-base",
      },
      state: {
        default: "border-input",
        error:   "border-destructive focus-visible:ring-destructive",
        success: "border-success focus-visible:ring-success",
      },
    },
    defaultVariants: { inputSize: "md", state: "default" },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  inputSize?: "sm" | "md" | "lg"
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  leadingAddon?: string
  trailingAddon?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      inputSize,
      state,
      leadingIcon,
      trailingIcon,
      leadingAddon,
      trailingAddon,
      ...props
    },
    ref
  ) => {
    if (leadingIcon || trailingIcon || leadingAddon || trailingAddon) {
      return (
        <div className="relative flex items-center">
          {leadingAddon && (
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground h-10">
              {leadingAddon}
            </span>
          )}
          {leadingIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
              {leadingIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              inputVariants({ inputSize, state }),
              leadingIcon && "pl-9",
              trailingIcon && "pr-9",
              leadingAddon && "rounded-l-none",
              trailingAddon && "rounded-r-none",
              className
            )}
            ref={ref}
            {...props}
          />
          {trailingIcon && (
            <div className="pointer-events-none absolute right-3 flex items-center text-muted-foreground">
              {trailingIcon}
            </div>
          )}
          {trailingAddon && (
            <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground h-10">
              {trailingAddon}
            </span>
          )}
        </div>
      )
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ inputSize, state }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
