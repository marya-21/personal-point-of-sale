import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}



const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, ...props }, ref) => {

    const inputElement = (
      <input
        type={type}
        className={cn("flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)}
        ref={ref}
        {...props}
      />
    );

    if (label) {
      return (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
          {inputElement}
        </div>
      )
    }

    return (inputElement)
  }
)
Input.displayName = "Input"

export { Input }
