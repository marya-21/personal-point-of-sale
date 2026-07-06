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
        className={cn(
          "flex h-9 w-full rounded-md border border-n-200 bg-n-0 px-3 py-1 text-caption font-medium text-n-900 shadow-sm transition-colors",
          "placeholder:text-n-400",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/30 focus-visible:border-accent-600",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-n-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );

    if (label) {
      return (
        <div className="space-y-1.5">
          <label className="text-caption font-medium text-n-800">
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
