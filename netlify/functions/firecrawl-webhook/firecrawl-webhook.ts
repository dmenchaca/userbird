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
    console.log(`Storing document chunk to Supabase: "${content.substring(0, 50)}..." with form_id: ${formId || 'none'}`);
    
    const { data, error } = await client
      .from('documents')
      .insert({
        content,
        embedding,
        form_id: formId,
        source_url: sourceUrl,
        title,
        crawl_timestamp: new Date().toISOString(),
      });
    
    if (error) {
      console.error('Error storing document chunk:', error);
      throw error;
    }
    
    console.log('Successfully stored document chunk in Supabase. Source URL:', sourceUrl);
    return data;
  } catch (error) {
    console.error('Error in storeDocumentChunk:', error);
    throw error;
  }
}

// Updated to match Firecrawl webhook payload structure
interface FirecrawlWebhookBody {
  type: string; // Changed from 'event' to 'type' based on documentation
  success: boolean;
  id: string;
  data: {
    markdown: string;
    metadata: {
      title: string;
      sourceURL: string;
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
    
    // Log the entire webhook body for debugging
    console.log('Received webhook payload:', JSON.stringify(body).substring(0, 300) + '...');
    console.log('Webhook event type:', body.type);
    console.log('Webhook data count:', body.data?.length || 0);
    
    // Validate that this is a crawl.page event
    if (body.type !== 'crawl.page') {
      console.warn(`Unsupported event type: ${body.type}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unsupported event type' }),
      };
    }
    
    // Get Supabase client
    const supabaseClient = getSupabaseClient();
    console.log('Supabase client initialized');
    
    // Process each page in the payload
    for (const page of body.data) {
      const { markdown, metadata } = page;
      const { title = 'Untitled', sourceURL = '', form_id } = metadata;
      
      console.log(`Processing page: "${title}" from ${sourceURL}`);
      
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