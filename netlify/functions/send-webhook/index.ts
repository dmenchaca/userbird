import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { formId, feedback } = JSON.parse(event.body || '{}');

    if (!formId || !feedback) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Get webhook settings for the form
    const { data: webhookSettings, error: settingsError } = await supabase
      .from('webhook_settings')
      .select('*')
      .eq('form_id', formId)
      .eq('enabled', true)
      .single();

    if (settingsError || !webhookSettings?.url) {
      console.log('No webhook configured or webhook disabled');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No webhook configured' })
      };
    }

    // Send webhook
    const response = await fetch(webhookSettings.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        formId,
        ...feedback,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.statusText}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to deliver webhook' })
    };
  }
};