import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    error?: boolean
}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
    ({ className, error = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex items-center overflow-hidden rounded-md border bg-background transition-colors",
                    error
                        ? "border-destructive focus-within:border-destructive"
                        : "border-input focus-within:border-ring focus-within:ring-ring",
                    className
                )}
                {...props}
            />
        )
    }
)
InputGroup.displayName = "InputGroup"

interface InputGroupInputProps extends React.ComponentProps<typeof Input> { }

const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
    ({ className, ...props }, ref) => {
        return (
            <Input
                ref={ref}
                className={cn(
                    "h-9 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    className
                )}
                {...props}
            />
        )
    }
)
InputGroupInput.displayName = "InputGroupInput"

interface InputGroupButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

const InputGroupButton = React.forwardRef<HTMLButtonElement, InputGroupButtonProps>(
    ({ className, type = "button", ...props }, ref) => {
        return (
            <button
                ref={ref}
                type={type}
                className={cn(
                    "flex h-9 items-center justify-center px-3 text-muted-foreground transition-colors hover:text-foreground",
                    className
                )}
                {...props}
            />
        )
    }
)
InputGroupButton.displayName = "InputGroupButton"

export { InputGroup, InputGroupInput, InputGroupButton }
