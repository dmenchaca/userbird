import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
  console.log('Notification function started');
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { formId, message } = JSON.parse(event.body || '{}');
    console.log('Request payload:', { formId, hasMessage: !!message });
    
    // Get form details
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('url')
      .eq('id', formId)
      .single();

    if (formError) {
      console.error('Form query error:', formError);
      throw formError;
    }

    console.log('Form query result:', { found: !!form, url: form?.url });

    if (!form) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Form not found' }) };
    }

    // Get enabled notification settings
    const { data: settings, error: settingsError } = await supabase
      .from('notification_settings')
      .select('email')
      .eq('form_id', formId)
      .eq('enabled', true);

    if (settingsError) {
      console.error('Settings query error:', settingsError);
      throw settingsError;
    }

    console.log('Notification settings query result:', { 
      found: !!settings, 
      count: settings?.length || 0,
      emails: settings?.map(s => s.email) || []
    });

    if (!settings?.length) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ message: 'No notification settings found' }) 
      };
    }

    // Send emails
    console.log('Attempting to send emails to:', settings.length, 'recipients');
    
    const emailPromises = settings.map(({ email }) => 
      fetch(`${process.env.URL}/.netlify/functions/emails/feedback-notification`, {
        method: 'POST',
        headers: {
          'netlify-emails-secret': process.env.NETLIFY_EMAILS_SECRET as string,
        },
        body: JSON.stringify({
          from: 'notifications@userbird.co',
          to: email,
          subject: `New feedback received for ${form.url}`,
          parameters: {
            formUrl: form.url,
            formId,
            message
          },
        })
      }).then(async response => {
        const text = await response.text();
        console.log('Email API response:', {
          status: response.status,
          ok: response.ok,
          text: text.slice(0, 200) // Log first 200 chars in case of long response
        });
        if (!response.ok) {
          throw new Error(`Email API failed: ${response.status} ${text}`);
        }
        return response;
      })
    );

    await Promise.all(emailPromises);
    console.log('All notification emails sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error in notification function:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};