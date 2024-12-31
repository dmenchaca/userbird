// Shared constants
export const MESSAGES = {
  success: {
    title: 'Thank you',
    description: 'Your message has been received and will be reviewed by our team.'
  },
  labels: {
    submit: 'Send Feedback',
    submitting: 'Sending Feedback...',
    close: 'Close',
    cancel: 'Cancel'
  },
  placeholders: {
    textarea: "What's on your mind?"
  }
};

export const TEMPLATES = {
  SPINNER: `
    <svg class="userbird-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle class="userbird-spinner-circle" cx="12" cy="12" r="10" stroke-width="4"></circle>
    </svg>
  `,
  
  MODAL: `
    <div class="userbird-modal-content">
      <h3 class="userbird-title">Send Feedback</h3>
      <textarea class="userbird-textarea" placeholder="What's on your mind?"></textarea>
      <div class="userbird-error"></div>
      <div class="userbird-buttons">
        <button class="userbird-button userbird-button-secondary userbird-close">${MESSAGES.labels.cancel}</button>
        <button class="userbird-button userbird-submit">
          <span class="userbird-submit-text">${MESSAGES.labels.submit}</span>
          ${TEMPLATES.SPINNER}
        </button>
      </div>
      <div class="userbird-success">
        <svg class="userbird-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 4L12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3 class="userbird-success-title">${MESSAGES.success.title}</h3>
        <p class="userbird-success-message">${MESSAGES.success.description}</p>
        <button class="userbird-button userbird-close">${MESSAGES.labels.close}</button>
      </div>
    </div>
  `
};