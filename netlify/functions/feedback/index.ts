import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { isValidOrigin } from './validation';

import supabase from '../../src/lib/supabase';

function getCorsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

async function validateFormId(formId: string, origin: string): Promise<boolean> {
  try {
    const { data: form } = await supabase
      .from('forms')
      .select('url')
      .eq('id', formId)
      .single();

    if (!form) return false;
    return isValidOrigin(origin, form.url);
  } catch {
    return false;
  }
}

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;
  const headers = getCorsHeaders(origin);

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    // Validate request
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { 
      formId, 
      message, 
      image_url,
      image_name,
      image_size,
      operating_system, 
      screen_category,
      user_id,
      user_email,
      user_name 
    } = body;

    if (!formId || !message?.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request data' })
      };
    }

    // Validate origin
    if (origin) {
      const isValid = await validateFormId(formId, origin);
      if (!isValid) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Origin not allowed' })
        };
      }
    }

    // Store feedback
    const { error: insertError } = await supabase
      .from('feedback')
      .insert([{ 
        form_id: formId, 
        message,
        operating_system: operating_system || 'Unknown',
        image_url: image_url || null,
        image_name: image_name || null,
        image_size: image_size || null,
        screen_category: screen_category || 'Unknown',
        user_id: user_id || null,
        user_email: user_email || null,
        user_name: user_name || null
      }]);

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
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