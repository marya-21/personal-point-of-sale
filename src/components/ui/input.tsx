import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    const isInvalid = error || props["aria-invalid"] === true

    const inputElement = (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border bg-n-0 px-3 py-1 text-caption font-medium text-n-900 transition-colors",
          "placeholder:text-n-400",
          "focus-visible:outline-none",
          isInvalid
            ? "border-destructive focus-visible:border-destructive focus-visible:ring-0"
            : "border-input focus-visible:border-n-400 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-n-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );

    if (label) {
      return (
        <div className="flex flex-col gap-2">
          <label className="text-caption font-semibold text-n-700">
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
