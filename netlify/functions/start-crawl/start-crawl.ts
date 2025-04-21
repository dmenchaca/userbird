import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables validation
if (!process.env.FIRECRAWL_API_KEY) {
  console.error('FIRECRAWL_API_KEY environment variable is required');
}
if (!process.env.VITE_SUPABASE_URL) {
  console.error('VITE_SUPABASE_URL environment variable is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/crawl';

interface StartCrawlBody {
  url: string;
  form_id: string;
}

// Define type for Firecrawl request to match their API
interface FirecrawlRequest {
  url: string;
  limit: number;
  webhook: {
    url: string;
    metadata: Record<string, any>;
    events: string[];
  };
  scrapeOptions: {
    formats: string[];
    onlyMainContent: boolean;
    [key: string]: any;
  };
  [key: string]: any;
}

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

// Create a tracking record for the scraping process
async function createScrapingProcess(client: SupabaseClient, formId: string, baseUrl: string) {
  try {
    console.log(`Creating scraping process record for form_id: ${formId}, url: ${baseUrl}`);
    
    const { data, error } = await client
      .from('docs_scraping_processes')
      .insert({
        form_id: formId,
        base_url: baseUrl,
        status: 'in_progress',
        metadata: {
          documents_with_latest_timestamp: 0 // Initialize with zero documents
        }
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating scraping process record:', error);
      throw error;
    }
    
    console.log(`Successfully created scraping process record with ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error('Error in createScrapingProcess:', error);
    throw error;
  }
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
    // Parse the request body
    const body: StartCrawlBody = JSON.parse(event.body || '{}');
    const { url, form_id } = body;
    
    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL is required' }),
      };
    }
    
    // Require form_id
    if (!form_id) {
      console.error('Missing required parameter: form_id');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'form_id is required' }),
      };
    }
    
    console.log(`Starting crawl for URL: ${url} with form_id: ${form_id}`);

    // Create a record in the tracking table
    const supabaseClient = getSupabaseClient();
    const scrapingProcess = await createScrapingProcess(supabaseClient, form_id, url);
    
    // Prepare the webhook URL
    const webhookUrl = new URL('/.netlify/functions/firecrawl-webhook', process.env.URL || 'https://your-site.netlify.app').toString();

    // Prepare request to Firecrawl with updated format - include the process ID
    const firecrawlRequest: FirecrawlRequest = {
      url,
      limit: 100,
      webhook: {
        url: webhookUrl,
        metadata: { 
          form_id,
          process_id: scrapingProcess.id,  // Pass the tracking record ID
          crawl_timestamp: scrapingProcess.created_at  // Pass the timestamp to use for documents
        },
        events: ["page"]
      },
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true
      }
    };
    
    console.log('Sending request to Firecrawl with metadata:', JSON.stringify(firecrawlRequest.webhook.metadata));
    console.log('[start-crawl] Including crawl_timestamp in metadata:', scrapingProcess.created_at);

    // Call Firecrawl API
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify(firecrawlRequest),
    });

    // Get the response data
    const data = await response.json();
    
    console.log('Firecrawl response:', JSON.stringify(data));
    
    // Check if the request was successful
    if (!data.success || response.status >= 400) {
      const errorMessage = data.error || 'Unknown error from Firecrawl';
      console.error(`Firecrawl request failed: ${errorMessage}`);
      
      // Update the process to failed status
      await supabaseClient
        .from('docs_scraping_processes')
        .update({ 
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          metadata: { 
            ...scrapingProcess.metadata,
            error: errorMessage
          } 
        })
        .eq('id', scrapingProcess.id);
      
      console.log(`Updated scraping process ${scrapingProcess.id} to failed status due to error: ${errorMessage}`);
      
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: errorMessage,
          process_id: scrapingProcess.id
        }),
      };
    }
    
    // Update our tracking record with the Firecrawl job ID if available
    if (data.id) {
      await supabaseClient
        .from('docs_scraping_processes')
        .update({ 
          metadata: { 
            firecrawl_job_id: data.id,
            ...scrapingProcess.metadata
          } 
        })
        .eq('id', scrapingProcess.id);
      
      console.log(`Updated scraping process ${scrapingProcess.id} with Firecrawl job ID: ${data.id}`);
    }

    // Return Firecrawl response and our tracking ID
    return {
      statusCode: response.status,
      body: JSON.stringify({
        ...data,
        process_id: scrapingProcess.id
      }),
    };
  } catch (error) {
    console.error('Error in start-crawl function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler }; 