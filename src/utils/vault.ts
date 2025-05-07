import { createClient } from '@supabase/supabase-js';

// Helper function to create a Supabase client that can be used in browser context
const getSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return createClient(supabaseUrl, supabaseKey);
};

/**
 * Delete a secret from Supabase Vault
 * @param secretId The UUID of the secret to delete
 * @returns True if the secret was successfully deleted, false otherwise
 */
export async function deleteSecretFromVault(secretId: string): Promise<boolean> {
  try {
    // Skip if no secretId provided
    if (!secretId) {
      console.warn('No secretId provided for deletion');
      return false;
    }
    
    const supabase = getSupabaseClient();
    
    // Using Postgres function to delete from vault
    const { data, error } = await supabase.rpc('delete_secret', {
      secret_id: secretId
    });

    if (error) {
      console.error('Error deleting secret from vault:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Exception deleting secret from vault:', error);
    return false;
  }
} 