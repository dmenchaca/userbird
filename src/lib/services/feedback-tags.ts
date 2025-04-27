import { supabase } from '@/lib/supabase';

/**
 * Creates a tag change event in the feedback_replies table
 * 
 * @param feedbackId The ID of the feedback being tagged
 * @param tagId The ID of the tag being applied (or null if tag is being removed)
 * @param oldTagId The ID of the previous tag (or null if there was no previous tag)
 * @param senderId The user ID of the admin making the tag change
 * @param meta Optional metadata to include with the tag change
 * @returns The newly created tag change event or null if there was an error
 */
export const createTagChangeEvent = async (
  feedbackId: string, 
  tagId: string | null,
  oldTagId: string | null,
  senderId: string,
  meta?: Record<string, any>
) => {
  try {
    // Insert the tag change event into the feedback_replies table
    const { data, error } = await supabase
      .from('feedback_replies')
      .insert([{
        feedback_id: feedbackId,
        type: 'tag_change',
        sender_type: 'admin',
        sender_id: senderId,
        meta: {
          ...meta || {},
          tag_id: tagId,
          old_tag_id: oldTagId,
          action: tagId ? (oldTagId ? 'changed' : 'added') : 'removed'
        }
      }])
      .select();

    if (error) {
      console.error('Error creating tag change event:', error);
      return null;
    }

    console.log('Created tag change event:', data?.[0]);
    return data?.[0] || null;
  } catch (error) {
    console.error('Error creating tag change event:', error);
    return null;
  }
};

/**
 * Updates the tag of a feedback item and creates a tag change event
 * 
 * @param feedbackId The ID of the feedback being tagged
 * @param tagId The ID of the tag being applied (or null to remove tag)
 * @param senderId The user ID of the admin making the tag change
 * @param meta Optional metadata to include with the assignment
 * @returns Whether the tag change was successful
 */
export const updateFeedbackTag = async (
  feedbackId: string,
  tagId: string | null,
  senderId: string,
  meta?: Record<string, any>
): Promise<boolean> => {
  try {
    // First, get the current tag_id for the feedback
    const { data: currentData, error: fetchError } = await supabase
      .from('feedback')
      .select('tag_id')
      .eq('id', feedbackId)
      .single();

    if (fetchError) {
      console.error('Error fetching current tag:', fetchError);
      return false;
    }

    const oldTagId = currentData?.tag_id || null;
    
    // If tag is not changing, don't do anything
    if (oldTagId === tagId) {
      return true;
    }

    // Update the feedback's tag_id
    const { error: updateError } = await supabase
      .from('feedback')
      .update({ tag_id: tagId })
      .eq('id', feedbackId);

    if (updateError) {
      console.error('Error updating feedback tag:', updateError);
      return false;
    }

    // Create a tag change event
    const result = await createTagChangeEvent(
      feedbackId,
      tagId,
      oldTagId,
      senderId,
      meta
    );

    return !!result;
  } catch (error) {
    console.error('Error updating feedback tag:', error);
    return false;
  }
}; 