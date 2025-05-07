import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { storeSecretInVault } from '../utils/vault';
import { randomUUID } from 'crypto';

// Initialize Supabase client for database access
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Slack OAuth configuration
const clientId = process.env.SLACK_CLIENT_ID!;
const clientSecret = process.env.SLACK_CLIENT_SECRET!;
const redirectUri = process.env.SLACK_REDIRECT_URI || 
  'https://app.userbird.co/.netlify/functions/slack-oauth-callback';

export const handler: Handler = async (event) => {
  // Only handle GET requests with code parameter
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Parse the query parameters
  const params = new URLSearchParams(event.rawQuery);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  // Extract form ID from state parameter
  const formId = state;

  // Handle Slack errors
  if (error) {
    console.error('Slack OAuth error:', error);
    return {
      statusCode: 302,
      headers: {
        Location: `/forms/${formId}?settings=slack&error=${encodeURIComponent(error)}`
      }
    };
  }

  // Ensure we have the required code and form ID
  if (!code || !formId) {
    console.error('Missing required parameters:', { code, formId });
    return {
      statusCode: 302,
      headers: {
        Location: `/forms/${formId || ''}?settings=slack&error=${encodeURIComponent('Missing required parameters')}`
      }
    };
  }

  try {
    // Exchange the temporary code for an access token
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri
      })
    });

    const data = await response.json() as any;

    // Handle Slack API errors
    if (!data.ok) {
      console.error('Slack API error:', data.error);
      return {
        statusCode: 302,
        headers: {
          Location: `/forms/${formId}?settings=slack&error=${encodeURIComponent(data.error || 'Slack API error')}`
        }
      };
    }

    // Extract relevant data from the response
    const {
      access_token: botToken,
      team: { id: workspaceId, name: workspaceName }
    } = data;

    console.log('Storing Slack bot token in Vault without a specific name to avoid collision');
    
    // Store the bot token in Vault without passing a name
    // Let the Vault extension handle name generation to avoid collisions
    const secretId = await storeSecretInVault(botToken);
    
    if (!secretId) {
      console.error('Failed to store token in Vault');
      return {
        statusCode: 302,
        headers: {
          Location: `/forms/${formId}?settings=slack&error=${encodeURIComponent('Failed to securely store token')}`
        }
      };
    }

    // Store integration data in the database with Vault reference
    const { error: dbError } = await supabase
      .from('slack_integrations')
      .upsert({
        form_id: formId,
        enabled: true,
        workspace_id: workspaceId,
        workspace_name: workspaceName,
        bot_token_id: secretId, // Store new Vault reference ID
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'form_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return {
        statusCode: 302,
        headers: {
          Location: `/forms/${formId}?settings=slack&error=${encodeURIComponent('Failed to save integration settings')}`
        }
      };
    }

    console.log(`Updated Slack integration for form ${formId} with new Vault secret ID: ${secretId}`);

    // Redirect back to the form settings page with success message
    return {
      statusCode: 302,
      headers: {
        Location: `/forms/${formId}?settings=slack&success=true`
      }
    };
  } catch (error) {
    console.error('Error during Slack OAuth flow:', error);
    return {
      statusCode: 302,
      headers: {
        Location: `/forms/${formId}?settings=slack&error=${encodeURIComponent('An error occurred during the Slack integration setup')}`
      }
    };
  }
}; 