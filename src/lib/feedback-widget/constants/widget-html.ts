export const WIDGET_HTML = {
  MODAL: `
    <div class="ub-modal-content">
      <h3 class="ub-title">Send Feedback</h3>
      <textarea class="ub-textarea" placeholder="What's on your mind?"></textarea>
      <div class="ub-error"></div>
      <div class="ub-buttons">
        <button class="ub-button ub-button-secondary ub-close">Cancel</button>
        <button class="ub-button ub-submit">Send Feedback</button>
      </div>
      <div class="ub-success">
        <svg class="ub-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 4L12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3 class="ub-success-title">Thank you</h3>
        <p class="ub-success-message">Your message has been received and will be reviewed by our team.</p>
        <button class="ub-button ub-close">Close</button>
      </div>
      <div class="ub-version"></div>
    </div>
  `
};