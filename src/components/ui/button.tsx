import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-body font-semibold cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-accent-700 active:scale-[0.98]",
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-accent-700 active:scale-[0.98]",
        destructive:
          "bg-danger text-n-0 shadow-sm hover:bg-danger/90 active:scale-[0.98]",
        outline:
          "border border-n-200 bg-n-0 text-n-700 shadow-sm hover:bg-n-50 hover:border-n-300 active:scale-[0.98]",
        secondary:
          "bg-n-100 text-n-700 shadow-sm hover:bg-n-200 active:scale-[0.98]",
        ghost:
          "text-n-500 hover:bg-n-100 hover:text-n-900",
        link:
          "text-primary underline-offset-4 hover:underline",
        success:
          "bg-success-bg text-success border border-success-bd hover:bg-success/10 active:scale-[0.98]",
        warning:
          "bg-warning-bg text-warning border border-warning-bd hover:bg-warning/10 active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2 rounded-md",
        sm: "h-8 px-3 text-caption rounded-md",
        lg: "h-10 px-6 rounded-lg",
        icon: "h-9 w-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="animate-spin" />}
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
