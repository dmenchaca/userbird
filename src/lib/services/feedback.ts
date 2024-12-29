import { supabase } from '../supabase'

interface FeedbackSubmission {
  formId: string
  message: string
}

export async function submitFeedback({ formId, message }: FeedbackSubmission) {
  if (!formId || !message.trim()) {
    throw new Error('Form ID and message are required')
  }

  const { error } = await supabase
    .from('feedback')
    .insert([{ form_id: formId, message }])

  if (error) throw error

  return { success: true }
}