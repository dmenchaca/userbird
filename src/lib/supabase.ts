import { createClient } from '@supabase/supabase-js'
import { env } from './config/env'

function validateSupabaseConfig() {
  if (!env.supabase.url) {
    throw new Error('VITE_SUPABASE_URL is not set in .env file')
  }
  
  if (!env.supabase.anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY is not set in .env file')
  }

  try {
    // Validate URL format
    new URL(env.supabase.url)
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL')
  }
}

validateSupabaseConfig()

// Create the Supabase client with explicit storage options to ensure sessions persist properly across tabs
export const supabase = createClient(
  env.supabase.url, 
  env.supabase.anonKey,
  {
    auth: {
      persistSession: true,
      // Use local storage as the primary storage mechanism with more consistent behavior across tabs
      storage: localStorage,
      // Increase detectSessionInUrl flag to ensure OAuth redirects are properly handled
      detectSessionInUrl: true,
      // Ensure autoRefreshToken is enabled to maintain the session
      autoRefreshToken: true
    }
  }
)