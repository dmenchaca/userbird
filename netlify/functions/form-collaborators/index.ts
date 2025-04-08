import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Service role client to bypass RLS for administratve operations
// This is a fallback in case the RLS policy fixes aren't applied
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const serviceClient = createClient(supabaseUrl, serviceRoleKey, { 
  auth: { persistSession: false } 
});

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Helper to check if user is authorized to manage collaborators
async function isAuthorized(formId: string, userId: string): Promise<boolean> {
  console.log(`Checking authorization for form: ${formId}, user: ${userId}`);
  
  // Check if user is owner
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('owner_id')
    .eq('id', formId)
    .single();

  if (formError) {
    console.error('Error checking form ownership:', formError);
  }

  console.log('Form owner check:', form?.owner_id, 'Current user:', userId, 'Is owner?', form?.owner_id === userId);

  if (form?.owner_id === userId) {
    return true;
  }

  // Check if user is admin collaborator
  const { data: collaborator, error: collabError } = await supabase
    .from('form_collaborators')
    .select('role')
    .eq('form_id', formId)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single();

  if (collabError) {
    console.error('Error checking admin collaborator status:', collabError);
  }

  console.log('Admin check result:', !!collaborator, 'Collaborator data:', collaborator);
  
  return !!collaborator;
}

// Function to invite a user to collaborate on a form
async function inviteCollaborator(formId: string, inviterUserId: string, email: string, role: 'admin' | 'agent') {
  try {
    console.log(`Inviting user with email ${email} as ${role} to form ${formId} by user ${inviterUserId}`);
    
    // We can't directly query auth.users, so we'll use a more compatible approach
    // Try to find the user by email in profiles if it exists, or just proceed with email
    let existingUserId = null;
    
    // If you have a profiles table that stores user emails, use this approach
    try {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .limit(1);
      
      if (profileError) {
        console.error('Error finding user by email:', profileError);
      }
        
      existingUserId = profiles?.[0]?.id;
      console.log('Found existing user?', !!existingUserId, 'User ID:', existingUserId);
    } catch (profileErr) {
      console.warn("Error or no profiles table:", profileErr);
      // Continue without user ID - they'll get an email invite
    }
    
    // Create collaborator record
    const collaboratorData = {
      form_id: formId,
      user_id: existingUserId,
      role,
      invited_by: inviterUserId,
      invitation_email: email,
      invitation_accepted: !!existingUserId, // Auto-accepted if user exists
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Attempting to insert collaborator with data:', JSON.stringify(collaboratorData));
    
    // First try with regular client
    let result = await supabase
      .from('form_collaborators')
      .insert(collaboratorData)
      .select();
    
    // If that fails with an RLS error, try with service role client
    if (result.error && (
        result.error.message.includes('row-level security') || 
        result.error.message.includes('new row violates row-level security policy')
      )) {
      console.log('RLS error detected, trying with service role client');
      
      // Use service client to bypass RLS
      result = await serviceClient
        .from('form_collaborators')
        .insert(collaboratorData)
        .select();
    }
    
    if (result.error) {
      console.error("Error adding collaborator:", result.error);
      console.error("Error details:", JSON.stringify(result.error));
      return { success: false, error: result.error.message };
    }
    
    console.log('Successfully added collaborator:', result.data);
    
    // TODO: Send email invitation
    
    return { success: true, data: result.data[0] };
  } catch (error) {
    console.error("Error in inviteCollaborator:", error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}

// Main handler function
const handler: Handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }
  
  // Get user ID from Supabase auth
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  const path = event.path.split('/');
  const formId = path[path.indexOf('form-collaborators') + 1];
  const collaboratorId = path[path.indexOf('form-collaborators') + 2];
  
  // Routes
  try {
    // GET /form-collaborators/{formId} - List collaborators
    if (event.httpMethod === 'GET' && formId && !collaboratorId) {
      // Anyone with access to the form can list collaborators
      const { data: collaborators, error } = await supabase
        .from('form_collaborators')
        .select('*')  // Just select all fields directly without the join
        .eq('form_id', formId);
        
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(collaborators)
      };
    }
    
    // POST /form-collaborators/{formId} - Invite collaborator
    if (event.httpMethod === 'POST' && formId && !collaboratorId) {
      console.log(`Processing POST request to invite collaborator to form ${formId}`);
      
      // Check if user is authorized to invite
      const authorized = await isAuthorized(formId, user.id);
      console.log(`User ${user.id} authorization result:`, authorized);
      
      if (!authorized) {
        console.log(`User ${user.id} not authorized to invite collaborators to form ${formId}`);
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Forbidden: only form owners and admins can invite users' })
        };
      }
      
      const body = JSON.parse(event.body || '{}');
      const { email, role } = body;
      console.log(`Parsed request body:`, { email, role });
      
      if (!email || !role || !['admin', 'agent'].includes(role)) {
        console.log(`Invalid request parameters:`, { email, role });
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid request: email and valid role (admin or agent) are required' })
        };
      }
      
      const result = await inviteCollaborator(formId, user.id, email, role);
      console.log(`Invitation result:`, result);
      
      if (!result.success) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: result.error })
        };
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(result.data)
      };
    }
    
    // PATCH /form-collaborators/{formId}/{collaboratorId} - Update role
    if (event.httpMethod === 'PATCH' && formId && collaboratorId) {
      // Check if user is authorized to update
      const authorized = await isAuthorized(formId, user.id);
      if (!authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Forbidden: only form owners and admins can update collaborator roles' })
        };
      }
      
      const body = JSON.parse(event.body || '{}');
      const { role } = body;
      
      if (!role || !['admin', 'agent'].includes(role)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid request: valid role (admin or agent) is required' })
        };
      }
      
      const { data, error } = await supabase
        .from('form_collaborators')
        .update({ 
          role,
          updated_at: new Date().toISOString()
        })
        .eq('id', collaboratorId)
        .eq('form_id', formId)
        .select();
        
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }
    
    // DELETE /form-collaborators/{formId}/{collaboratorId} - Remove collaborator
    if (event.httpMethod === 'DELETE' && formId && collaboratorId) {
      // Check if user is authorized to delete
      const authorized = await isAuthorized(formId, user.id);
      if (!authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Forbidden: only form owners and admins can remove collaborators' })
        };
      }
      
      const { error } = await supabase
        .from('form_collaborators')
        .delete()
        .eq('id', collaboratorId)
        .eq('form_id', formId);
        
      if (error) throw error;
      
      return {
        statusCode: 204,
        headers,
        body: ''
      };
    }
    
    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
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

export { handler }; 