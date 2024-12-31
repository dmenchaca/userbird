// API functionality
const API_BASE_URL = 'https://userbird.netlify.app';

export async function getFormSettings(formId) {
  try {
    const response = await fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { button_color: '#1f2937' };
  }
}

export async function submitFeedback(formId, message) {
  const response = await fetch(`${API_BASE_URL}/.netlify/functions/feedback`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Origin': window.location.origin
    },
    body: JSON.stringify({ formId, message })
  });

  if (!response.ok) {
    throw new Error('Failed to submit feedback');
  }
  
  return response.json();
}