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
        body: JSON.stringify({ message: 'No notification settings found' }) 
      };
    }

    // Send emails
    console.log('Attempting to send emails to:', settings.length, 'recipients');
    
    const emailPromises = settings.map(setting => {
      // Prepare email parameters based on selected attributes
      const selectedAttrs = setting.notification_attributes || ['message'];
      const emailParams = {
        formUrl: form.url,
        formId,
        showMessage: selectedAttrs.includes('message'),
        message: feedback.message,
        showUserId: selectedAttrs.includes('user_id'),
        userId: feedback.user_id,
        showUserEmail: selectedAttrs.includes('user_email'),
        userEmail: feedback.user_email,
        showUserName: selectedAttrs.includes('user_name'),
        userName: feedback.user_name,
        showOperatingSystem: selectedAttrs.includes('operating_system'),
        operatingSystem: feedback.operating_system,
        showScreenCategory: selectedAttrs.includes('screen_category'),
        screenCategory: feedback.screen_category,
        showImageUrl: selectedAttrs.includes('image_url'),
        imageUrl: feedback.image_url,
        showImageName: selectedAttrs.includes('image_name'),
        imageName: feedback.image_name,
        showCreatedAt: selectedAttrs.includes('created_at'),
        createdAt: new Date(feedback.created_at).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      };

      return fetch(`${process.env.URL}/.netlify/functions/emails/feedback-notification`, {
        method: 'POST',
        headers: {
          'netlify-emails-secret': process.env.NETLIFY_EMAILS_SECRET as string,
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
          text: text.slice(0, 200) // Log first 200 chars in case of long response
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
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};