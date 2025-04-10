import { useContext } from 'react';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// Hook to access Supabase client
export function useSupabase() {
  return { supabase };
}