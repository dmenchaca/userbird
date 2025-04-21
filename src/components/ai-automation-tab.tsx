import { useState, useEffect } from 'react'
import { Loader2, Globe, AlertCircle, Download, InfoIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import React from 'react'

interface AIAutomationTabProps {
  formId: string
  initialProcess?: ScrapingProcess | null
  refreshKey?: string | number
}

interface ScrapingProcess {
  id: string
  base_url: string
  status: 'in_progress' | 'completed' | 'failed'
  created_at: string
  completed_at: string | null
  error_message: string | null
  metadata?: {
    crawl_complete?: boolean
    pages_processed?: number
    expected_pages?: number
    firecrawl_job_id?: string
    error?: string
    crawl_timestamp?: string
    current_processing_url?: string
    processed_urls?: string[]
    documents_with_latest_timestamp?: number
    crawl_api_status?: {
      status?: string
      total: number
      completed: number
      creditsUsed?: number
      expiresAt?: string
    }
  }
}

export function AIAutomationTab({ formId, initialProcess, refreshKey }: AIAutomationTabProps) {
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [latestProcess, setLatestProcess] = useState<ScrapingProcess | null>(null)
  const [isMounted, setIsMounted] = useState(true)
  const prevStatusRef = React.useRef<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Set initial state on mount and cleanup on unmount
  useEffect(() => {
    console.log('[AIAutomationTab] Component mounted');
    setIsMounted(true);
    
    // If initialProcess is provided, use it initially
    if (initialProcess) {
      console.log('[AIAutomationTab] Using provided initialProcess:', initialProcess.id);
      setLatestProcess(initialProcess);
      
      // If there's a running process, populate the input with its URL
      if (initialProcess.status === 'in_progress') {
        console.log('[AIAutomationTab] In-progress process found in initialProcess, setting URL to:', initialProcess.base_url)
        setWebsiteUrl(initialProcess.base_url);
      }
    }
    
    return () => {
      console.log('[AIAutomationTab] Component unmounting');
      setIsMounted(false);
    };
  }, [initialProcess]);

  // Add a useEffect to log when latestProcess changes
  useEffect(() => {
    if (latestProcess) {
      const docsCount = latestProcess.metadata?.documents_with_latest_timestamp || 0;
      console.log('[AIAutomationTab] Rendering with process data:', {
        id: latestProcess.id,
        status: latestProcess.status,
        docs_count: docsCount,
        created_at: latestProcess.created_at
      });
      
      // If there's a running process, populate the input with its URL
      if (latestProcess.status === 'in_progress') {
        console.log('[AIAutomationTab] In-progress process found, setting URL to:', latestProcess.base_url)
        setWebsiteUrl(latestProcess.base_url);
      }
    }
  }, [latestProcess]);

  // Fetch the latest scraping process whenever the component mounts
  useEffect(() => {
    if (!formId || !isMounted) return;

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
          console.log('[AIAutomationTab] Latest process data:', {
            id: processData.id,
            status: processData.status,
            docs_count: processData.metadata?.documents_with_latest_timestamp || 0,
            base_url: processData.base_url,
            created_at: processData.created_at
          });
          
          // Ensure metadata is not null
          processData.metadata = processData.metadata || {};
          
          // Set the state with the latest process
          setLatestProcess(processData);
        } else {
          console.log('[AIAutomationTab] No previous scraping processes found for this form')
          // Clear the state if no process is found
          setLatestProcess(null);
        }
      } catch (error) {
        console.error('[AIAutomationTab] Exception when fetching scraping process:', error)
      }
    };

    // Always fetch the latest process on mount
    fetchLatestProcess();
    
    // Add a unique key that changes when the dialog is opened/closed
    const now = new Date().getTime();
    console.log(`[AIAutomationTab] Fetch trigger time: ${now}, refreshKey: ${refreshKey}`);
  }, [formId, isMounted, refreshKey]);

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
              docs_count: newData.metadata?.documents_with_latest_timestamp || 0,
              metadata: newData.metadata,
              oldStatus: latestProcess?.status,
              oldDocsCount: latestProcess?.metadata?.documents_with_latest_timestamp || 0
            });

            // Only update state if there are meaningful changes
            const statusChanged = newData.status !== latestProcess?.status;
            const docsCountChanged = (newData.metadata?.documents_with_latest_timestamp || 0) !== 
              (latestProcess?.metadata?.documents_with_latest_timestamp || 0);
            
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

            if (docsCountChanged) {
              const oldCount = latestProcess?.metadata?.documents_with_latest_timestamp || 0;
              const newCount = newData.metadata?.documents_with_latest_timestamp || 0;
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

  // Add effect to send notification when process completes
  useEffect(() => {
    if (!formId || !latestProcess) return;
    
    // Store current status
    const currentStatus = latestProcess.status;
    
    // Check if we need to send a notification (when status changes from 'in_progress' to 'completed')
    if (prevStatusRef.current === 'in_progress' && currentStatus === 'completed') {
      console.log('[AIAutomationTab] Status changed from in_progress to completed, sending notification');
      sendCompletionNotification();
    }
    
    // Update previous status reference for next check
    prevStatusRef.current = currentStatus;
    
  }, [latestProcess?.status, formId, latestProcess]);

  // Function to send notification when crawling completes
  const sendCompletionNotification = async () => {
    if (!latestProcess || !formId) return;
    
    try {
      console.log('[AIAutomationTab] Sending crawl completion notification');
      
      const processedCount = latestProcess.metadata?.documents_with_latest_timestamp || 0;
      const totalPages = latestProcess.metadata?.crawl_api_status?.total || processedCount;
      
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formId: formId,
          type: 'crawl_complete',
          adminOnly: true,
          message: `Documentation crawling for ${latestProcess.base_url} has completed. ${processedCount} pages were processed.`,
        }),
      });
      
      if (response.ok) {
        console.log('[AIAutomationTab] Notification sent successfully');
      } else {
        console.error('[AIAutomationTab] Failed to send notification:', await response.text());
      }
    } catch (error) {
      console.error('[AIAutomationTab] Error sending notification:', error);
    }
  };

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
      
      // Add a second toast to inform about email notification
      toast.info('You will receive an email notification when the crawling process is complete.', {
        duration: 5000
      });
    } catch (error) {
      console.error('[AIAutomationTab] Error starting scraping process:', error);
      toast.error('Failed to start document scraping process');
    } finally {
      setIsLoading(false);
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

  // Update the local state with new process data
  const updateProcessState = (newData: ScrapingProcess) => {
    // Update if this is a newer or the same process
    const newTimestamp = new Date(newData.created_at).getTime();
    const currentTimestamp = latestProcess?.created_at 
      ? new Date(latestProcess.created_at).getTime() 
      : 0;
      
    // Calculate metrics for tracking changes
    const metadata = newData.metadata || {};
    const docs_count = metadata.documents_with_latest_timestamp || 0;
    const statusChanged = newData.status !== latestProcess?.status;
    const oldDocsCount = latestProcess?.metadata?.documents_with_latest_timestamp || 0;
    const docsCountChanged = docs_count !== oldDocsCount;
    
    // Check for crawl completion
    const isCompleted = newData.status === 'completed' && latestProcess?.status !== 'completed';
    const docsCountIncreased = docsCountChanged && docs_count > oldDocsCount;
    
    if (statusChanged) {
      console.log('[AIAutomationTab] Process status changed:', {
        oldStatus: latestProcess?.status,
        newStatus: newData.status
      });
    }
    
    if (docsCountChanged) {
      const oldCount = oldDocsCount;
      const newCount = docs_count;
      console.log('[AIAutomationTab] Pages processed count changed:', { 
        oldCount, 
        newCount, 
        difference: newCount - oldCount 
      });
    }

    // Update the state if this is a never process or has changed
    if (newTimestamp >= currentTimestamp && (statusChanged || docsCountChanged)) {
      setLatestProcess(newData);
    }
    
    // If the process just completed, try to send the notification
    if (isCompleted && formId) {
      console.log('[AIAutomationTab] Process completed, sending notification');
      sendCompletionNotification();
    }
  };

  // Function to download scraped URLs as CSV
  const downloadScrapedUrlsCSV = async () => {
    if (!latestProcess?.id) return;
    
    try {
      setIsExporting(true);
      
      // Call the database function through Supabase
      const { data: urls, error } = await supabase
        .rpc('get_process_urls', { process_id_param: latestProcess.id });
      
      if (error) {
        console.error('Error fetching URLs:', error);
        toast.error('Failed to fetch URLs for export');
        setIsExporting(false);
        return;
      }
      
      if (!urls?.length) {
        toast.info('No URLs found to export');
        setIsExporting(false);
        return;
      }
      
      // Create CSV content
      const csvContent = [
        'URL', // Header row
        ...urls.map((item: { url: string }) => item.url) // Data rows with proper typing
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
    } catch (e) {
      console.error('Error downloading URLs:', e);
      toast.error('Failed to download URLs');
    } finally {
      setIsExporting(false);
    }
  };

  // Get the page count to display in the UI
  const getDisplayedPageCount = (): string => {
    if (!latestProcess) return '0';
    
    const metadata = latestProcess.metadata || {};
    
    // Get the processed count from documents_with_latest_timestamp
    const processedCount = metadata.documents_with_latest_timestamp || 0;
    
    // If process is not in progress, just show the final count
    if (latestProcess.status !== 'in_progress') {
      return processedCount.toString();
    }
    
    // For in-progress processes, show "X of Y"
    let expectedTotal = 0;
    
    // Try to get the total from crawl_api_status first
    if (metadata.crawl_api_status?.total) {
      expectedTotal = metadata.crawl_api_status.total;
    } 
    // Fall back to expected_pages if available
    else if (metadata.expected_pages) {
      expectedTotal = metadata.expected_pages;
    } 
    // Default to the current count if we don't have better information
    else {
      expectedTotal = processedCount > 0 ? processedCount : 1;
    }
    
    return `${processedCount} of ${expectedTotal}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="websiteUrl">Link to your help docs</Label>
        <div className="flex gap-2">
          <Input
            id="websiteUrl"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://help.yourstartup.com"
            disabled={isLoading || (latestProcess?.status === 'in_progress')}
          />
          <Button 
            onClick={startScrapingProcess}
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
                Crawl docs
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
          <h3 className="text-sm font-medium">Latest crawling process</h3>
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

            {latestProcess.status === 'in_progress' && (
              <div className="mt-4 pt-4 border-t border-border">
                <Alert className="bg-blue-50 border-blue-200">
                  <InfoIcon className="h-4 w-4 text-blue-500" />
                  <AlertTitle>Processing in progress</AlertTitle>
                  <AlertDescription>
                    This process can take up to 5 minutes to complete. You can close this window and we'll send an email notification to admin users once the crawling is finished.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {latestProcess.status === 'completed' && (
              <div className="mt-4 pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadScrapedUrlsCSV}
                  className="w-full"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting URLs...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download Scraped URLs as CSV
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
} 