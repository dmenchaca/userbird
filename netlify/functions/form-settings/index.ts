import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { cache } from '../lib/cache';

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
    
    if (!formId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Form ID is required' })
      };
    }

    // Check cache first
    const cacheKey = `form-settings:${formId}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(cachedData)
      };
    }

    const { data, error } = await supabase
      .from('forms')
      .select('button_color, support_text')
      .eq('id', formId)
      .single();

    if (error) throw error;

    // Cache the result for 5 minutes
    cache.set(cacheKey, data, 300);

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