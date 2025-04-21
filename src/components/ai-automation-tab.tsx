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
  initialProcess?: ScrapingProcess | null
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
    error?: string
  }
}

export function AIAutomationTab({ formId, initialProcess }: AIAutomationTabProps) {
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [latestProcess, setLatestProcess] = useState<ScrapingProcess | null>(initialProcess || null)
  const [isMounted, setIsMounted] = useState(true)

  // Set initial state on mount and cleanup on unmount
  useEffect(() => {
    console.log('[AIAutomationTab] Component mounted');
    setIsMounted(true);
    
    return () => {
      console.log('[AIAutomationTab] Component unmounting');
      setIsMounted(false);
    };
  }, []);

  // Add a useEffect to log when latestProcess changes
  useEffect(() => {
    if (latestProcess) {
      console.log('[AIAutomationTab] Rendering with process data:', {
        id: latestProcess.id,
        status: latestProcess.status,
        urls_count: latestProcess.scraped_urls?.length || 0,
        created_at: latestProcess.created_at
      });
      
      // If there's a running process, populate the input with its URL
      if (latestProcess.status === 'in_progress') {
        console.log('[AIAutomationTab] In-progress process found, setting URL to:', latestProcess.base_url)
        setWebsiteUrl(latestProcess.base_url);
      }
    }
  }, [latestProcess]);

  // Fetch the latest scraping process only if initialProcess is not provided
  useEffect(() => {
    if (!formId || !isMounted || initialProcess) return;

    // Initial fetch only
    const fetchLatestProcess = async () => {
      console.log('[AIAutomationTab] Fetching latest scraping process for form ID:', formId)
      try {
        console.log('[AIAutomationTab] Making database query');
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
          console.log('[AIAutomationTab] Successfully fetched process with ID:', data.id);
          const processData = data as ScrapingProcess;
          
          // Log the initial data
          console.log('[AIAutomationTab] Initial process data:', {
            id: processData.id,
            status: processData.status,
            urls_count: processData.scraped_urls?.length || 0,
            created_at: processData.created_at
          });
          
          // Ensure metadata is not null
          processData.metadata = processData.metadata || {};
          
          // Set the initial state
          setLatestProcess(processData);
        } else {
          console.log('[AIAutomationTab] No previous scraping processes found for this form')
        }
      } catch (error) {
        console.error('[AIAutomationTab] Exception when fetching scraping process:', error)
      }
    };

    // Initial fetch on mount only if no initialProcess was provided
    fetchLatestProcess();
  }, [formId, isMounted, initialProcess]);

  // Set up real-time subscriptions for process updates, regardless of initialProcess
  useEffect(() => {
    if (!formId || !isMounted) return;
    
    console.log('[AIAutomationTab] Setting up real-time subscriptions');

    // Set up real-time subscription for process updates
    const setupRealtimeUpdates = (processId: string) => {
      console.log(`[AIAutomationTab] Setting up real-time subscription for process: ${processId}`);
      
      // Log subscription configuration
      console.log(`[AIAutomationTab] Subscribing to UPDATE events for docs_scraping_processes with id=${processId}`);
      
      const channel = supabase
        .channel(`docs_scraping_process_${processId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'docs_scraping_processes',
            filter: `id=eq.${processId}`,
          },
          (payload) => {
            console.log(`[AIAutomationTab] UPDATE event received for process ${processId}:`, {
              event: 'UPDATE',
              table: 'docs_scraping_processes',
              oldStatus: latestProcess?.status,
              newStatus: payload.new.status,
              payloadType: typeof payload,
              payloadKeys: Object.keys(payload),
              timestamp: new Date().toISOString()
            });
            
            if (!isMounted) {
              console.log('[AIAutomationTab] Received update but component is unmounted, ignoring');
              return;
            }

            const newData = payload.new as ScrapingProcess;
            
            console.log(`[AIAutomationTab] Real-time update received for process ${processId}:`, {
              id: newData.id,
              status: newData.status,
              urls_count: newData.scraped_urls?.length || 0,
              metadata: newData.metadata,
              oldStatus: latestProcess?.status,
              oldUrlsCount: latestProcess?.scraped_urls?.length || 0
            });

            // Only update state if there are meaningful changes
            const statusChanged = newData.status !== latestProcess?.status;
            const urlsCountChanged = (newData.scraped_urls?.length || 0) !== (latestProcess?.scraped_urls?.length || 0);
            
            if (statusChanged) {
              console.log(`[AIAutomationTab] Status change detected: ${latestProcess?.status} -> ${newData.status}`);
              if (newData.status === 'completed') {
                console.log('[AIAutomationTab] Process completed successfully');
                toast.success('Website scraping completed successfully!');
              } else if (newData.status === 'failed') {
                console.log('[AIAutomationTab] Process failed', newData.metadata?.error);
                toast.error(`Website scraping failed: ${newData.metadata?.error || 'Unknown error'}`);
              }
            }

            if (urlsCountChanged) {
              const oldCount = latestProcess?.scraped_urls?.length || 0;
              const newCount = newData.scraped_urls?.length || 0;
              console.log(`[AIAutomationTab] Pages processed count changed: ${oldCount} -> ${newCount}`);
            }

            console.log(`[AIAutomationTab] Updating latestProcess state with new data for ${processId}`);
            setLatestProcess(newData);
          }
        )
        .subscribe((status) => {
          console.log(`[AIAutomationTab] UPDATE subscription status: ${status} for process ${processId}`, {
            channelName: `docs_scraping_process_${processId}`,
            timestamp: new Date().toISOString()
          });
          
          if (status === 'SUBSCRIBED') {
            console.log(`[AIAutomationTab] Successfully subscribed to real-time updates for process ${processId}`);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('[AIAutomationTab] Error subscribing to real-time updates');
          } else if (status === 'TIMED_OUT') {
            console.error('[AIAutomationTab] Subscription timed out');
          }
        });

      return () => {
        console.log(`[AIAutomationTab] Unsubscribing from real-time updates for process ${processId}`);
        channel.unsubscribe();
      };
    };

    // Set up real-time updates for each existing process
    if (latestProcess) {
      setupRealtimeUpdates(latestProcess.id);
      console.log('[AIAutomationTab] Real-time subscription established');
    }
    
    // Subscribe to new scraping processes for this form
    console.log(`[AIAutomationTab] Setting up subscription for INSERT events on docs_scraping_processes for form_id=${formId}`);
    
    const newProcessChannel = supabase
      .channel('new_scraping_processes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'docs_scraping_processes',
          filter: `form_id=eq.${formId}`,
        },
        (payload) => {
          console.log(`[AIAutomationTab] INSERT event received for form ${formId}:`, {
            event: 'INSERT',
            table: 'docs_scraping_processes',
            newProcessId: payload.new.id,
            newStatus: payload.new.status,
            payloadType: typeof payload,
            payloadKeys: Object.keys(payload),
            timestamp: new Date().toISOString()
          });
          
          if (!isMounted) {
            console.log('[AIAutomationTab] Received new process notification but component is unmounted, ignoring');
            return;
          }
          
          const newProcess = payload.new as ScrapingProcess;
          console.log(`[AIAutomationTab] New scraping process detected:`, {
            id: newProcess.id,
            status: newProcess.status,
            base_url: newProcess.base_url,
            created_at: newProcess.created_at
          });
          
          // Only update if this is a newer process than what we have
          const currentTimestamp = latestProcess?.created_at ? new Date(latestProcess.created_at).getTime() : 0;
          const newTimestamp = new Date(newProcess.created_at).getTime();
          
          if (!latestProcess || newTimestamp > currentTimestamp) {
            console.log('[AIAutomationTab] Setting newly created process as latest');
            // Ensure metadata is not null
            newProcess.metadata = newProcess.metadata || {};
            console.log(`[AIAutomationTab] Updating latestProcess state with new INSERT data, id=${newProcess.id}, status=${newProcess.status}`);
            setLatestProcess(newProcess);
            
            // Also set up real-time updates for this new process
            setupRealtimeUpdates(newProcess.id);
          } else {
            console.log(`[AIAutomationTab] Not updating latestProcess - current process is newer:`, {
              currentId: latestProcess?.id,
              currentTimestamp,
              newId: newProcess.id,
              newTimestamp
            });
          }
        }
      )
      .subscribe((status) => {
        console.log(`[AIAutomationTab] INSERT subscription status: ${status}`, {
          channelName: 'new_scraping_processes',
          formId,
          timestamp: new Date().toISOString()
        });
        
        if (status === 'SUBSCRIBED') {
          console.log('[AIAutomationTab] Successfully subscribed to new scraping processes');
        }
      });
      
    return () => {
      // Cleanup will be handled by the channel unsubscribe functions
      if (newProcessChannel) {
        console.log('[AIAutomationTab] Unsubscribing from new scraping processes');
        newProcessChannel.unsubscribe();
      }
    };
  }, [formId, isMounted, latestProcess]);

  // Start a new scraping process
  const startScrapingProcess = async () => {
    if (!websiteUrl || !formId) return;
    
    console.log(`[AIAutomationTab] Starting scraping process for URL: ${websiteUrl}`);
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
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error(`[AIAutomationTab] Error response from start-crawl:`, responseData);
        throw new Error(responseData.error || 'Failed to start scraping process');
      }
      
      console.log(`[AIAutomationTab] Successfully started scraping process:`, {
        processId: responseData.process_id,
        status: responseData.status || 'unknown',
        success: responseData.success,
        timestamp: new Date().toISOString()
      });
      
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

      {latestProcess ? (
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