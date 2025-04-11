import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for database access
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface UserData {
  id: string;
  email: string;
}

/**
 * Links a user to their pending form_collaborators invitations
 * @param userData The user data containing id and email
 * @returns Object with success status and number of invitations updated
 */
async function linkUserInvitations(userData: UserData) {
  try {
    // Validate the UUID before proceeding
    if (!userData.id || userData.id === 'null' || userData.id === 'undefined') {
      throw new Error('Invalid user ID: cannot be null or undefined');
    }

    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = userData.email.toLowerCase();
    
    // First, check if there are any invitations that match the email
    const { data: checkData, error: checkError } = await supabase
      .from('form_collaborators')
      .select('id')
      .filter('invitation_email', 'ilike', normalizedEmail)
      .is('user_id', null)
      .limit(1);
      
    if (checkError) {
      console.error('Error checking for invitations:', checkError);
      throw checkError;
    }
    
    // If no invitations are found, return early
    if (!checkData || checkData.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        invitations: []
      };
    }
    
    // Update pending invitations for this user
    const { data, error } = await supabase
      .from('form_collaborators')
      .update({
        user_id: userData.id,
        invitation_accepted: true,
        updated_at: new Date().toISOString()
      })
      .filter('invitation_email', 'ilike', normalizedEmail) // Case-insensitive match
      .is('user_id', null) // Only update invitations that haven't been linked yet
      .select();
      
    if (error) {
      console.error('Error updating invitations:', error);
      throw error;
    }
    
    return {
      success: true,
      updatedCount: data?.length || 0,
      invitations: data || []
    };
  } catch (error) {
    console.error('Error in linkUserInvitations:', error);
    throw error;
  }
}

export const handler: Handler = async (event) => {
  try {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' })
      };
    }
    
    // Parse the request body
    let userData: UserData;
    try {
      const body = JSON.parse(event.body || '{}');
      console.log('Received request body:', JSON.stringify(body));
      
      // Extract user data from payload
      if (body.record) {
        // From webhook format
        userData = {
          id: body.record.id,
          email: body.record.email
        };
      } else {
        // Direct API call format
        userData = {
          id: body.id,
          email: body.email
        };
      }
      
      // Validate required fields
      if (!userData.id || !userData.email) {
        console.error('Missing required user data:', userData);
        throw new Error('Missing required user data (id and email)');
      }
      
      console.log('Processing user data:', { id: userData.id, email: userData.email });
    } catch (error) {
      console.error('Error parsing request body:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Invalid request body'
        })
      };
    }
    
    // Link the user to their invitations
    const result = await linkUserInvitations(userData);
    
    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Invitations updated successfully',
        updatedCount: result.updatedCount,
        invitations: result.invitations
      })
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      })
    };
  }
}; 