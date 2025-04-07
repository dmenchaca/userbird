import { useEffect } from 'react'
import { useAuth } from '@/lib/auth';
import { initUserbird } from '@/lib/userbird';
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

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { isMobile } = useSidebar()
  
  useEffect(() => {
    async function loadWidget() {
      try {
        // Add user information
        window.UserBird = window.UserBird || {};
        window.UserBird.formId = "4hNUB7DVhf";
        window.UserBird.user = user ? {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email
        } : undefined;
        
        await initUserbird("4hNUB7DVhf");
      } catch (error) {
        console.error('Failed to load Userbird widget:', error);
      }
    }
    
    if (user) {
      loadWidget();
    }
  }, [user]);

  if (!user) return null

  // Get user display name from Google metadata
  const displayName = user.user_metadata?.full_name || user.email
  const initials = displayName?.[0].toUpperCase() || 'U'
  const avatarUrl = user.user_metadata?.avatar_url

  return (
    <div className="border-t p-3 space-y-3">
      {/* Feedback Button */}
      <Button 
        id="userbird-trigger-4hNUB7DVhf"
        variant="ghost"
        className="h-9 w-full justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center"
      >
        <span className="flex items-center gap-2" style={{ pointerEvents: 'none' }}>
          <MessageSquare className="h-4 w-4" />
          <span>Feedback</span>
        </span>
        <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">F</span>
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
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="rounded-full text-xs">{initials}</AvatarFallback>
                )}
              </Avatar>
              <span className="truncate">{displayName}</span>
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
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="rounded-full">{initials}</AvatarFallback>
                )}
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">{displayName}</span>
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
          <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}