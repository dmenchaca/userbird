import { Handler } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables validation
if (!process.env.VITE_SUPABASE_URL) {
  console.error('VITE_SUPABASE_URL environment variable is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
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

/**
 * Cleanup outdated documents based on crawl_timestamp
 * 
 * This function can be triggered:
 * 1. Manually via a request to /.netlify/functions/cleanup-old-documents
 * 2. Automatically via Netlify scheduled functions (recommended)
 * 
 * To configure as a scheduled function, add this to your netlify.toml:
 * 
 * [functions.cleanup-old-documents]
 *   schedule = "@daily" # Run once per day
 * 
 * Or to run weekly:
 * [functions.cleanup-old-documents]
 *   schedule = "@weekly" # Run once per week
 */
const handler: Handler = async (event) => {
  // Check for authorization header if triggered manually (optional)
  const authHeader = event.headers['authorization'];
  if (event.httpMethod === 'POST' && (!authHeader || !authHeader.startsWith('Bearer '))) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    console.log('[cleanup-old-documents] Starting cleanup of outdated documents based on crawl_timestamp');
    
    const supabaseClient = getSupabaseClient();
    
    // Use the database function to clean up outdated documents
    // Default retention period of 30 days
    const { data, error } = await supabaseClient
      .rpc('cleanup_outdated_documents', { retention_days: 30 });
      
    if (error) {
      console.error('[cleanup-old-documents] Error cleaning up outdated documents:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to clean up outdated documents' }),
      };
    }
    
    const deletedCount = data || 0;
    console.log(`[cleanup-old-documents] Successfully deleted ${deletedCount} outdated documents`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Cleanup complete - deleted ${deletedCount} outdated documents`,
        count: deletedCount
      }),
    };
  } catch (error) {
    console.error('[cleanup-old-documents] Error in cleanup function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

export { handler }; 