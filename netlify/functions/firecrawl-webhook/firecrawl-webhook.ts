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
    
    // Initialize metadata if needed
    const metadata = process.metadata || {};
    
    // Increment processed pages counter
    metadata.pages_processed = (metadata.pages_processed || 0) + 1;
    
    // If we have expected_pages from webhook or stored metadata, use that
    // Otherwise, we'll use the scraped_urls length as a fallback
    const expectedPages = metadata.expected_pages || process.scraped_urls.length;
    
    console.log(`Process ${processId}: processed ${metadata.pages_processed} of ${expectedPages} expected pages (${process.scraped_urls.length} scraped URLs)`);
    
    // REMOVED: Check if all pages are processed based on expected count
    // We now rely solely on crawl_complete flag from Firecrawl
    
    // Prepare update data - only update the metadata with page count
    const updateData: any = { metadata };
    
    // Update metadata
    const { error: updateError } = await client
      .from('docs_scraping_processes')
      .update(updateData)
      .eq('id', processId);
    
    if (updateError) {
      console.error(`Error updating process ${processId} progress:`, updateError);
      return;
    }
    
    // If the crawl is marked as complete and we're not already in completed state,
    // update the status separately when we get the crawl.completed event
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

    // Save the crawl_timestamp to the process metadata if needed
    if (processId && crawlTimestamp) {
      try {
        // Get current metadata for the process
        const { data: process, error: fetchError } = await supabaseClient
          .from('docs_scraping_processes')
          .select('metadata')
          .eq('id', processId)
          .single();
          
        if (fetchError) {
          console.error(`Error fetching process ${processId}:`, fetchError);
        } else {
          // Update metadata with crawl_timestamp if not already present
          const metadata = process.metadata || {};
          if (!metadata.crawl_timestamp) {
            metadata.crawl_timestamp = crawlTimestamp;
            console.log(`[firecrawl-webhook] Saving crawl_timestamp to process ${processId} metadata:`, crawlTimestamp);
            
            const { error: updateError } = await supabaseClient
              .from('docs_scraping_processes')
              .update({ metadata })
              .eq('id', processId);
              
            if (updateError) {
              console.error(`Error updating process ${processId} with crawl_timestamp:`, updateError);
            } else {
              console.log(`[firecrawl-webhook] Successfully saved crawl_timestamp to process ${processId}`);
            }
          }
        }
      } catch (error) {
        console.error('Error saving crawl_timestamp to process:', error);
      }
    }
    
    // Check for valid page event - accept either "crawl.page" or "page" or even no type if there's data
    const eventType = body.type || body.event;
    if (eventType && eventType !== 'crawl.page' && eventType !== 'page' && eventType !== 'crawl.completed') {
      console.warn(`Unsupported event type: ${eventType}`);
      
      // If we have a process ID and this is an error or completion event, update its status
      if (processId && (eventType === 'crawl.error' || eventType === 'error')) {
        const supabaseClient = getSupabaseClient();
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
    
    // Handle crawl.completed event specifically
    if (eventType === 'crawl.completed' && processId) {
      console.log(`Received crawl.completed event for process ${processId}`);
      
      // Get current process data with form_id and created_at timestamp
      const { data: process, error: fetchError } = await supabaseClient
        .from('docs_scraping_processes')
        .select('form_id, created_at, metadata, scraped_urls, status')
        .eq('id', processId)
        .single();
      
      if (fetchError) {
        console.error(`Error fetching process ${processId}:`, fetchError);
      } else {
        // Update metadata with completion information
        const metadata = process.metadata || {};
        metadata.crawl_complete = true;
        
        // Extract and save detailed stats from the webhook if available
        if (body.taskStats) {
          metadata.pages_discovered = body.taskStats.pagesDiscovered;
          metadata.pages_scraped = body.taskStats.pagesScraped;
          metadata.crawl_duration = body.taskStats.durationInMs;
          metadata.expected_pages = body.taskStats.pagesScraped;
          
          console.log(`Crawl stats: discovered=${body.taskStats.pagesDiscovered}, scraped=${body.taskStats.pagesScraped}, duration=${body.taskStats.durationInMs}ms`);
        } else {
          // If no stats in webhook, use data length as expected pages
          metadata.expected_pages = body.data?.length || process.scraped_urls.length;
          console.log(`No taskStats in webhook, using data length (${body.data?.length}) or scraped_urls (${process.scraped_urls.length}) as expected pages`);
        }
        
        // Prepare update data with completed status
        const updateData = { 
          metadata,
          status: 'completed',
          completed_at: new Date().toISOString()
        };
        
        const { error: updateError } = await supabaseClient
          .from('docs_scraping_processes')
          .update(updateData)
          .eq('id', processId);
          
        if (updateError) {
          console.error(`Error updating process ${processId} status and metadata:`, updateError);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error updating process status and metadata' }),
          };
        } else {
          console.log(`Successfully marked process ${processId} as COMPLETED with crawl completion info`);
          
          // Check if all documents have already been processed
          await updateProcessingProgress(supabaseClient, processId);
          
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              status: 'success',
              message: 'Successfully processed crawl completion webhook'
            }),
          };
        }
      }
    }
    
    // Make sure there's data to process
    if (!body.data || body.data.length === 0) {
      console.warn('No data in webhook payload');
      
      // If we have a process ID and this seems to be a completion with no data, mark it appropriately
      if (processId && body.success === true) {
        // Update metadata to flag crawl as complete, but don't change status yet
        const { data: process, error: getError } = await supabaseClient
          .from('docs_scraping_processes')
          .select('metadata, status')
          .eq('id', processId)
          .single();
          
        if (getError) {
          console.error(`Error retrieving process ${processId}:`, getError);
        } else {
          // Update metadata to flag crawl as complete
          const metadata = process.metadata || {};
          metadata.crawl_complete = true;
          metadata.expected_pages = body.data?.length || 0;
          
          // Prepare update data with completed status
          const updateData: any = { metadata };
          
          // Only update status if it's not already completed
          if (process.status !== 'completed') {
            updateData.status = 'completed';
            updateData.completed_at = new Date().toISOString();
          }
          
          const { error: updateError } = await supabaseClient
            .from('docs_scraping_processes')
            .update(updateData)
            .eq('id', processId);
            
          if (updateError) {
            console.error(`Error updating process ${processId} status and metadata:`, updateError);
          } else {
            if (updateData.status === 'completed') {
              console.log(`Successfully marked process ${processId} as COMPLETED (empty data)`);
            } else {
              console.log(`Updated process ${processId} metadata (empty data)`);
            }
            
            // Check if pages have been processed
            await updateProcessingProgress(supabaseClient, processId);
          }
        }
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No data in webhook payload' }),
      };
    }
    
    // If this is a completion event, update the metadata to mark crawl as complete
    if (body.success === true && processId) {
      const { data: process, error: getError } = await supabaseClient
        .from('docs_scraping_processes')
        .select('metadata, scraped_urls, status')
        .eq('id', processId)
        .single();
        
      if (getError) {
        console.error(`Error retrieving process ${processId}:`, getError);
      } else {
        // Update metadata to flag crawl as complete
        const metadata = process.metadata || {};
        metadata.crawl_complete = true;
        
        // Set expected pages from the webhook data
        metadata.expected_pages = body.data.length;
        console.log(`Marking process ${processId} crawl as complete, expected pages from data: ${body.data.length}`);
        
        // Prepare update data with completed status if not already completed
        const updateData: any = { metadata };
        
        // Only update status if it's not already completed
        if (process.status !== 'completed') {
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
        }
        
        const { error: updateError } = await supabaseClient
          .from('docs_scraping_processes')
          .update(updateData)
          .eq('id', processId);
          
        if (updateError) {
          console.error(`Error updating process ${processId} status and metadata:`, updateError);
        } else {
          if (updateData.status === 'completed') {
            console.log(`Successfully marked process ${processId} as COMPLETED from success event`);
          } else {
            console.log(`Updated process ${processId} metadata, expected pages: ${body.data.length}`);
          }
        }
      }
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
    
    // Check if all pages have been processed - updateProcessingProgress will mark as completed if appropriate
    if (processId) {
      await updateProcessingProgress(supabaseClient, processId);
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