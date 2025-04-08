import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Helper to check if user is authorized to manage collaborators
async function isAuthorized(formId: string, userId: string): Promise<boolean> {
  // Check if user is owner
  const { data: form } = await supabase
    .from('forms')
    .select('owner_id')
    .eq('id', formId)
    .single();

  if (form?.owner_id === userId) {
    return true;
  }

  // Check if user is admin collaborator
  const { data: collaborator } = await supabase
    .from('form_collaborators')
    .select('role')
    .eq('form_id', formId)
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single();

  return !!collaborator;
}

// Function to invite a user to collaborate on a form
async function inviteCollaborator(formId: string, inviterUserId: string, email: string, role: 'admin' | 'agent') {
  // Check if user with this email already exists
  const { data: existingUsers } = await supabase
    .from('auth.users')
    .select('id, email')
    .eq('email', email)
    .limit(1);

  const existingUser = existingUsers?.[0];
  
  // Create collaborator record
  const collaboratorData = {
    form_id: formId,
    user_id: existingUser?.id || null,
    role,
    invited_by: inviterUserId,
    invitation_email: email,
    invitation_accepted: !!existingUser, // Auto-accepted if user exists
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('form_collaborators')
    .insert(collaboratorData)
    .select();
    
  if (error) {
    return { success: false, error };
  }
  
  // TODO: Send email invitation
  
  return { success: true, data };
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
        .select('*, user:user_id(id, email)')
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
      // Check if user is authorized to invite
      const authorized = await isAuthorized(formId, user.id);
      if (!authorized) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Forbidden: only form owners and admins can invite users' })
        };
      }
      
      const body = JSON.parse(event.body || '{}');
      const { email, role } = body;
      
      if (!email || !role || !['admin', 'agent'].includes(role)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid request: email and valid role (admin or agent) are required' })
        };
      }
      
      const result = await inviteCollaborator(formId, user.id, email, role);
      
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