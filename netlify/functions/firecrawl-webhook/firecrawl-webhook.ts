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

// Store a document chunk in Supabase
async function storeDocumentChunk(
  client: SupabaseClient,
  content: string,
  embedding: number[],
  formId: string | undefined,
  sourceUrl: string,
  title: string
) {
  try {
    // Log detailed information about the document being stored
    console.log(`Storing document chunk to Supabase: "${content.substring(0, 50)}..."`);
    console.log(`Form ID: ${formId || 'MISSING - THIS SHOULD NOT HAPPEN'}`);
    console.log(`Source URL: ${sourceUrl}`);
    console.log(`Title: ${title}`);
    
    if (!formId) {
      console.warn('WARNING: form_id is missing. This should not happen as it is now required!');
    }
    
    // Store URL and other metadata in the metadata field
    const metadata = {
      sourceURL: sourceUrl,
      title: title,
      page: sourceUrl,
      source: 'firecrawl',
      blobType: 'text/markdown'
    };
    
    // Create insert object with metadata, but without title field
    const insertData = {
      content,
      embedding,
      form_id: formId,
      metadata, // Store URL and title in metadata
      crawl_timestamp: new Date().toISOString(),
    };
    
    console.log('Inserting data into Supabase with form_id:', formId);
    
    const { data, error } = await client
      .from('documents')
      .insert(insertData);
    
    if (error) {
      console.error('Error storing document chunk:', error);
      throw error;
    }
    
    console.log('Successfully stored document chunk in Supabase with metadata containing sourceURL and title');
    console.log('Form ID confirmed in database record:', formId);
    return data;
  } catch (error) {
    console.error('Error in storeDocumentChunk:', error);
    throw error;
  }
}

// Updated to match Firecrawl webhook payload structure
interface FirecrawlWebhookBody {
  type?: string;        // Might be "crawl.page" or "page" in the response
  event?: string;       // In case the payload uses "event" instead of "type"
  success?: boolean;
  id?: string;
  form_id?: string;     // Added to check if form_id might be at the root level
  metadata?: {          // Added to check if metadata might be at the root level
    form_id?: string;
    [key: string]: any;
  };
  data: {
    markdown: string;
    metadata: {
      title: string;
      sourceURL: string;
      form_id?: string;
      [key: string]: any;
    };
  }[];
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
    
    // Log the COMPLETE webhook payload for debugging
    console.log('========== FIRECRAWL WEBHOOK - COMPLETE PAYLOAD ==========');
    console.log(JSON.stringify(body, null, 2));
    console.log('==========================================================');
    
    // Log the headers too, might contain relevant information
    console.log('========== FIRECRAWL WEBHOOK - REQUEST HEADERS ==========');
    console.log(JSON.stringify(event.headers, null, 2));
    console.log('=========================================================');
    
    // Check if there's any form_id in the root payload
    console.log('Checking for form_id in root level payload:', body.form_id || 'Not found');
    
    // Extract and log important data
    console.log('Webhook event type:', body.type || body.event);
    console.log('Webhook data count:', body.data?.length || 0);
    console.log('Webhook job ID:', body.id || 'Not found');
    
    // Check for metadata in the webhook
    if (body.data && body.data.length > 0) {
      console.log('First page metadata keys:', Object.keys(body.data[0].metadata));
      console.log('First page metadata (detailed):', JSON.stringify(body.data[0].metadata));
    }
    
    // Check for valid page event - accept either "crawl.page" or "page" or even no type if there's data
    const eventType = body.type || body.event;
    if (eventType && eventType !== 'crawl.page' && eventType !== 'page') {
      console.warn(`Unsupported event type: ${eventType}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unsupported event type' }),
      };
    }
    
    // Make sure there's data to process
    if (!body.data || body.data.length === 0) {
      console.warn('No data in webhook payload');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No data in webhook payload' }),
      };
    }
    
    // Get Supabase client
    const supabaseClient = getSupabaseClient();
    console.log('Supabase client initialized');
    
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
          title
        );
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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler }; 