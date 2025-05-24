import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import {
  BadgeCheck,
  LogOut,
  MessageSquare,
  ChevronDown,
  Camera,
  X
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

// Note: The screenshot dialog is loaded as a script tag, not an ES6 import
// It will be available globally as window.ScreenshotDialog

// Declare the global ScreenshotDialog class
declare global {
  interface Window {
    ScreenshotDialog: any;
  }
}

// Add styles for better screenshot rendering
const screenshotStyles = `
  .screenshot-mode * {
    -webkit-font-smoothing: antialiased !important;
    -moz-osx-font-smoothing: grayscale !important;
    text-rendering: geometricPrecision !important;
    font-display: swap !important;
  }
  .screenshot-mode .text-sm {
    font-size: 14px !important;
    line-height: 20px !important;
  }
`;

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { isMobile } = useSidebar()
  const [savedScreenshot, setSavedScreenshot] = useState<string | null>(null);
  const screenshotDialogRef = useRef<any>(null);

  // Initialize vanilla JS screenshot dialog
  useEffect(() => {
    const loadScreenshotDialog = async () => {
      // Check if script is already loaded
      if (window.ScreenshotDialog) {
        screenshotDialogRef.current = new window.ScreenshotDialog();
        return;
      }

      // Load the script
      const script = document.createElement('script');
      script.src = '/libs/screenshot-dialog.js';
      script.onload = () => {
        if (window.ScreenshotDialog) {
          screenshotDialogRef.current = new window.ScreenshotDialog();
        }
      };
      script.onerror = () => {
        console.error('Failed to load screenshot dialog script');
      };
      document.head.appendChild(script);
    };

    if (typeof window !== 'undefined') {
      loadScreenshotDialog();
    }
  }, []);

  // Inject the screenshot styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = screenshotStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  const handleScreenshot = async () => {
    // Use the vanilla JS screenshot dialog's built-in capture functionality
    if (screenshotDialogRef.current) {
      await screenshotDialogRef.current.openWithScreenshot(handleSaveAnnotation);
    }
  };

  const handleThumbnailClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the screenshot button click
    // Open the dialog with the existing saved screenshot
    if (screenshotDialogRef.current && savedScreenshot) {
      screenshotDialogRef.current.annotatedImage = savedScreenshot;
      screenshotDialogRef.current.open(savedScreenshot, handleSaveAnnotation);
    }
  };

  const handleSaveAnnotation = (annotatedImageSrc: string | null) => {
    // Update the state regardless of whether the image is null or not
    // This allows the Delete button to properly clear the thumbnail
    setSavedScreenshot(annotatedImageSrc);
  };

  const handleRemoveThumbnail = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Reset all screenshot related state
    setSavedScreenshot(null);
    
    // Reset the dialog state if it provides a reset method
    if (screenshotDialogRef.current?.reset) {
      screenshotDialogRef.current.reset();
    }
  };

  // Always render a container with consistent height to prevent layout shifts
  return (
    <div className="border-t p-3 space-y-3 min-h-[104px]">
      {user ? (
        <>
          {/* Screenshot Button with Thumbnail - Hidden in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="relative flex items-center">
              <Button 
                variant="ghost"
                className="h-9 w-full justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex items-center"
                onClick={handleScreenshot}
              >
                <span className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>Screenshot</span>
                </span>
                <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">S</span>
              </Button>
              
              {savedScreenshot && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2 w-7 h-7 relative">
                  <img 
                    src={savedScreenshot} 
                    alt="Recent screenshot" 
                    className="w-7 h-7 object-cover rounded-md cursor-pointer"
                    onClick={handleThumbnailClick}
                    crossOrigin="anonymous"
                  />
                  <button
                    onClick={handleRemoveThumbnail}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    aria-label="Remove screenshot"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
          
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
                      <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name || user.email} className="h-full w-full object-cover rounded-full" crossOrigin="anonymous" />
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
                      <img src={user.user_metadata.avatar_url} alt={user.user_metadata?.full_name || user.email} className="h-full w-full object-cover rounded-full" crossOrigin="anonymous" />
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
          <div className="h-9 w-full rounded-md bg-muted/20 animate-pulse"></div>
        </div>
      )}
    </div>
  )
}