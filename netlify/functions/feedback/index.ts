import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { isValidOrigin } from './validation';
const { trackEvent, shutdownPostHog } = require('../lib/posthog');

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
    if (!form.url || typeof form.url !== 'string' || form.url.trim() === '') {
      return true;
    }
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
      user_name,
      url_path,
      metadata
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

    // Generate secure URL for image if needed
    let secureImageUrl = image_url;
    if (image_url && image_url.includes('feedback-images')) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const parts = image_url.split('feedback-images/');
      if (parts.length > 1) {
        const imagePath = parts[1];
        secureImageUrl = `${supabaseUrl}/functions/v1/feedback-images/${imagePath}`;
      }
    }

    // Store feedback
    const { error: insertError, data: feedbackData } = await supabase
      .from('feedback')
      .insert([{
        form_id: formId, 
        message,
        image_url: secureImageUrl || null,
        image_name: image_name || null,
        image_size: image_size || null,
        screen_category: screen_category || 'Unknown',
        user_id: user_id || null,
        user_email: user_email || null,
        user_name: user_name || null,
        url_path: url_path || null,
        operating_system: operating_system || 'Unknown',
        metadata: metadata || null
      }])
      .select();

    if (insertError) throw insertError;

    console.log('Feedback insert result:', {
      hasData: !!feedbackData,
      dataLength: feedbackData?.length || 0,
      hasMetadata: !!metadata,
      metadataSize: metadata ? JSON.stringify(metadata).length : 0
    });

    // Track feedback submission
    try {
      // Determine the distinct ID to use for tracking
      const distinctId = formId === '4hNUB7DVhf' && user_email ? user_email : 'anonymous';

      // Fetch the product name for this form
      const { data: formData, error: formError } = await supabase
        .from('forms')
        .select('product_name')
        .eq('id', formId)
        .single();

      if (formError) {
        console.error('Error fetching form data for tracking:', formError);
      }

      // Determine properties to include based on form ID
      const eventProperties: Record<string, any> = {
        form_id: formId,
        has_user_info: !!user_id || !!user_email,
        has_image: !!image_url,
        operating_system,
        screen_category,
        product_name: formData?.product_name || null
      };

      // Only include user_id and user_email for the specific form
      if (formId === '4hNUB7DVhf') {
        eventProperties.user_id = user_id;
        eventProperties.user_email = user_email;
      }

      console.log('Attempting to track feedback event:', {
        event: 'feedback_submit',
        distinctId,
        properties: eventProperties
      });

      await trackEvent('feedback_submit', distinctId, eventProperties);
      console.log('Successfully tracked feedback event');

      await shutdownPostHog();
      console.log('PostHog shutdown completed');
    } catch (error) {
      console.error('Error tracking feedback:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't fail feedback submission if tracking fails
    }

    // Trigger AI tagging asynchronously if feedback was successfully created
    if (feedbackData && feedbackData.length > 0) {
      try {
        const baseUrl = process.env.URL || 'https://userbird.co';
        const aiTaggingUrl = `${baseUrl}/.netlify/functions/ai-tag-feedback`;
        
        // Fire and forget - don't await the response to avoid blocking
        fetch(aiTaggingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            feedbackId: feedbackData[0].id,
            formId: formId,
            content: message
          })
        }).catch(err => {
          // Just log errors, don't fail the feedback submission
          console.error('Error triggering AI tagging (non-blocking):', err);
        });
        
        console.log('AI tagging request sent asynchronously');
      } catch (error) {
        console.error('Error preparing AI tagging request:', error);
        // Don't fail the feedback submission if AI tagging fails
      }
    }

    // Trigger webhook delivery
    try {
      await fetch(`${process.env.URL}/.netlify/functions/send-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          formId, 
          feedback: feedbackData?.[0] 
        })
      });
    } catch (error) {
      console.error('Error triggering webhook:', error);
      // Don't fail the feedback submission if webhook fails
    }

    // Trigger Slack notification
    try {
      console.log('Triggering Slack notification for form:', formId);
      await fetch(`${process.env.URL}/.netlify/functions/send-to-slack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          formId, 
          feedbackId: feedbackData?.[0]?.id 
        })
      });
      console.log('Slack notification request sent successfully');
    } catch (error) {
      console.error('Error triggering Slack notification:', error);
      // Don't fail the feedback submission if Slack notification fails
    }

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