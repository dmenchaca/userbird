// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  
  const MESSAGES = {
    success: {
      title: 'Thank you',
      description: 'Your message has been received and will be reviewed by our team.'
    },
    labels: {
      submit: 'Send Feedback',
      submitting: 'Sending Feedback...',
      close: 'Close',
      cancel: 'Cancel'
    }
  };

  let modal = null;
  let formId = null;

  async function submitFeedback(message) {
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

  function createModal() {
    const modal = document.createElement('div');
    
    modal.className = 'userbird-modal';
    
    modal.innerHTML = `
      <div class="userbird-modal-content">
        <div class="userbird-form">
          <h3 class="userbird-title">Send Feedback</h3>
          <textarea class="userbird-textarea" placeholder="What's on your mind?"></textarea>
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

    document.body.appendChild(modal);

    return {
      modal,
      form: modal.querySelector('.userbird-form'),
      textarea: modal.querySelector('.userbird-textarea'),
      submitButton: modal.querySelector('.userbird-submit'),
      closeButtons: modal.querySelectorAll('.userbird-close'),
      errorElement: modal.querySelector('.userbird-error'),
      successElement: modal.querySelector('.userbird-success')
    };
  }

  function injectStyles(buttonColor) {
    const style = document.createElement('style');
    style.textContent = `
      .userbird-modal {
        display: none;
        position: fixed;
        z-index: 10000;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        width: 400px;
        max-width: calc(100vw - 2rem);
      }
      .userbird-modal.open { display: block; }
      .userbird-modal-content {
        padding: 1.5rem;
        position: relative;
      }
      .userbird-form {
        display: block;
      }
      .userbird-form.hidden {
        display: none;
      }
      .userbird-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #111827;
      }
      .userbird-textarea {
        width: 100%;
        min-height: 100px;
        margin: 1rem 0;
        padding: 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        resize: vertical;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
      }
      .userbird-textarea:focus {
        outline: none;
        border-color: ${buttonColor};
        box-shadow: 0 0 0 2px ${buttonColor}33;
      }
      .userbird-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .userbird-button {
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .userbird-button {
        background: ${buttonColor};
        color: white;
        border: none;
      }
      .userbird-button:hover {
        opacity: 0.9;
      }
      .userbird-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      .userbird-button-secondary {
        background: transparent;
        color: #6b7280;
        border: 1px solid #e5e7eb;
      }
      .userbird-button-secondary:hover {
        background: #f3f4f6;
      }
      .userbird-spinner {
        display: none;
        width: 16px;
        height: 16px;
        animation: userbird-spin 1s linear infinite;
      }
      .userbird-submit[disabled] .userbird-spinner {
        display: block;
      }
      @keyframes userbird-spin {
        to { transform: rotate(360deg); }
      }
      .userbird-error {
        display: none;
        color: #dc2626;
        font-size: 0.875rem;
        margin-top: 0.5rem;
      }
      .userbird-success {
        display: none;
        text-align: center;
        padding: 2rem 1rem;
      }
      .userbird-success.open {
        display: block;
      }
      .userbird-success-icon {
        width: 48px;
        height: 48px;
        margin: 0 auto 1rem;
        color: #22c55e;
      }
      .userbird-success-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: #111827;
      }
      .userbird-success-message {
        color: #6b7280;
        font-size: 0.875rem;
        margin-bottom: 1.5rem;
      }
    `;
    document.head.appendChild(style);
  }

  function positionModal(trigger) {
    if (!modal?.modal) return;
    
    const modalElement = modal.modal;
    const rect = trigger ? trigger.getBoundingClientRect() : null;
    
    if (rect) {
      // Position relative to trigger
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow >= 400) {
        modalElement.style.top = `${rect.bottom + 8}px`;
        modalElement.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 408))}px`;
      } else if (spaceAbove >= 400) {
        modalElement.style.top = `${rect.top - 400 - 8}px`;
        modalElement.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 408))}px`;
      } else {
        // Center if no good position relative to trigger
        modalElement.style.top = '50%';
        modalElement.style.left = '50%';
        modalElement.style.transform = 'translate(-50%, -50%)';
      }
    } else {
      // Center modal if no trigger
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
    }
  }

  function openModal(trigger = null) {
    if (!modal) return;
    modal.modal.classList.add('open');
    modal.textarea.focus();
    positionModal(trigger);
  }

  function closeModal() {
    if (!modal) return;
    modal.modal.classList.remove('open');
    setTimeout(() => {
      modal.textarea.value = '';
      modal.form.classList.remove('hidden');
      modal.successElement.classList.remove('open');
      modal.submitButton.disabled = false;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
    }, 200);
  }

  async function init() {
    // Get form settings including button color
    formId = window.UserBird?.formId;
    if (!formId) return;

    const response = await fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`);
    const settings = await response.json();
    const buttonColor = settings.button_color || '#1f2937';
    
    // Inject styles
    injectStyles(buttonColor);
    
    // Create modal
    modal = createModal();
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(defaultTrigger);
      });
    }

    // Event handlers
    modal.closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    modal.submitButton.addEventListener('click', async () => {
      const message = modal.textarea.value.trim();
      if (!message) return;

      modal.submitButton.disabled = true;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submitting;

      try {
        await submitFeedback(message);
        modal.form.classList.add('hidden');
        modal.successElement.classList.add('open');
      } catch (error) {
        modal.errorElement.textContent = 'Failed to submit feedback';
        modal.errorElement.style.display = 'block';
        modal.submitButton.disabled = false;
        modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
      }
    });

    // Expose open method globally
    window.UserBird.open = () => openModal();
  }

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();