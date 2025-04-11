// Mock environment variables for testing
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';
process.env.VITE_PUBLIC_POSTHOG_KEY = 'mock-posthog-key';
process.env.VITE_PUBLIC_POSTHOG_HOST = 'https://app.posthog.com';

// Mock import.meta.env for Vite
global.import = {};
global.import.meta = { env: {} };
global.import.meta.env = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
  MODE: 'test',
  DEV: false,
  VITE_PUBLIC_POSTHOG_KEY: 'mock-posthog-key',
  VITE_PUBLIC_POSTHOG_HOST: 'https://app.posthog.com'
}; 