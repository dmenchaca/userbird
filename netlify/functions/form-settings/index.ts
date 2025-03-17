import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { trackEvent, shutdownPostHog } from '../lib/posthog';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function getCorsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
}

export const handler: Handler = async (event) => {
  const headers = getCorsHeaders(event.headers.origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const formId = event.queryStringParameters?.id;
    
    if (!formId?.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Form ID is required' })
      };
    }

    const { data, error } = await supabase
      .from('forms')
      .select('url, button_color, support_text, keyboard_shortcut')
      .eq('id', formId.trim())
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};