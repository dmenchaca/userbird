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
    // Use .is() to properly filter for NULL values in SQL
    const { data, error } = await supabase
      .from('form_collaborators')
      .update({ 
        user_id: user.id,
        invitation_accepted: true,
        updated_at: new Date().toISOString()
      })
      .eq('invitation_email', user.email)
      .is('user_id', null)  // Proper way to check for NULL values
      .select();
      
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