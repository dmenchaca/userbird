import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { getSecretFromVault } from '../utils/vault';

// Initialize Supabase client for database access
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler: Handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { formId } = body;

    if (!formId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Missing form ID' })
      };
    }

    // Fetch the Slack integration details for this form
    const { data: integration, error: integrationError } = await supabase
      .from('slack_integrations')
      .select('workspace_id, bot_token, bot_token_id')
      .eq('form_id', formId)
      .single();

    if (integrationError || !integration) {
      console.error('Error fetching integration:', integrationError || 'No integration found');
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Slack integration not found or not properly configured' 
        })
      };
    }

    // Get the bot token - either from Vault using bot_token_id or fallback to bot_token
    let botToken: string | null = null;
    
    if (integration.bot_token_id) {
      // Retrieve from Vault
      botToken = await getSecretFromVault(integration.bot_token_id);
    } else if (integration.bot_token) {
      // Fallback to plain text token if available
      botToken = integration.bot_token;
    }
    
    if (!botToken) {
      console.error(`Could not retrieve bot token for integration (form_id: ${formId})`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Could not retrieve Slack bot token' 
        })
      };
    }

    // Fetch channels from Slack API
    const response = await fetch('https://slack.com/api/conversations.list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${botToken}`
      },
      body: JSON.stringify({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 100
      })
    });

    const data = await response.json() as any;

    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `Slack API error: ${data.error}` 
        })
      };
    }

    // Transform the channels data to a simpler format
    const channels = data.channels.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      is_private: channel.is_private
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        channels
      })
    };
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      })
    };
  }
}; 