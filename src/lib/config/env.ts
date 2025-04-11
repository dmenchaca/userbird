// Environment variable validation and access
export const env = {
  supabase: {
    url: process.env.NODE_ENV === 'test' 
      ? 'https://example.supabase.co' 
      : import.meta.env.VITE_SUPABASE_URL,
    anonKey: process.env.NODE_ENV === 'test' 
      ? 'mock-anon-key' 
      : import.meta.env.VITE_SUPABASE_ANON_KEY
  }
}