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
 * Cleanup old documents marked with is_current=false
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
    console.log('[cleanup-old-documents] Starting cleanup of documents marked as is_current=false');
    
    const supabaseClient = getSupabaseClient();
    
    // Get count before deletion for reporting
    const { count: beforeCount, error: countError } = await supabaseClient
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('is_current', false);
      
    if (countError) {
      console.error('[cleanup-old-documents] Error counting old documents:', countError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to count old documents' }),
      };
    }
    
    console.log(`[cleanup-old-documents] Found ${beforeCount} documents marked as is_current=false`);
    
    // Delete documents marked as is_current=false
    // For large databases, consider adding a retention period (e.g., older than 30 days)
    // or using a batch processing approach for very large datasets
    
    const { error: deleteError } = await supabaseClient
      .from('documents')
      .delete()
      .eq('is_current', false);
      // Optional: Add time-based filter for retention
      // .lt('crawl_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    if (deleteError) {
      console.error('[cleanup-old-documents] Error deleting old documents:', deleteError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to delete old documents' }),
      };
    }
    
    console.log(`[cleanup-old-documents] Successfully deleted ${beforeCount} outdated documents`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Cleanup complete - deleted ${beforeCount} documents marked as is_current=false`,
        count: beforeCount
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