import { useAuth } from '@/lib/auth';
import {
  BadgeCheck,
  LogOut,
  MessageSquare,
  ChevronDown,
} from "lucide-react"
import {
  Avatar,
  AvatarFallback
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSidebar } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { isMobile } = useSidebar()

  // Always render a container with consistent height to prevent layout shifts
  return (
    <div className="border-t p-3 space-y-3 min-h-[104px]">
      {user ? (
        <>
          {/* Feedback Button */}
          <Button 
            id="userbird-trigger-4hNUB7DVhf"
            variant="ghost"
            className="h-9 w-full justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center"
          >
            <span className="flex items-center gap-2 pointer-events-none">
              <MessageSquare className="h-4 w-4 pointer-events-none" />
              <span className="pointer-events-none">Feedback</span>
            </span>
            <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground pointer-events-none">F</span>
          </Button>
          
          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 w-full justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm bg-transparent data-[placeholder]:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
              >
                <span className="flex items-center gap-2">
                  <Avatar className="h-5 w-5 rounded-full">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name || user.email} className="h-full w-full object-cover rounded-full" />
                    ) : (
                      <AvatarFallback className="rounded-full text-xs">{user.user_metadata?.full_name?.[0].toUpperCase() || user.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
                    )}
                  </Avatar>
                  <span className="truncate">{user.user_metadata?.full_name || user.email}</span>
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width]"
              side={isMobile ? "top" : "top"}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-full">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name || user.email} className="h-full w-full object-cover rounded-full" />
                    ) : (
                      <AvatarFallback className="rounded-full">{user.user_metadata?.full_name?.[0].toUpperCase() || user.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold">{user.user_metadata?.full_name || user.email}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Account
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <ThemeToggle />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        // Render placeholder skeleton to maintain the same height
        <div className="space-y-3">
          <div className="h-9 w-full rounded-md bg-muted/20 animate-pulse"></div>
          <div className="h-9 w-full rounded-md bg-muted/20 animate-pulse"></div>
        </div>
      )}
    </div>
  )
}