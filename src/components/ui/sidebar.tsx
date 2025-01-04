import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sidebarMenuButtonVariants = cva(
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
  {
    variants: {
      size: {
        default: "h-9",
        lg: "h-11",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuButtonVariants> {}

const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(sidebarMenuButtonVariants({ size, className }))}
      {...props}
    />
  )
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-auto", className)} {...props} />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-3 pb-3", className)} {...props} />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

export function useSidebar() {
  const isMobile = window.innerWidth < 768
  return { isMobile }
}

export { SidebarMenu, SidebarMenuItem, SidebarMenuButton }