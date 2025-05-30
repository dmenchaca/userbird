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
 * Updates the assignee of a feedback item and creates an assignment event
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