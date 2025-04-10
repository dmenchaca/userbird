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
      return { success: false, error: 'No authenticated user found' };
    }
    
    // Update any pending invitations that match this user's email
    const { data, error } = await supabase
      .from('form_collaborators')
      .update({ 
        user_id: user.id,
        invitation_accepted: true,
        updated_at: new Date().toISOString()
      })
      .match({ 
        invitation_email: user.email,
        user_id: null 
      });
      
    if (error) {
      console.error('Error linking invitations:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Exception linking invitations:', error);
    return { success: false, error };
  }
} 