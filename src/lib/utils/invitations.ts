import { supabase } from '@/lib/supabase';

/**
 * Links any pending invitations to the current user's account
 * This function should be called after a user has successfully logged in
 * or when they first access the dashboard
 */
export async function linkPendingInvitations() {
  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
      console.log('No authenticated user found or missing email');
      return { success: false, error: 'No authenticated user found' };
    }
    
    console.log('Checking invitations for email:', user.email);
    
    // First, let's check the pending invitations to debug
    const { data: pendingInvites } = await supabase
      .from('form_collaborators')
      .select('*')
      .is('user_id', null)
      .eq('invitation_accepted', false);
      
    console.log('Found pending invitations:', pendingInvites);
    
    // Handle the case for emails with + signs (e.g., hi+8@diego.bio)
    const emailParts = user.email.split('@');
    const baseEmail = emailParts[0];
    const domain = emailParts[1];
    
    // Try to update invitations that match by exact email
    let result = await supabase
      .from('form_collaborators')
      .update({ 
        user_id: user.id,
        invitation_accepted: true,
        updated_at: new Date().toISOString()
      })
      .eq('invitation_email', user.email)
      .is('user_id', null)
      .select();
      
    console.log('Exact email match updates:', result.data);
    
    // If we didn't find any matches, try with ILIKE for emails with + signs
    if (!result.data || result.data.length === 0) {
      // For emails like hi+8@diego.bio
      if (baseEmail.includes('+')) {
        const realBaseEmail = baseEmail.split('+')[0];
        
        result = await supabase
          .from('form_collaborators')
          .update({ 
            user_id: user.id,
            invitation_accepted: true,
            updated_at: new Date().toISOString()
          })
          .like('invitation_email', `${realBaseEmail}+%@${domain}`)
          .is('user_id', null)
          .select();
          
        console.log('Plus sign email match updates:', result.data);
      } else {
        // Try to match invitations that might have been sent to email+tag@domain.com
        result = await supabase
          .from('form_collaborators')
          .update({ 
            user_id: user.id,
            invitation_accepted: true,
            updated_at: new Date().toISOString()
          })
          .like('invitation_email', `${baseEmail}+%@${domain}`)
          .is('user_id', null)
          .select();
          
        console.log('Base email with + match updates:', result.data);
      }
    }
    
    // Final attempt - try with case insensitive match
    if (!result.data || result.data.length === 0) {
      result = await supabase
        .from('form_collaborators')
        .update({ 
          user_id: user.id,
          invitation_accepted: true,
          updated_at: new Date().toISOString()
        })
        .ilike('invitation_email', `%@${domain}`)
        .is('user_id', null)
        .select();
        
      console.log('Domain-only match updates:', result.data);
    }
      
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Exception linking invitations:', error);
    return { success: false, error };
  }
}

/**
 * For debugging - directly update a specific invitation by ID
 */
export async function acceptInvitationById(invitationId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('No user found');
      return { success: false };
    }
    
    const { data, error } = await supabase
      .from('form_collaborators')
      .update({
        user_id: user.id,
        invitation_accepted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', invitationId)
      .select();
      
    if (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error };
    }
    
    console.log('Accepted invitation result:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Exception accepting invitation:', error);
    return { success: false, error };
  }
} 