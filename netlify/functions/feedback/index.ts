import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

function getCorsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  }
}

function createResponse(statusCode: number, headers: Record<string, string>, body: string = '') {
  return {
    statusCode,
    headers: {
      ...headers,
      'Vary': 'Origin'  // Important for CDN caching
    },
    body
  }
}

function normalizeUrl(url: string): string {
  // Remove protocol if present
  url = url.replace(/^(https?:\/\/)/, '');
  // Remove trailing slash if present
  url = url.replace(/\/$/, '');
  // Remove any path components
  url = url.split('/')[0];
  // Convert to lowercase
  return url.toLowerCase();
}

async function isAllowedOrigin(origin: string, formId: string): Promise<boolean> {
  try {
    const { data: form } = await supabase
      .from('forms')
      .select('url')
      .eq('id', formId)
      .single()

    if (!form) return false

    // Normalize both URLs for comparison
    const originDomain = normalizeUrl(origin);
    const storedDomain = normalizeUrl(form.url);

    return originDomain === storedDomain;
  } catch {
    return false
  }
}

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin
  const corsHeaders = getCorsHeaders(origin)

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(204, corsHeaders)
  }

  // Validate request method
  if (event.httpMethod !== 'POST') {
    return createResponse(405, corsHeaders, JSON.stringify({ error: 'Method not allowed' }))
  }

  // Validate Content-Type
  const contentType = event.headers['content-type'] || ''
  if (!contentType.includes('application/json')) {
    return createResponse(415, corsHeaders, JSON.stringify({ error: 'Unsupported Media Type. Please send JSON' }))
  }

  try {
    // Parse and validate request body
    let body
    try {
      body = JSON.parse(event.body || '{}')
    } catch {
      return createResponse(400, corsHeaders, JSON.stringify({ error: 'Invalid JSON' }))
    }

    const { formId, message } = body

    if (!formId || typeof formId !== 'string') {
      return createResponse(400, corsHeaders, JSON.stringify({ error: 'Invalid or missing formId' }))
    }

    if (!message || typeof message !== 'string') {
      return createResponse(400, corsHeaders, JSON.stringify({ error: 'Invalid or missing message' }))
    }

    // Validate origin
    if (origin) {
      const allowed = await isAllowedOrigin(origin, formId)
      if (!allowed) {
        return createResponse(403, corsHeaders, JSON.stringify({ error: 'Origin not allowed' }))
      }
    }

    // Store feedback
    const { error: insertError } = await supabase
      .from('feedback')
      .insert([{ form_id: formId, message }])

    if (insertError) throw insertError

    return createResponse(200, corsHeaders, JSON.stringify({ success: true }))
  } catch (error) {
    console.error('Error:', error)
    return createResponse(500, corsHeaders, JSON.stringify({ error: 'Internal server error' }))
  }
}