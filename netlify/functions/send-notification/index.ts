import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface EmailPayload {
  formId: string;
  message: string;
  userName?: string;
  userEmail?: string;
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body || '{}') as EmailPayload;
    const { formId, message, userName, userEmail } = payload;

    // Get form details and notification settings
    const { data: form } = await supabase
      .from('forms')
      .select('url')
      .eq('id', formId)
      .single();

    if (!form) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: 'Form not found' }) 
      };
    }

    // Get notification settings
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('email')
      .eq('form_id', formId)
      .eq('enabled', true);

    if (!settings?.length) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ message: 'No notification settings found' }) 
      };
    }

    // Send email to each recipient
    const emailPromises = settings.map(({ email }) => {
      return fetch(`${process.env.URL}/.netlify/functions/emails/feedback-notification`, {
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
            message,
            userName,
            userEmail,
            hasUserInfo: !!(userName || userEmail)
          },
        }),
      });
    });

    await Promise.all(emailPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send notification' })
    };
  }
};