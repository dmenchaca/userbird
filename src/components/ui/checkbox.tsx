"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    indeterminate?: boolean;
  }
>(({ className, indeterminate, ...props }, ref) => {
  // If indeterminate, render the Minus icon directly
  if (indeterminate) {
    return (
      <div 
        role="checkbox"
        aria-checked="mixed"
        className={cn(
          "peer h-4 w-4 shrink-0 flex items-center justify-center border border-primary bg-primary text-primary-foreground rounded-sm",
          className
        )}
        onClick={() => {
          if (props.onCheckedChange) {
            props.onCheckedChange(true);
          }
        }}
      >
        <Minus className="h-3 w-3" />
      </div>
    )
  }
  
  // Regular checkbox for checked/unchecked states
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-muted-foreground/30 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground hover:border-muted-foreground/50 transition-colors",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-3 w-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox } 