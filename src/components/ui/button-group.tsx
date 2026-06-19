import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonGroupVariants = cva("flex", {
  variants: {
    orientation: {
      horizontal: "flex-row gap-2",
      vertical: "flex-col gap-2",
    },
    size: {
      default: "",
      sm: "gap-1",
      lg: "gap-3",
    },
    fullWidth: {
      true: "w-full",
      false: "w-auto",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
    size: "default",
    fullWidth: false,
  },
})

export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof buttonGroupVariants> {
  children: React.ReactNode
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation, size, fullWidth, children, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      className={cn(
        buttonGroupVariants({ orientation, size, fullWidth }),
        className
      )}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // Jika fullWidth, buat child button mengambil space yang sama
          return React.cloneElement(child, {
            className: cn(
              child.props.className,
              fullWidth && orientation === "horizontal" && "flex-1"
            ),
          } as React.HTMLAttributes<HTMLElement>)
        }
        return child
      })}
    </div>
  )
)
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup, buttonGroupVariants }
