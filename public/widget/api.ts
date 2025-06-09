// API functionality
const API_BASE_URL = 'https://usermonk.netlify.app';

interface FeedbackSubmission {
  formId: string;
  message: string;
}

export async function submitFeedback({ formId, message }: FeedbackSubmission) {
  const response = await fetch(`${API_BASE_URL}/.netlify/functions/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formId, message })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit feedback');
  }
  
  return data;
}