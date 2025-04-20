import { useState, useEffect } from 'react'
import { Loader2, Globe, AlertCircle, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface AIAutomationTabProps {
  formId: string
}

interface ScrapingProcess {
  id: string
  base_url: string
  status: 'in_progress' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
  scraped_urls: string[]
  error_message: string | null
  metadata?: {
    crawl_complete?: boolean
    pages_processed?: number
    expected_page_count?: number
    firecrawl_job_id?: string
  }
}

// Helper functions for localStorage toast tracking
const hasToastBeenShown = (processId: string, status: string): boolean => {
  try {
    const key = `toast-${processId}-${status}`;
    return localStorage.getItem(key) === 'true';
  } catch (e) {
    return false;
  }
};

const markToastAsShown = (processId: string, status: string): void => {
  try {
    const key = `toast-${processId}-${status}`;
    localStorage.setItem(key, 'true');
  } catch (e) {
    console.error('[AIAutomationTab] Error marking toast as shown:', e);
  }
};

export function AIAutomationTab({ formId }: AIAutomationTabProps) {
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [latestProcess, setLatestProcess] = useState<ScrapingProcess | null>(null)
  const [processFetching, setProcessFetching] = useState(true)
  // Track whether this is the first render of the component
  const [initialRender, setInitialRender] = useState(true)
  // Track the previous process status to detect real changes
  const [prevProcessStatus, setPrevProcessStatus] = useState<string | null>(null)
  // Track whether component is mounted to prevent state updates after unmounting
  const [isMounted, setIsMounted] = useState(true)

  // Set initial state on mount and cleanup on unmount
  useEffect(() => {
    setInitialRender(false);
    setIsMounted(true);
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Function to safely update state only if component is mounted
  const safeSetLatestProcess = (data: ScrapingProcess | null) => {
    if (isMounted) {
      setLatestProcess(data);
    }
  };

  // Function to safely update prevProcessStatus only if component is mounted
  const safeSetPrevProcessStatus = (status: string | null) => {
    if (isMounted) {
      setPrevProcessStatus(status);
    }
  };

  // Fetch the latest scraping process on mount and when form ID changes
  useEffect(() => {
    if (!formId || !isMounted) return;

    let isActive = true;
    const fetchLatestProcess = async () => {
      console.log('[AIAutomationTab] Fetching latest scraping process for form ID:', formId)
      setProcessFetching(true)
      try {
        const { data, error } = await supabase
          .from('docs_scraping_processes')
          .select('*')
          .eq('form_id', formId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!isActive || !isMounted) return;
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('[AIAutomationTab] Error fetching scraping process:', error)
          return;
        }

        if (data) {
          console.log('[AIAutomationTab] Successfully fetched latest process:', data);
          const processData = data as ScrapingProcess;
          
          // Ensure metadata is not null
          processData.metadata = processData.metadata || {};
          
          // Simplified approach: trust the status from the database
          safeSetLatestProcess(processData);
          safeSetPrevProcessStatus(processData.status);
          
          // If there's a running process, populate the input with its URL
          if (processData.status === 'in_progress') {
            console.log('[AIAutomationTab] In-progress process found, setting URL to:', processData.base_url)
            if (isMounted) {
              setWebsiteUrl(processData.base_url);
            }
          }
        } else {
          console.log('[AIAutomationTab] No previous scraping processes found for this form')
        }
      } catch (error) {
        console.error('[AIAutomationTab] Exception when fetching scraping process:', error)
      } finally {
        if (isMounted) {
          setProcessFetching(false);
        }
      }
    }

    fetchLatestProcess();

    // Set up real-time subscription for process updates
    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      subscription = supabase
        .channel(`docs_scraping_processes:form_id=${formId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'docs_scraping_processes',
          filter: `form_id=eq.${formId}`
        }, (payload) => {
          if (!isActive || !isMounted) return;
          
          console.log('[AIAutomationTab] Real-time update received:', payload);
          
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const newData = payload.new as ScrapingProcess;
            
            // Check if this is our current process
            if (latestProcess && newData.id === latestProcess.id) {
              console.log('[AIAutomationTab] Updating our current process with real-time data');
              
              // Store the previous status before updating
              safeSetPrevProcessStatus(latestProcess.status);
              
              // Ensure metadata is not null
              newData.metadata = newData.metadata || {};
              
              // Simplified approach: trust the status from the database
              safeSetLatestProcess(newData);
            } else {
              // This could be a new process that's more recent than what we have
              console.log('[AIAutomationTab] New process detected, fetching latest');
              fetchLatestProcess();
            }
          }
        })
        .subscribe();
      
      console.log('[AIAutomationTab] Real-time subscription established');
    } catch (error) {
      console.error('[AIAutomationTab] Error setting up real-time subscription:', error);
    }

    return () => {
      isActive = false;
      
      if (subscription) {
        console.log('[AIAutomationTab] Cleaning up real-time subscription');
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('[AIAutomationTab] Error unsubscribing from real-time updates:', error);
        }
      }
    };
  }, [formId, isMounted]);

  // Start a new scraping process
  const startScrapingProcess = async () => {
    if (!websiteUrl || !formId || !isMounted) return;
    
    console.log('[AIAutomationTab] Starting new scraping process for URL:', websiteUrl, 'formId:', formId);
    setIsLoading(true);
    try {
      // Call the start-crawl Netlify function
      console.log('[AIAutomationTab] Calling start-crawl Netlify function with payload:', {
        url: websiteUrl,
        form_id: formId
      });
      
      const response = await fetch('/.netlify/functions/start-crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: websiteUrl,
          form_id: formId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[AIAutomationTab] Start-crawl function returned error:', errorData);
        throw new Error(errorData.error || 'Failed to start scraping process');
      }
      
      const data = await response.json();
      console.log('[AIAutomationTab] Start-crawl function returned successfully:', data);
      
      // Update UI with new process
      const newProcess: ScrapingProcess = {
        id: data.process_id,
        base_url: websiteUrl,
        status: 'in_progress',
        created_at: new Date().toISOString(),
        completed_at: null,
        scraped_urls: [],
        error_message: null,
        metadata: {
          firecrawl_job_id: data.id
        }
      };
      
      console.log('[AIAutomationTab] Created new process object for UI:', newProcess);
      safeSetPrevProcessStatus(null); // Reset previous status for the new process
      safeSetLatestProcess(newProcess);
      toast.success('Document scraping process started successfully');
    } catch (error) {
      console.error('[AIAutomationTab] Error starting scraping process:', error);
      toast.error('Failed to start document scraping process');
    } finally {
      if (isMounted) {
        setIsLoading(false);
        setConfirmDialogOpen(false);
      }
    }
  };

  // Format the status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Format the date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Function to get status icon based on process status
  const getStatusIcon = (status: string) => {
    if (status === 'in_progress') {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    } else if (status === 'failed') {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return null;
  };

  // Show toast for in-progress or failed status, but only for real status changes, not re-renders
  useEffect(() => {
    if (!latestProcess || initialRender || !isMounted) return;
    
    // Check if status has actually changed from previous state
    const statusChanged = latestProcess.status !== prevProcessStatus;
    console.log('[AIAutomationTab] Status check:', { 
      current: latestProcess.status, 
      previous: prevProcessStatus, 
      changed: statusChanged 
    });
    
    // Only show toasts if status has changed
    if (statusChanged) {
      const processId = latestProcess.id;
      
      if (latestProcess.status === 'in_progress' && !hasToastBeenShown(processId, 'in_progress')) {
        markToastAsShown(processId, 'in_progress');
        toast.info(
          "Scraping is in progress. This may take several minutes depending on the website size.",
          { id: `scraping-${processId}`, duration: 4000 }
        );
        console.log('[AIAutomationTab] Showed in-progress toast');
      } 
      else if (latestProcess.status === 'failed' && !hasToastBeenShown(processId, 'failed')) {
        markToastAsShown(processId, 'failed');
        console.log('[AIAutomationTab] Process failed with error:', latestProcess.error_message);
        toast.error(latestProcess.error_message || 'Process failed', 
          { id: `scraping-error-${processId}`, duration: 5000 }
        );
        console.log('[AIAutomationTab] Showed failed toast');
      } 
      else if (latestProcess.status === 'completed' && !hasToastBeenShown(processId, 'completed')) {
        markToastAsShown(processId, 'completed');
        console.log('[AIAutomationTab] Process completed successfully, pages processed:', 
          latestProcess.scraped_urls ? latestProcess.scraped_urls.length : 0
        );
        
        // Get page count safely
        const pageCount = latestProcess.scraped_urls && Array.isArray(latestProcess.scraped_urls) 
          ? latestProcess.scraped_urls.length 
          : 0;
          
        toast.success(
          `Scraping completed successfully. ${pageCount} pages processed.`,
          { id: `scraping-completed-${processId}`, duration: 4000 }
        );
        console.log('[AIAutomationTab] Showed completed toast');
      }
      
      // Update previous status
      safeSetPrevProcessStatus(latestProcess.status);
    }
  }, [latestProcess, initialRender, prevProcessStatus, isMounted]);

  // Function to download scraped URLs as CSV
  const downloadScrapedUrlsCSV = () => {
    if (!latestProcess || !latestProcess.scraped_urls || !latestProcess.scraped_urls.length) return;

    console.log('[AIAutomationTab] Generating CSV for download with', latestProcess.scraped_urls.length, 'URLs');
    
    // Create CSV content
    const csvContent = [
      'URL', // Header row
      ...latestProcess.scraped_urls // Data rows
    ].join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scraped-urls-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV file downloaded successfully');
  };

  // Get the page count to display in the UI - simplified approach
  const getDisplayedPageCount = (): number => {
    if (!latestProcess || !latestProcess.scraped_urls) return 0;
    
    // Simply use the scraped_urls length for consistency and simplicity
    return Array.isArray(latestProcess.scraped_urls) ? latestProcess.scraped_urls.length : 0;
  };

  // Log when component renders with current state
  console.log('[AIAutomationTab] Rendering with state:', {
    formId,
    websiteUrl,
    isLoading,
    processFetching,
    hasLatestProcess: !!latestProcess,
    latestProcessStatus: latestProcess?.status,
    initialRender,
    prevProcessStatus,
    isMounted
  });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="websiteUrl">Website to Scrape</Label>
        <div className="flex gap-2">
          <Input
            id="websiteUrl"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={isLoading || (latestProcess?.status === 'in_progress')}
          />
          <Button 
            onClick={() => setConfirmDialogOpen(true)}
            disabled={!websiteUrl || isLoading || (latestProcess?.status === 'in_progress')}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing
              </>
            ) : (
              <>
                <Globe className="mr-2 h-4 w-4" />
                Scrape
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the URL of the website you want to scrape for documentation content
        </p>
      </div>

      {processFetching ? (
        <div className="flex justify-center items-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : latestProcess ? (
        <div className="space-y-4 mt-6">
          <h3 className="text-sm font-medium">Latest Scraping Process</h3>
          <div className="border rounded-md p-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">URL:</div>
              <div className="truncate">{latestProcess.base_url}</div>
              
              <div className="text-muted-foreground">Status:</div>
              <div className={`font-medium flex items-center gap-2 ${
                latestProcess.status === 'completed' 
                  ? 'text-green-600' 
                  : latestProcess.status === 'failed' 
                    ? 'text-red-600' 
                    : 'text-amber-600'
              }`}>
                {getStatusIcon(latestProcess.status)}
                {formatStatus(latestProcess.status)}
              </div>
              
              <div className="text-muted-foreground">Started:</div>
              <div>{formatDate(latestProcess.created_at)}</div>
              
              {latestProcess.completed_at && (
                <>
                  <div className="text-muted-foreground">Completed:</div>
                  <div>{formatDate(latestProcess.completed_at)}</div>
                </>
              )}
              
              <div className="text-muted-foreground">Pages Processed:</div>
              <div>{getDisplayedPageCount()}</div>
            </div>

            {latestProcess.status === 'completed' && latestProcess.scraped_urls && latestProcess.scraped_urls.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadScrapedUrlsCSV}
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Scraped URLs as CSV
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Website Scraping</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="mb-2">
                This will start scraping and processing content from <strong>{websiteUrl}</strong>.
              </p>
              <p className="mb-2">
                The process may take several minutes depending on the website size. 
                You can close this dialog and continue working while the process runs in the background.
              </p>
              <p>
                We'll notify you by email once the scraping process is complete.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startScrapingProcess}>Start Scraping</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 