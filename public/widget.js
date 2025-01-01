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

  // Logger utility
  const Logger = {
    debug: (message, ...args) => console.log(`[Userbird Debug] ${message}`, ...args),
    error: (message, ...args) => console.error(`[Userbird Error] ${message}`, ...args)
  };

  function createModal() {
    const modal = document.createElement('div');
    const backdrop = document.createElement('div');
    
    modal.className = 'userbird-modal';
    backdrop.className = 'userbird-backdrop';
    
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

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    return {
      modal,
      backdrop,
      form: modal.querySelector('.userbird-form'),
      textarea: modal.querySelector('.userbird-textarea'),
      submitButton: modal.querySelector('.userbird-submit'),
      closeButtons: modal.querySelectorAll('.userbird-close'),
      errorElement: modal.querySelector('.userbird-error'),
      successElement: modal.querySelector('.userbird-success')
    };
  }

  function injectStyles() {
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
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
      }
      .userbird-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .userbird-button {
        min-width: 120px;
        padding: 0.75rem 1.25rem;
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
        background: #2563eb;
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
      .userbird-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
      }
      .userbird-backdrop.open { display: block; }
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

  async function submitFeedback(formId, message) {
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

  function positionModal(trigger, modalElement) {
    if (!trigger) {
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow >= 400) {
      modalElement.style.top = `${rect.bottom + 8}px`;
      modalElement.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 408))}px`;
      modalElement.style.transform = 'none';
    } else if (spaceAbove >= 400) {
      modalElement.style.top = `${rect.top - 400 - 8}px`;
      modalElement.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 408))}px`;
      modalElement.style.transform = 'none';
    } else {
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
    }
  }

  function init(formId) {
    Logger.debug('Initializing widget', { formId });

    // Inject styles
    injectStyles();
    
    // Create modal
    const elements = createModal();
    
    // Get trigger button
    const trigger = document.getElementById(`userbird-trigger-${formId}`);
    
    function openModal() {
      elements.modal.classList.add('open');
      elements.backdrop.classList.add('open');
      elements.textarea.focus();
      positionModal(trigger, elements.modal);
    }

    function closeModal() {
      elements.modal.classList.remove('open');
      elements.backdrop.classList.remove('open');
      setTimeout(() => {
        elements.textarea.value = '';
        elements.form.classList.remove('hidden');
        elements.successElement.classList.remove('open');
        elements.submitButton.disabled = false;
        elements.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
      }, 200);
    }

    // Event handlers
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    }

    elements.closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    elements.backdrop.addEventListener('click', closeModal);

    elements.submitButton.addEventListener('click', async () => {
      const message = elements.textarea.value.trim();
      if (!message) return;

      elements.submitButton.disabled = true;
      elements.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submitting;

      try {
        await submitFeedback(formId, message);
        elements.form.classList.add('hidden');
        elements.successElement.classList.add('open');
      } catch (error) {
        elements.errorElement.textContent = 'Failed to submit feedback';
        elements.errorElement.style.display = 'block';
        elements.submitButton.disabled = false;
        elements.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
      }
    });

    // Expose public API
    window.UserBird = {
      ...window.UserBird,
      open: openModal,
      close: closeModal
    };
  }

  // Initialize if form ID is available
  const formId = window.UserBird?.formId;
  if (formId) {
    init(formId);
  }
})();