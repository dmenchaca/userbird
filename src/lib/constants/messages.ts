export const FEEDBACK_MESSAGES = {
  success: {
    title: 'Thank you',
    description: 'Your message has been received and will be reviewed by our team.',
    gifUrl: 'https://ruqbgoazhyfxrsxbttfp.supabase.co/storage/v1/object/public/app//Season%202%20Nbc%20GIF%20by%20The%20Office.gif'
  },
  error: {
    default: 'Failed to submit feedback',
    networkError: 'Network error occurred',
    validation: 'Please enter a message'
  },
  labels: {
    submit: 'Send Feedback',
    submitting: 'Sending...',
    close: 'Close',
    cancel: 'Cancel'
  },
  placeholders: {
    textarea: "What's on your mind?"
  }
}