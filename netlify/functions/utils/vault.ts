import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize Supabase client with service role key for Vault access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Store a secret in Supabase Vault
 * @param secret The secret value to store
 * @param name Optional name for the secret
 * @returns The UUID of the stored secret or null if operation failed
 */
export async function storeSecretInVault(secret: string, name?: string): Promise<string | null> {
  try {
    // Using Postgres function to store in vault
    const { data, error } = await supabase.rpc('create_secret', {
      secret_name: name || 'slack-bot-token',
      secret_value: secret
    });

    if (error) {
      console.error('Error storing secret in vault:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception storing secret in vault:', error);
    return null;
  }
}

/**
 * Retrieve a secret from Supabase Vault
 * @param secretId The UUID of the secret to retrieve
 * @returns The secret value or null if retrieval failed
 */
export async function getSecretFromVault(secretId: string): Promise<string | null> {
  try {
    // Using Postgres function to retrieve from vault
    const { data, error } = await supabase.rpc('get_secret', {
      secret_id: secretId
    });

    if (error) {
      console.error('Error retrieving secret from vault:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception retrieving secret from vault:', error);
    return null;
  }
}

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