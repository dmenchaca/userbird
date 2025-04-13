import { supabase } from '../supabase';

/**
 * Fetches a user's details by their ID
 * 
 * @param userId The ID of the user to fetch
 * @returns The user details or null if not found
 */
export const getUserDetails = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, raw_user_meta_data')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user details:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
};

/**
 * Creates an assignment event in the feedback_replies table
 * 
 * @param feedbackId The ID of the feedback being assigned
 * @param assignedToUserId The user ID of the person being assigned
 * @param senderId The user ID of the admin making the assignment
 * @param meta Optional metadata to include with the assignment
 * @returns The newly created assignment event or null if there was an error
 */
export const createAssignmentEvent = async (
  feedbackId: string, 
  assignedToUserId: string, 
  senderId: string,
  meta?: Record<string, any>
) => {
  try {
    // Insert the assignment event into the feedback_replies table
    const { data, error } = await supabase
      .from('feedback_replies')
      .insert([{
        feedback_id: feedbackId,
        type: 'assignment',
        sender_type: 'admin',
        assigned_to: assignedToUserId,
        sender_id: senderId,
        meta: meta || null
      }])
      .select();

    if (error) {
      console.error('Error creating assignment event:', error);
      return null;
    }

    // Debug the created assignment event
    console.log('Created assignment event:', data?.[0]);

    return data?.[0] || null;
  } catch (error) {
    console.error('Error creating assignment event:', error);
    return null;
  }
};

/**
 * Creates an unassignment event in the feedback_replies table
 * 
 * @param feedbackId The ID of the feedback being unassigned
 * @param senderId The user ID of the admin making the unassignment
 * @param meta Optional metadata to include with the unassignment
 * @returns The newly created unassignment event or null if there was an error
 */
export const createUnassignmentEvent = async (
  feedbackId: string,
  senderId: string,
  meta?: Record<string, any>
) => {
  try {
    // Insert the unassignment event into the feedback_replies table
    const { data, error } = await supabase
      .from('feedback_replies')
      .insert([{
        feedback_id: feedbackId,
        type: 'assignment', // Keep using assignment type for consistency
        sender_type: 'admin',
        assigned_to: null, // Explicitly set to null for unassignment
        sender_id: senderId,
        meta: { ...meta || {}, action: 'unassign' } // Add action metadata
      }])
      .select();

    if (error) {
      console.error('Error creating unassignment event:', error);
      return null;
    }

    // Debug the created unassignment event
    console.log('Created unassignment event:', data?.[0]);

    return data?.[0] || null;
  } catch (error) {
    console.error('Error creating unassignment event:', error);
    return null;
  }
};

/**
 * Sends an assignment notification email
 * 
 * @param feedbackId The ID of the feedback being assigned
 * @param formId The ID of the form the feedback belongs to
 * @param assigneeEmail The email of the person being assigned
 * @param assigneeName The name of the person being assigned
 * @param senderName The name of the admin making the assignment
 * @returns Whether the notification was sent successfully
 */
export const sendAssignmentNotification = async (
  feedbackId: string,
  formId: string,
  assigneeEmail: string,
  assigneeName?: string,
  senderName?: string
): Promise<boolean> => {
  try {
    // Call the Netlify function to send the notification
    const response = await fetch('/.netlify/functions/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'assignment',
        feedbackId,
        formId,
        assigneeEmail,
        assigneeName,
        senderName,
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      console.error('Error sending assignment notification:', await response.text());
      return false;
    }

    const result = await response.json();
    console.log('Assignment notification sent:', result);
    return true;
  } catch (error) {
    console.error('Error sending assignment notification:', error);
    return false;
  }
};

/**
 * Updates the assignee of a feedback item, creates an assignment event, and sends a notification
 * 
 * @param feedbackId The ID of the feedback being assigned
 * @param assigneeId The user ID of the person being assigned (or null to unassign)
 * @param senderId The user ID of the admin making the assignment
 * @param meta Optional metadata to include with the assignment
 * @returns Whether the assignment was successful
 */
export const assignFeedback = async (
  feedbackId: string,
  assigneeId: string | null,
  senderId: string,
  meta?: Record<string, any>
): Promise<boolean> => {
  try {
    // Update the feedback's assignee_id
    const { error: updateError } = await supabase
      .from('feedback')
      .update({ assignee_id: assigneeId })
      .eq('id', feedbackId);

    if (updateError) {
      console.error('Error updating feedback assignee:', updateError);
      return false;
    }

    let result;
    
    // Create an assignment or unassignment event
    if (assigneeId) {
      // This is an assignment
      result = await createAssignmentEvent(
        feedbackId,
        assigneeId,
        senderId,
        { ...meta || {}, action: 'assign' }
      );

      // Get the feedback to find the form_id
      const { data: feedback } = await supabase
        .from('feedback')
        .select('form_id')
        .eq('id', feedbackId)
        .single();

      if (feedback?.form_id) {
        // Get the assignee details
        const { data: assigneeData } = await supabase
          .rpc('get_user_profile_by_id', { user_id_param: assigneeId });
        
        // Get the sender details  
        const { data: senderData } = await supabase
          .rpc('get_user_profile_by_id', { user_id_param: senderId });
        
        if (assigneeData?.email) {
          // Send the notification
          await sendAssignmentNotification(
            feedbackId,
            feedback.form_id,
            assigneeData.email,
            assigneeData.username || assigneeData.email.split('@')[0],
            senderData?.username || senderData?.email?.split('@')[0] || 'Administrator'
          );
        }
      }
    } else {
      // This is an unassignment
      result = await createUnassignmentEvent(
        feedbackId,
        senderId,
        meta
      );
    }

    return !!result;
  } catch (error) {
    console.error('Error assigning feedback:', error);
    return false;
  }
}; 