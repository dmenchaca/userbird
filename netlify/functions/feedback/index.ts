import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { isValidOrigin } from './validation';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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
      }])
      .select();

    if (insertError) throw insertError;

    console.log('Feedback insert result:', {
      hasData: !!feedbackData,
      dataLength: feedbackData?.length || 0
    });

    // Send notification
    try {
      const notificationResponse = await fetch(`${process.env.URL}/.netlify/functions/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ formId, message })
      });

      console.log('Notification response:', {
        status: notificationResponse.status,
        ok: notificationResponse.ok
      });

      if (!notificationResponse.ok) {
        console.error('Notification request failed:', await notificationResponse.text());
      }
    } catch (error) {
      console.error('Error sending notification:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        cause: error instanceof Error ? error.cause : undefined,
        stack: error instanceof Error ? error.stack : undefined
      });
    }

    // Test endpoint URL - using relative path since we're on the same domain
    const testEndpointUrl = '/.netlify/functions/test-endpoint';

    console.log('Feedback function environment:', {
      hasUrl: !!process.env.URL,
      url: process.env.URL,
      testEndpointUrl,
      nodeEnv: process.env.NODE_ENV
    });

    if (feedbackData) {
      // Construct full URL
      const baseUrl = process.env.URL || 'https://userbird.co';
      const fullUrl = `${baseUrl}/.netlify/functions/test-endpoint`;
      
      console.log('Attempting to send request to test endpoint:', {
        url: fullUrl,
        baseUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      const testData = {
        formId,
        message,
        timestamp: new Date().toISOString()
      };
      
      console.log('Request payload:', testData);

      try {
        console.log('Sending fetch request...');
        
        const testResponse = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(testData)
        });

        console.log('Fetch request sent. Awaiting response...');

        // Log response details before trying to read the body
        console.log('Test response received:', {
          status: testResponse.status,
          ok: testResponse.ok,
          headers: Object.fromEntries(testResponse.headers),
          url: fullUrl
        });

        let responseBody;
        try {
          responseBody = await testResponse.text();
          console.log('Test endpoint response body:', responseBody);
        } catch (bodyError) {
          console.error('Error reading response body:', {
            error: bodyError instanceof Error ? bodyError.message : 'Unknown error',
            stack: bodyError instanceof Error ? bodyError.stack : undefined
          });
        }
        
        if (!testResponse.ok) {
          throw new Error(`Test request failed: ${testResponse.status} ${responseBody || 'No response body'}`);
        }
      } catch (error) {
        console.error('Fetch request failed:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          type: error instanceof Error ? error.constructor.name : typeof error,
          url: fullUrl,
          cause: error instanceof Error ? error.cause : undefined,
          stack: error instanceof Error ? error.stack : undefined
        });
        // Log error but don't throw to ensure feedback is still saved
        console.warn('Continuing despite test endpoint error');
      }
      
      console.log('Test request completed');
    }

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