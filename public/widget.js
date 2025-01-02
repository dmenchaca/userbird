// Userbird Widget
(function() {
  // ... existing code ...

  function createModal() {
    const modal = document.createElement('div');
    
    modal.className = 'userbird-modal';
    
    modal.innerHTML = `
      <div class="userbird-modal-content">
        <div class="userbird-form">
          <h3 class="userbird-title">Send Feedback</h3>
          <textarea class="userbird-textarea" placeholder="Help us improve this page"></textarea>
          <div class="userbird-error"></div>
          <div class="userbird-buttons">
            <button class="userbird-button userbird-button-secondary userbird-close">${MESSAGES.labels.cancel}</button>
            <button class="userbird-button userbird-submit">
              <span class="userbird-submit-text">${MESSAGES.labels.submit}</span>
              <svg class="userbird-spinner" viewBox="0 0 24 24">
                <circle class="userbird-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" fill="none" stroke-width="4"/>
              </svg>
            </button>
          </div>
          <div class="userbird-support-text">Have a specific issue? Contact support or read our docs.</div>
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
    `;

    // ... rest of the function ...
  }

  function injectStyles(buttonColor) {
    const style = document.createElement('style');
    style.textContent = `
      /* ... existing styles ... */

      .userbird-support-text {
        font-size: 0.75rem;
        color: #6b7280;
        text-align: center;
        margin-top: 1rem;
      }

      /* ... rest of the styles ... */
    `;
    document.head.appendChild(style);
  }

  // ... rest of the code ...
})();