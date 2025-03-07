import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Log environment variables at startup
console.log('Notification function environment:', {
  hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasEmailsSecret: !!process.env.NETLIFY_EMAILS_SECRET,
  netlifyUrl: process.env.URL,
  netlifyContext: process.env.CONTEXT
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// Use service role key for backend operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
  console.log('Notification function triggered:', {
    method: event.httpMethod,
    hasBody: !!event.body,
    bodyLength: event.body?.length
  });

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { formId, message } = JSON.parse(event.body || '{}');
    console.log('Parsed request:', { 
      hasFormId: !!formId, 
      messageLength: message?.length 
    });
    
    // Get form details and feedback
    const [formResult, feedbackResult] = await Promise.all([
      supabase
      .from('forms')
      .select('url')
      .eq('id', formId)
      .single(),
      supabase
      .from('feedback')
      .select('*')
      .eq('form_id', formId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    ]);

    if (formResult.error) {
      console.error('Form query error:', formResult.error);
      throw formResult.error;
    }

    if (feedbackResult.error) {
      console.error('Feedback query error:', feedbackResult.error);
      throw feedbackResult.error;
    }

    const form = formResult.data;
    const feedback = feedbackResult.data;

    if (!form) {
      console.error('Form not found:', formId);
      return { statusCode: 404, body: JSON.stringify({ error: 'Form not found' }) };
    }

    // Get enabled notification settings
    const { data: settings, error: settingsError } = await supabase
      .from('notification_settings')
      .select('email, notification_attributes')
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
        body: JSON.stringify({ 
          message: 'No notification settings found',
          formId,
          settingsCount: settings?.length || 0
        }) 
      };
    }

    // Send emails
    console.log('Sending emails to:', settings.length, 'recipients');
    console.log('Email configuration:', {
      hasEmailsSecret: !!process.env.NETLIFY_EMAILS_SECRET,
      netlifyUrl: process.env.URL,
      emailEndpoint: `${process.env.URL}/.netlify/functions/emails/feedback-notification`
    });
    
    const emailPromises = settings.map(setting => {
      // Prepare email parameters based on selected attributes
      const selectedAttrs = setting.notification_attributes || ['message'];
      
      // Create email parameters object with only selected attributes
      const emailParams: Record<string, any> = {
        formUrl: form.url,
        formId,
        url_path: feedback.url_path,
      };

      // Add selected attributes to email parameters
      selectedAttrs.forEach(attr => {
        if (attr === 'message') {
          emailParams.message = feedback.message;
        } else if (attr === 'user_id') {
          emailParams.user_id = feedback.user_id;
        } else if (attr === 'user_email') {
          emailParams.user_email = feedback.user_email;
        } else if (attr === 'user_name') {
          emailParams.user_name = feedback.user_name;
        } else if (attr === 'operating_system') {
          emailParams.operating_system = feedback.operating_system;
        } else if (attr === 'screen_category') {
          emailParams.screen_category = feedback.screen_category;
        } else if (attr === 'image_url') {
          emailParams.image_url = feedback.image_url;
        } else if (attr === 'image_name') {
          emailParams.image_name = feedback.image_name;
        } else if (attr === 'created_at') {
          emailParams.created_at = new Date(feedback.created_at).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
      });

      // Add flags for showing sections based on selected attributes
      emailParams.showUserInfo = ['user_id', 'user_email', 'user_name'].some(attr => 
        selectedAttrs.includes(attr)
      );
      emailParams.showSystemInfo = ['operating_system', 'screen_category'].some(attr => 
        selectedAttrs.includes(attr)
      );

      const emailUrl = `${process.env.URL}/.netlify/functions/emails/feedback-notification`;
      
      return fetch(emailUrl, {
        method: 'POST',
        headers: {
          'netlify-emails-secret': process.env.NETLIFY_EMAILS_SECRET as string,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'notifications@userbird.co',
          to: setting.email,
          subject: `New feedback received for ${form.url}`,
          parameters: emailParams
        })
      }).then(async response => {
        const text = await response.text();
        console.log('Email API response:', {
          status: response.status,
          ok: response.ok,
          text: text.slice(0, 200)
        });
        if (!response.ok) {
          throw new Error(`Email API failed: ${response.status} ${text}`);
        }
        return response;
      });
    });

    await Promise.all(emailPromises);
    console.log('All notification emails sent successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error in notification function:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};