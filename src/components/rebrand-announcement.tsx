import { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'usermonk-rebrand-dismissed';

export function RebrandAnnouncement() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed this announcement
    const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setIsVisible(!isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <Alert className="rounded-none border-l-0 border-r-0 border-t-0 bg-background border-border shadow-sm">
        <div className="flex items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Megaphone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <AlertDescription className="text-sm font-medium text-foreground m-0 flex flex-wrap items-center gap-1">
              <span>
                <span className="text-muted-foreground">Userbird is now</span>{' '}
                <span className="font-bold text-foreground bg-accent px-2 py-0.5 rounded-md">Usermonk</span>{' '}
              </span>
              <span className="text-muted-foreground">—</span>
              <span className="text-muted-foreground">same service, new brand.</span>
              <span className="text-foreground font-medium hidden sm:inline">Your widget code remains unchanged.</span>
            </AlertDescription>
          </div>
          
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-7 w-7 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss announcement</span>
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
} 