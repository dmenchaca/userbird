/*
  # Enable HTTP extension for webhook triggers
  
  This migration enables the `pg_net` extension (HTTP) which is required for the 
  assignment notification webhook trigger to call out to external services.
*/

-- Enable the pg_net extension for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net; 