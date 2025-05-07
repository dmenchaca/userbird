import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize Supabase client with service role key for Vault access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Store a secret in Supabase Vault
 * @param secretValue The actual secret value to encrypt and store securely
 * @param secretName Optional descriptive name for the secret (not the secret itself)
 * @returns The UUID of the stored secret or null if operation failed
 */
export async function storeSecretInVault(secretValue: string, secretName?: string): Promise<string | null> {
  try {
    // Generate a descriptive name if none provided - this appears in the name column
    // and should NOT contain sensitive information
    const descriptiveName = secretName || `secret-descriptor-${Date.now()}`;
    
    console.log(`Storing secret with descriptor: ${descriptiveName}`);
    
    // Using Postgres function to store in vault
    // Based on docs: vault.create_secret(secret_value, [unique_name], [description])
    const { data, error } = await supabase.rpc('create_secret', {
      secret_value: secretValue,      // First parameter is the secret value
      secret_name: descriptiveName    // Second parameter is the optional name
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
 * @param secretId The UUID of the stored secret to retrieve
 * @returns The decrypted secret value or null if retrieval failed
 */
export async function getSecretFromVault(secretId: string): Promise<string | null> {
  try {
    // Using Postgres function to retrieve decrypted secret from vault
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