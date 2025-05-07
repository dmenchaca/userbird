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
    // Generate a unique default name if none provided
    const secretName = name || `secret-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Using Postgres function to store in vault
    const { data, error } = await supabase.rpc('create_secret', {
      secret_name: secretName,
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

    // If the secret has our prefix format (prefix-timestamp-random:actualToken), extract the actual token
    if (data && typeof data === 'string' && data.includes('prefix-') && data.includes(':')) {
      const parts = data.split(':');
      // Return everything after the first colon (in case the token itself contains colons)
      return parts.slice(1).join(':');
    }

    // Otherwise return the data as is (for backward compatibility)
    return data;
  } catch (error) {
    console.error('Exception retrieving secret from vault:', error);
    return null;
  }
} 