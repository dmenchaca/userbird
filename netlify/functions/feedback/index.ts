import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { isValidOrigin } from './validation';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { error: insertError, data: feedbackData } = await supabase
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

    // Send success response immediately
    const response = {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

    // Send notification
    if (feedbackData) {
      // Fire and forget notification
      const baseUrl = process.env.URL || 'http://localhost:8888';
      const notificationUrl = `${baseUrl}/.netlify/functions/send-notification`;

      console.log('Sending notification:', {
        url: notificationUrl,
        formId,
        message: message.slice(0, 50) + '...', // Log first 50 chars for debugging
        env: {
          url: process.env.URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      });

      await fetch(notificationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          formId,
          message,
          userName: user_name,
          userEmail: user_email
        })
      }).then(async (response) => {
        const text = await response.text();
        console.log('Notification response:', {
          status: response.status,
          ok: response.ok,
          text: text.slice(0, 200) // Log first 200 chars of response
        });
        if (!response.ok) {
          throw new Error(`Notification failed: ${response.status} ${text}`);
        }
      }).catch((error) => {
        console.error('Notification error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          url: notificationUrl,
          stack: error instanceof Error ? error.stack : undefined
        });
      });
      
      console.log('Notification request completed');
    }

    return response;
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};