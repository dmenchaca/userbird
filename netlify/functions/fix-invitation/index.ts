import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with SERVICE_ROLE key for admin privileges
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const handler: Handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, invitationId } = body;

    if (!userId || !invitationId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: userId and invitationId' }),
      };
    }

    // Verify the invitation exists
    const { data: invitation, error: fetchError } = await supabase
      .from('form_collaborators')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (fetchError || !invitation) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Invitation not found', details: fetchError }),
      };
    }

    // Update the invitation with admin privileges
    const { data, error } = await supabase
      .from('form_collaborators')
      .update({
        user_id: userId,
        invitation_accepted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (error) {
      console.error('Update error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update invitation', details: error }),
      };
    }

    // Get the updated record to confirm changes
    const { data: updatedInvitation } = await supabase
      .from('form_collaborators')
      .select('*')
      .eq('id', invitationId)
      .single();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Invitation updated successfully',
        before: invitation,
        after: updatedInvitation
      }),
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error }),
    };
  }
};

export { handler }; 