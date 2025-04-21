import { Handler } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Configuration, OpenAIApi } from 'openai';

// Environment variables validation
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required');
}
if (!process.env.VITE_SUPABASE_URL) {
  console.error('VITE_SUPABASE_URL environment variable is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

// Create OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Create Supabase client
let supabase: SupabaseClient | null = null;

// Function to get a Supabase client with the service role key
const getSupabaseClient = () => {
  if (supabase) return supabase;
  
  supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  return supabase;
};

// Split text into chunks
function splitIntoChunks(text: string, maxTokens = 500): string[] {
  // Simple splitting by paragraph then combining until we reach token limit
  // Note: This is a naive approach that estimates tokens by words/4
  const paragraphs = text.split('\n\n');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Rough estimation of tokens (words / 4)
    const estimatedTokenCount = paragraph.split(/\s+/).length / 4;
    const currentTokenEstimate = currentChunk.split(/\s+/).length / 4;
    
    if (currentTokenEstimate + estimatedTokenCount > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Generate embeddings from OpenAI
async function generateEmbedding(text: string) {
  try {
    console.log('Generating embedding for text:', text.substring(0, 50) + '...');
    
    const response = await openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: text,
    });
    
    console.log('Successfully generated embedding with dimensions:', response.data.data[0].embedding.length);
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Track scraped URL in scraping process
async function trackScrapedUrl(
  client: SupabaseClient,
  processId: string | undefined,
  url: string
) {
  if (!processId) {
    console.warn('No process_id provided, cannot track scraped URL in docs_scraping_processes');
    return;
  }
  
  try {
    console.log(`Tracking scraped URL ${url} for process ${processId}`);
    
    // Get current scraped_urls array
    const { data: process, error: getError } = await client
      .from('docs_scraping_processes')
      .select('scraped_urls')
      .eq('id', processId)
      .single();
    
    if (getError) {
      console.error(`Error retrieving process ${processId}:`, getError);
      return;
    }
    
    // Add the new URL if it doesn't already exist
    const currentUrls = process.scraped_urls || [];
    if (!currentUrls.includes(url)) {
      const updatedUrls = [...currentUrls, url];
      
      // Update the record
      const { error: updateError } = await client
        .from('docs_scraping_processes')
        .update({ scraped_urls: updatedUrls })
        .eq('id', processId);
      
      if (updateError) {
        console.error(`Error updating process ${processId} with scraped URL:`, updateError);
        return;
      }
      
      console.log(`Successfully added URL ${url} to process ${processId}, total URLs: ${updatedUrls.length}`);
    } else {
      console.log(`URL ${url} already tracked in process ${processId}`);
    }
  } catch (error) {
    console.error('Error in trackScrapedUrl:', error);
  }
}

// Update process status when crawl completes or fails
async function updateProcessStatus(
  client: SupabaseClient,
  processId: string | undefined,
  status: 'completed' | 'failed',
  errorMessage?: string
) {
  if (!processId) {
    console.warn('No process_id provided, cannot update process status');
    return;
  }
  
  try {
    console.log(`Updating process ${processId} status to ${status}`);
    
    const updateData: any = { status };
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }
    
    const { error } = await client
      .from('docs_scraping_processes')
      .update(updateData)
      .eq('id', processId);
    
    if (error) {
      console.error(`Error updating process ${processId} status:`, error);
      return;
    }
    
    console.log(`Successfully updated process ${processId} status to ${status}`);
  } catch (error) {
    console.error('Error in updateProcessStatus:', error);
  }
}

// Update processing progress and check if all documents are processed
async function updateProcessingProgress(
  client: SupabaseClient,
  processId: string | undefined
) {
  if (!processId) {
    console.warn('No process_id provided, cannot update processing progress');
    return;
  }
  
  try {
    // Get current process data
    const { data: process, error: fetchError } = await client
      .from('docs_scraping_processes')
      .select('metadata, scraped_urls, status')
      .eq('id', processId)
      .single();
    
    if (fetchError) {
      console.error(`Error fetching process ${processId}:`, fetchError);
      return;
    }
    
    // Get metadata
    const metadata = process.metadata || {};
    
    // Use Firecrawl's API stats if available instead of incrementing our own counter
    if (metadata.crawl_api_status) {
      // Log the process using Firecrawl's API values
      const completed = metadata.crawl_api_status.completed || 0;
      const total = metadata.crawl_api_status.total || process.scraped_urls.length;
      
      console.log(`Process ${processId}: Firecrawl reports ${completed} of ${total} pages completed (${process.scraped_urls.length} scraped URLs)`);
      
      // Check if we should mark the process as completed based on scraped URLs
      if (process.status !== 'completed' && process.scraped_urls.length >= total) {
        console.log(`Process ${processId}: All URLs processed, marking as completed`);
        
        await client
          .from('docs_scraping_processes')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            metadata: {
              ...metadata,
              crawl_complete: true
            }
          })
          .eq('id', processId);
      }
    } else {
      // If we don't have API stats, fall back to original behavior but avoid double-counting
      // by checking if we've already processed this URL
      const currentUrl = metadata.current_processing_url;
      const processedUrls = metadata.processed_urls || [];
      
      // Only increment if this URL hasn't been processed yet
      if (currentUrl && !processedUrls.includes(currentUrl)) {
        // Increment processed pages counter
        metadata.pages_processed = (metadata.pages_processed || 0) + 1;
        
        // Track this URL as processed
        processedUrls.push(currentUrl);
        metadata.processed_urls = processedUrls;
        
        // Use expected_pages from metadata or fall back to scraped_urls length
        const expectedPages = metadata.expected_pages || process.scraped_urls.length;
        
        console.log(`Process ${processId}: processed ${metadata.pages_processed} of ${expectedPages} expected pages (${process.scraped_urls.length} scraped URLs)`);
        
        // Check if we should mark the process as completed
        const updateData: any = { metadata };
        
        if (process.status !== 'completed' && process.scraped_urls.length >= expectedPages) {
          console.log(`Process ${processId}: All expected URLs processed, marking as completed`);
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
          metadata.crawl_complete = true;
        }
        
        // Update metadata
        const { error: updateError } = await client
          .from('docs_scraping_processes')
          .update(updateData)
          .eq('id', processId);
        
        if (updateError) {
          console.error(`Error updating process ${processId} progress:`, updateError);
          return;
        }
      }
    }
  } catch (error) {
    console.error('Error in updateProcessingProgress:', error);
  }
}

// Store a document chunk in Supabase
async function storeDocumentChunk(
  client: SupabaseClient,
  content: string,
  embedding: number[],
  formId: string | undefined,
  sourceUrl: string,
  title: string,
  processId?: string
) {
  try {
    console.log(`Storing document chunk for form ${formId} with source URL: ${sourceUrl}`);
    
    // Prepare metadata for the document - include process_id here
    const metadata: any = {
      url: sourceUrl,
      title: title,
    };
    
    if (processId) {
      metadata.process_id = processId;
      console.log(`Including process_id in metadata: ${processId}`);
    }
    
    // Get the crawl_timestamp from the process if available
    let crawlTimestamp: string | null = null;
    
    if (processId) {
      try {
        console.log(`Looking up crawl_timestamp for process ${processId}`);
        const { data: process, error } = await client
          .from('docs_scraping_processes')
          .select('created_at, metadata')
          .eq('id', processId)
          .single();
          
        if (error) {
          console.error(`Error fetching process ${processId}:`, error);
        } else if (process) {
          // First check if the timestamp was passed in metadata
          if (process.metadata?.crawl_timestamp) {
            crawlTimestamp = process.metadata.crawl_timestamp;
            console.log(`[firecrawl-webhook] Found crawl_timestamp in process metadata: ${crawlTimestamp}`);
          } else {
            // Fall back to using the process created_at time
            crawlTimestamp = process.created_at;
            console.log(`[firecrawl-webhook] Using process created_at as crawl_timestamp: ${crawlTimestamp}`);
          }
          
          // Track this URL as the currently processing URL to prevent double-counting
          if (process.metadata) {
            const updatedMetadata = { ...process.metadata, current_processing_url: sourceUrl };
            await client
              .from('docs_scraping_processes')
              .update({ metadata: updatedMetadata })
              .eq('id', processId);
          }
        }
      } catch (error) {
        console.error('Error getting crawl_timestamp from process:', error);
      }
    }
    
    // Create the object to insert - ensure we don't include any scraping_process_id field
    const insertData = {
      content,
      embedding,
      form_id: formId,
      metadata, // Store URL, title, and process_id in metadata
      crawl_timestamp: crawlTimestamp || new Date().toISOString(), // Use found timestamp or current time as fallback
    };
    
    // Log the object structure being inserted (exclude the actual embedding vectors)
    const logData = {...insertData, embedding: `[${insertData.embedding.length} dimensions]`};
    console.log(`Document insert structure:`, JSON.stringify(logData, null, 2));
    console.log('Inserting data into Supabase with form_id:', formId);
    
    // Insert the document - use explicit column names to avoid scraping_process_id issues
    const { data, error } = await client
      .from('documents')
      .insert([
        {
          content: insertData.content,
          embedding: insertData.embedding,
          form_id: insertData.form_id,
          metadata: insertData.metadata,
          crawl_timestamp: insertData.crawl_timestamp
        }
      ]);
    
    if (error) {
      console.error('Error storing document chunk:', error);
      throw error;
    }
    
    console.log('Successfully stored document chunk in Supabase with process_id in metadata');
    console.log('Form ID confirmed in database record:', formId);
    
    // Track the scraped URL in the process record if we have a process ID
    if (processId) {
      await trackScrapedUrl(client, processId, sourceUrl);
      
      // Update processing progress for this chunk
      await updateProcessingProgress(client, processId);
    }
    
    return data;
  } catch (error) {
    console.error('Error in storeDocumentChunk:', error);
    throw error;
  }
}

// Updated to match Firecrawl webhook payload structure
interface FirecrawlWebhookBody {
  id?: string;
  type?: string;
  event?: string;
  success?: boolean;
  data?: {
    content: string;
    url: string;
    metadata: {
      process_id?: string;
      title?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }[];
  metadata?: {
    process_id?: string;
    [key: string]: any;
  };
  [key: string]: any;
  taskStats?: {
    pagesDiscovered: number;
    pagesScraped: number;
    durationInMs: number;
    [key: string]: any;
  };
}

// Function to sanitize large content fields for logging
function sanitizePayloadForLogging(payload: any): any {
  const sanitized = JSON.parse(JSON.stringify(payload));
  if (sanitized.data && Array.isArray(sanitized.data)) {
    sanitized.data = sanitized.data.map((item: any) => {
      // Replace large content fields with placeholders to reduce log size
      if (item.markdown && item.markdown.length > 100) {
        item.markdown = `${item.markdown.substring(0, 100)}... [${item.markdown.length} chars]`;
      }
      if (item.html && item.html.length > 100) {
        item.html = `${item.html.substring(0, 100)}... [${item.html.length} chars]`;
      }
      if (item.rawHtml && item.rawHtml.length > 100) {
        item.rawHtml = `${item.rawHtml.substring(0, 100)}... [${item.rawHtml.length} chars]`;
      }
      return item;
    });
  }
  return sanitized;
}

const handler: Handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse the webhook payload
    const body: FirecrawlWebhookBody = JSON.parse(event.body || '{}');
    
    // Log basic webhook info instead of the entire payload
    console.log('========== FIRECRAWL WEBHOOK - BASIC INFO ==========');
    console.log('Event type:', body.type || body.event);
    console.log('Data count:', body.data?.length || 0);
    console.log('Job ID:', body.id || 'Not found');
    console.log('Process ID:', body.metadata?.process_id || 'Not found');
    console.log('==========================================================');
    
    // Log the complete webhook payload for debugging - sanitized for embedding data
    const sanitizedPayload = sanitizePayloadForLogging(body);
    console.log('COMPLETE FIRECRAWL WEBHOOK PAYLOAD:', JSON.stringify(sanitizedPayload, null, 2));
    
    // Check if there's any form_id in the root payload
    console.log('Checking for form_id in root level payload:', body.form_id || 'Not found');
    
    // Get the process_id from the metadata if available
    let processId = body.metadata?.process_id;
    console.log('Process ID from webhook metadata:', processId || 'Not found');

    // Check for crawl_timestamp in metadata and log it
    const crawlTimestamp = body.metadata?.crawl_timestamp;
    console.log('[firecrawl-webhook] Crawl timestamp from webhook metadata:', crawlTimestamp || 'Not found');

    // Get Supabase client
    const supabaseClient = getSupabaseClient();
    console.log('Supabase client initialized');
    
    // Combined API call and metadata updates
    let apiCrawlStatus: any = null;
    
    // Fetch complete crawl status from the Firecrawl API if we have a job ID
    if (body.id) {
      try {
        const crawlId = body.id;
        console.log(`Fetching complete crawl status for job ${crawlId}`);
        
        const apiResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`
          }
        });
        
        if (apiResponse.ok) {
          apiCrawlStatus = await apiResponse.json();
          
          // Log the complete API response for debugging
          const sanitizedStatus = sanitizePayloadForLogging(apiCrawlStatus);
          console.log('COMPLETE FIRECRAWL API RESPONSE:', JSON.stringify(sanitizedStatus, null, 2));
        } else {
          console.error(`Error fetching crawl status: ${apiResponse.status} ${apiResponse.statusText}`);
        }
      } catch (error) {
        console.error('Error fetching crawl status from API:', error);
      }
    }
    
    // Update process metadata if we have a process ID
    if (processId) {
      try {
        // Get current process metadata
        const { data: process, error: fetchError } = await supabaseClient
          .from('docs_scraping_processes')
          .select('metadata')
          .eq('id', processId)
          .single();
          
        if (fetchError) {
          console.error(`Error fetching process ${processId}:`, fetchError);
        } else {
          // Prepare metadata updates - combine all sources
          const metadata = process.metadata || {};
          let metadataUpdated = false;
          
          // 1. Add crawl_timestamp if not present
          if (crawlTimestamp && !metadata.crawl_timestamp) {
            metadata.crawl_timestamp = crawlTimestamp;
            console.log(`[firecrawl-webhook] Adding crawl_timestamp to metadata:`, crawlTimestamp);
            metadataUpdated = true;
          }
          
          // 2. Add API crawl status information if available
          if (apiCrawlStatus) {
            metadata.crawl_api_status = {
              status: apiCrawlStatus.status,
              total: apiCrawlStatus.total,
              completed: apiCrawlStatus.completed,
              creditsUsed: apiCrawlStatus.creditsUsed,
              expiresAt: apiCrawlStatus.expiresAt
            };
            console.log(`[firecrawl-webhook] Adding API crawl status to metadata`);
            metadataUpdated = true;
          }
          
          // Perform a single update if any metadata was changed
          if (metadataUpdated) {
            const { error: updateError } = await supabaseClient
              .from('docs_scraping_processes')
              .update({ metadata })
              .eq('id', processId);
              
            if (updateError) {
              console.error(`Error updating process ${processId} metadata:`, updateError);
            } else {
              console.log(`[firecrawl-webhook] Successfully updated process ${processId} metadata`);
            }
          }
        }
      } catch (error) {
        console.error('Error updating process metadata:', error);
      }
    }
    
    // Check for valid page event - accept either "crawl.page" or "page" or even no type if there's data
    const eventType = body.type || body.event;
    console.log('EVENT TYPE DETECTED:', eventType);
    console.log('BODY SUCCESS FLAG:', body.success);
    console.log('BODY STATUS:', body.status);
    
    if (eventType && eventType !== 'crawl.page' && eventType !== 'page' && eventType !== 'crawl.completed') {
      console.warn(`Unsupported event type: ${eventType}`);
      
      // If we have a process ID and this is an error or completion event, update its status
      if (processId && (eventType === 'crawl.error' || eventType === 'error')) {
        await updateProcessStatus(
          supabaseClient, 
          processId, 
          'failed', 
          `Unsupported event type: ${eventType}`
        );
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unsupported event type' }),
      };
    }
    
    // Variables for tracking completion status
    let isCompletionEvent = false;
    let completionSource = '';
    
    // Unified handling of process status and metadata updates
    if (processId) {
      // Check if this is a completion event by examining multiple signals
      
      // Case 1: Explicit crawl.completed event
      if (eventType === 'crawl.completed') {
        isCompletionEvent = true;
        completionSource = 'crawl.completed event';
      } 
      // Case 2: Success flag is true
      else if (body.success === true) {
        isCompletionEvent = true;
        completionSource = 'success flag';
      }
      // Case 3: API status indicates completion
      else if (apiCrawlStatus && 
              (apiCrawlStatus.status === 'completed' || 
              apiCrawlStatus.status === 'success' || 
              apiCrawlStatus.completed === apiCrawlStatus.total)) {
        isCompletionEvent = true;
        completionSource = 'API status';
      }
      
      // Always get current process data to check URLs processed vs expected
      const { data: process, error: fetchError } = await supabaseClient
        .from('docs_scraping_processes')
        .select('form_id, created_at, metadata, scraped_urls, status')
        .eq('id', processId)
        .single();
      
      if (fetchError) {
        console.error(`Error fetching process ${processId}:`, fetchError);
      } else {
        // Update metadata with completion information if this is an explicit completion event
        const metadata = process.metadata || {};
        
        // Use the official total from the Firecrawl API for expected_pages
        if (apiCrawlStatus?.total) {
          metadata.expected_pages = apiCrawlStatus.total;
          console.log(`Using API total (${apiCrawlStatus.total}) as expected pages`);
        } else {
          // Fallback to existing logic only if API data isn't available
          if (body.taskStats?.pagesScraped) {
            metadata.expected_pages = body.taskStats.pagesScraped;
            console.log(`Fallback: Using taskStats.pagesScraped (${body.taskStats.pagesScraped}) as expected pages`);
          } else if (body.data?.length) {
            metadata.expected_pages = body.data.length;
            console.log(`Fallback: Using data length (${body.data.length}) as expected pages`);
          } else {
            metadata.expected_pages = process.scraped_urls.length;
            console.log(`Fallback: Using scraped_urls length (${process.scraped_urls.length}) as expected pages`);
          }
        }
        
        // Get current count of unique URLs processed
        const uniqueUrlsProcessed = process.scraped_urls.length;
        
        // Only update status to completed if all expected URLs have been processed
        const updateData: any = { metadata };
        
        // Mark as completed if we have processed all expected pages, regardless of completion event
        if (process.status !== 'completed' && uniqueUrlsProcessed >= metadata.expected_pages) {
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
          console.log(`Successfully marking process ${processId} as COMPLETED (${uniqueUrlsProcessed}/${metadata.expected_pages} URLs processed)`);
          
          // Flag for completion event handling
          if (!isCompletionEvent) {
            isCompletionEvent = true;
            completionSource = 'scraped_urls count completion';
            // Mark completion in metadata
            metadata.crawl_complete = true;
          }
        } else if (isCompletionEvent && process.status !== 'completed') {
          console.log(`Process ${processId} has completion signal but waiting for all URLs (${uniqueUrlsProcessed}/${metadata.expected_pages} processed)`);
        } else if (uniqueUrlsProcessed >= metadata.expected_pages && process.status === 'completed') {
          console.log(`Process ${processId} already marked as completed (${uniqueUrlsProcessed}/${metadata.expected_pages} URLs processed)`);
        } else {
          console.log(`Process ${processId} still in progress (${uniqueUrlsProcessed}/${metadata.expected_pages} URLs processed)`);
        }
        
        const { error: updateError } = await supabaseClient
          .from('docs_scraping_processes')
          .update(updateData)
          .eq('id', processId);
          
        if (updateError) {
          console.error(`Error updating process ${processId} status and metadata:`, updateError);
        } else {
          if (updateData.status === 'completed') {
            console.log(`Successfully marked process ${processId} as COMPLETED`);
          } else {
            console.log(`Updated process ${processId} metadata, expected pages: ${metadata.expected_pages}`);
          }
        }
      }
    }
    
    // Make sure there's data to process
    if (!body.data || body.data.length === 0) {
      console.warn('No data in webhook payload');
      
      // Handle completion with no data if appropriate
      if (isCompletionEvent && processId) {
        // Check if we already processed this completion event
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            status: 'success',
            message: 'Successfully processed completion event with no data'
          }),
        };
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No data in webhook payload' }),
      };
    }
    
    // Process each page in the payload
    for (const page of body.data) {
      const { markdown, metadata } = page;
      
      // Extract metadata and verify form_id
      const { title = 'Untitled', sourceURL = '' } = metadata;
      
      // Get form_id from metadata, possibly passed from the webhook
      let form_id = metadata.form_id;
      
      // Check for form_id in various places including the webhook or job ID
      if (!form_id) {
        // Check various places where form_id might be
        if (body.form_id) {
          console.log('Found form_id in root payload');
          form_id = body.form_id;
        } else if (body.metadata?.form_id) {
          console.log('Found form_id in body.metadata');
          form_id = body.metadata.form_id;
        } else if (event.queryStringParameters?.form_id) {
          console.log('Found form_id in query parameters');
          form_id = event.queryStringParameters.form_id;
        }
      }
      
      console.log(`Processing page: "${title}" from ${sourceURL} with form_id: ${form_id || 'MISSING'}`);
      
      // Skip if no content
      if (!markdown) {
        console.warn(`Skipping page with empty markdown: ${sourceURL}`);
        continue;
      }
      
      // Split content into chunks
      const chunks = splitIntoChunks(markdown);
      console.log(`Split content into ${chunks.length} chunks`);
      
      // Process each chunk
      for (const chunk of chunks) {
        // Generate embedding
        const embedding = await generateEmbedding(chunk);
        
        // Store in Supabase
        await storeDocumentChunk(
          supabaseClient,
          chunk,
          embedding,
          form_id,
          sourceURL,
          title,
          processId
        );
      }
    }
    
    // Check if all pages have been processed
    if (processId) {
      await updateProcessingProgress(supabaseClient, processId);
      
      // Final check for completion status
      const { data: finalProcess } = await supabaseClient
        .from('docs_scraping_processes')
        .select('status, metadata, scraped_urls')
        .eq('id', processId)
        .single();
        
      if (finalProcess && finalProcess.status !== 'completed') {
        const metadata = finalProcess.metadata || {};
        const expectedPages = metadata.expected_pages || finalProcess.scraped_urls.length;
        const actualProcessed = finalProcess.scraped_urls.length;
        
        // If we've processed all expected pages but status is still not completed, update it
        if (actualProcessed >= expectedPages) {
          console.log(`Final check: Marking process ${processId} as COMPLETED (${actualProcessed}/${expectedPages} URLs processed)`);
          
          await supabaseClient
            .from('docs_scraping_processes')
            .update({ 
              status: 'completed', 
              completed_at: new Date().toISOString(),
              metadata: { 
                ...metadata,
                crawl_complete: true 
              }
            })
            .eq('id', processId);
        }
      }
    }
    
    console.log('Successfully processed all pages and stored chunks in Supabase');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        status: 'success',
        message: 'Successfully processed webhook and stored documents in Supabase'
      }),
    };
  } catch (error) {
    console.error('Error in firecrawl-webhook function:', error);
    
    // If we can extract a process ID, update its status to failed
    try {
      const body = JSON.parse(event.body || '{}');
      const processId = body.metadata?.process_id;
      
      if (processId) {
        const supabaseClient = getSupabaseClient();
        await updateProcessStatus(
          supabaseClient, 
          processId, 
          'failed', 
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    } catch (e) {
      console.error('Error while trying to update process status after failure:', e);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler }; 