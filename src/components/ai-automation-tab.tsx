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
  const [isMounted, setIsMounted] = useState(true)

  // Set initial state on mount and cleanup on unmount
  useEffect(() => {
    setIsMounted(true);
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  // Fetch the latest scraping process on mount and set up real-time updates
  useEffect(() => {
    if (!formId || !isMounted) return;

    // Initial fetch only
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

        if (!isMounted) return;
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('[AIAutomationTab] Error fetching scraping process:', error)
        } else if (data) {
          console.log('[AIAutomationTab] Successfully fetched latest process:', data);
          const processData = data as ScrapingProcess;
          
          // Ensure metadata is not null
          processData.metadata = processData.metadata || {};
          
          // Set the initial state
          setLatestProcess(processData);
          
          // If there's a running process, populate the input with its URL
          if (processData.status === 'in_progress') {
            console.log('[AIAutomationTab] In-progress process found, setting URL to:', processData.base_url)
            setWebsiteUrl(processData.base_url);
          }
        } else {
          console.log('[AIAutomationTab] No previous scraping processes found for this form')
        }
      } catch (error) {
        console.error('[AIAutomationTab] Exception when fetching scraping process:', error)
      } finally {
        setProcessFetching(false);
      }
    };

    // Initial fetch on mount
    fetchLatestProcess();

    // Set up real-time subscription for process updates
    const subscription = supabase
      .channel(`docs_scraping_processes:form_id=${formId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'docs_scraping_processes',
        filter: `form_id=eq.${formId}`
      }, (payload) => {
        if (!isMounted) return;
        
        if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          const newData = payload.new as ScrapingProcess;
          
          // Ensure metadata is not null
          newData.metadata = newData.metadata || {};
          
          // Show toast for status changes
          if (latestProcess && latestProcess.status !== newData.status) {  
            if (newData.status === 'completed' && !hasToastBeenShown(newData.id, 'completed')) {
              markToastAsShown(newData.id, 'completed');
              toast.success('Scraping completed successfully.');
            } else if (newData.status === 'failed' && !hasToastBeenShown(newData.id, 'failed')) {
              markToastAsShown(newData.id, 'failed');
              toast.error(newData.error_message || 'Process failed');
            }
          }
          
          // Update the process data
          setLatestProcess(newData);
        }
      })
      .subscribe();
    
    return () => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.error('[AIAutomationTab] Error unsubscribing from real-time updates:', error);
      }
    };
  }, [formId, isMounted]); 

  // Start a new scraping process
  const startScrapingProcess = async () => {
    if (!websiteUrl || !formId) return;
    
    setIsLoading(true);
    try {
      // Call the start-crawl Netlify function
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
        throw new Error(errorData.error || 'Failed to start scraping process');
      }
      
      // Successfully started scraping, toast will show
      toast.success('Document scraping process started successfully');
    } catch (error) {
      console.error('[AIAutomationTab] Error starting scraping process:', error);
      toast.error('Failed to start document scraping process');
    } finally {
      setIsLoading(false);
      setConfirmDialogOpen(false);
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

  // Function to download scraped URLs as CSV
  const downloadScrapedUrlsCSV = () => {
    if (!latestProcess?.scraped_urls?.length) return;
    
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

  // Get the page count to display in the UI
  const getDisplayedPageCount = (): number => {
    if (!latestProcess?.scraped_urls) return 0;
    return Array.isArray(latestProcess.scraped_urls) ? latestProcess.scraped_urls.length : 0;
  };

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