// Main widget code
(function() {
  const Logger = {
    debug: (message, ...args) => console.log(`[Userbird Debug] ${message}`, ...args),
    error: (message, ...args) => console.error(`[Userbird Error] ${message}`, ...args)
  };

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

  async function getFormSettings(formId) {
    try {
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`);
      const data = await response.json();
      Logger.debug('Form settings:', data);
      return data;
    } catch (error) {
      Logger.error('Error fetching form settings:', error);
      return { button_color: '#1f2937' };
    }
  }

  async function submitFeedback(formId, message) {
    Logger.debug('Submitting feedback:', { formId, message });
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
    const backdrop = document.createElement('div');
    
    modal.className = 'userbird-modal';
    backdrop.className = 'userbird-backdrop';
    
    modal.innerHTML = `
      <div class="userbird-modal-content">
        <h3 class="userbird-title">Send Feedback</h3>
        <textarea class="userbird-textarea" placeholder="What's on your mind?"></textarea>
        <div class="userbird-error"></div>
        <div class="userbird-buttons">
          <button class="userbird-button userbird-button-secondary userbird-close">${MESSAGES.labels.cancel}</button>
          <button class="userbird-button userbird-submit">
            <span class="userbird-submit-text">${MESSAGES.labels.submit}</span>
            <svg class="userbird-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle class="userbird-spinner-circle" cx="12" cy="12" r="10" stroke-width="4"></circle>
            </svg>
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
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    return {
      modal,
      backdrop,
      textarea: modal.querySelector('.userbird-textarea'),
      submitButton: modal.querySelector('.userbird-submit'),
      closeButton: modal.querySelector('.userbird-close'),
      errorElement: modal.querySelector('.userbird-error'),
      successElement: modal.querySelector('.userbird-success')
    };
  }

  function injectStyles(buttonColor) {
    Logger.debug('Injecting styles with button color:', buttonColor);
    const style = document.createElement('style');
    style.textContent = `
      .userbird-button {
        background-color: ${buttonColor} !important;
        color: white !important;
        border: none !important;
        padding: 12px 20px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-family: inherit !important;
        font-size: 14px !important;
        transition: opacity 0.2s !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        min-width: 120px !important;
        font-weight: 500 !important;
      }
      .userbird-button:hover {
        opacity: 0.9 !important;
      }
      .userbird-button:disabled {
        opacity: 0.7 !important;
        cursor: not-allowed !important;
      }
      .userbird-button-secondary {
        background: transparent !important;
        border: 1px solid #e5e7eb !important;
        color: #6b7280 !important;
        padding: 11px 19px !important;
      }
      .userbird-button-secondary:hover {
        background: #f3f4f6 !important;
        opacity: 1 !important;
      }
      .userbird-spinner {
        display: none;
        width: 16px !important;
        height: 16px !important;
        animation: userbird-spin 1s linear infinite !important;
      }
      .userbird-spinner-circle {
        opacity: 0.25;
      }
      .userbird-spinner-circle:nth-child(1) {
        opacity: 1;
        stroke-dasharray: 60;
        stroke-dashoffset: 60;
        animation: userbird-circle 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      .userbird-submit[disabled] .userbird-spinner {
        display: block !important;
      }
      .userbird-submit[disabled] .userbird-submit-text {
        opacity: 0.8 !important;
      }
      @keyframes userbird-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes userbird-circle {
        100% { stroke-dashoffset: 0; }
      }
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
      }
      .userbird-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: #111827;
      }
      .userbird-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
      }
      .userbird-backdrop.open { display: block; }
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
        transition: border-color 0.2s;
      }
      .userbird-textarea:focus {
        outline: none;
        border-color: ${buttonColor};
        box-shadow: 0 0 0 2px ${buttonColor}33;
      }
      .userbird-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1rem;
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
      .userbird-success.open { display: block; }
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
    Logger.debug('Styles injected, style element added:', document.head.contains(style));
  }

  const UserBirdWidget = {
    async init(config) {
      Logger.debug('Initializing widget with config:', config);
      const { formId } = config;
      
      // Get form settings including button color
      const settings = await getFormSettings(formId);
      Logger.debug('Retrieved settings:', settings);
      
      // Inject styles with the button color
      injectStyles(settings.button_color);
      
      // Get trigger button
      const trigger = document.getElementById(`userbird-trigger-${formId}`);
      if (!trigger) {
        Logger.error('Trigger button not found');
        return;
      }

      // Apply button styles
      trigger.className = 'userbird-button ' + trigger.className;
      
      // Log computed styles to verify color application
      const computedStyle = window.getComputedStyle(trigger);
      Logger.debug('Trigger button computed styles:', {
        background: computedStyle.backgroundColor,
        color: computedStyle.color
      });

      // Create and set up modal
      const elements = createModal();
      
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        elements.modal.classList.add('open');
        elements.backdrop.classList.add('open');
        elements.textarea.focus();
      });

      const closeModal = () => {
        elements.modal.classList.remove('open');
        elements.backdrop.classList.remove('open');
        elements.textarea.value = '';
        elements.successElement.classList.remove('open');
        elements.submitButton.disabled = false;
        elements.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
      };

      elements.closeButton.addEventListener('click', closeModal);
      elements.backdrop.addEventListener('click', closeModal);

      elements.submitButton.addEventListener('click', async () => {
        const message = elements.textarea.value.trim();
        if (!message) return;

        elements.submitButton.disabled = true;
        elements.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submitting;

        try {
          await submitFeedback(formId, message);
          elements.successElement.classList.add('open');
        } catch (error) {
          Logger.error('Failed to submit feedback:', error);
          elements.errorElement.textContent = 'Failed to submit feedback';
          elements.errorElement.style.display = 'block';
          elements.submitButton.disabled = false;
          elements.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
        }
      });
    }
  };

  // Initialize widget
  const formId = window.UserBird?.formId;
  if (formId) {
    UserBirdWidget.init({ formId }).catch(error => {
      Logger.error('Failed to initialize widget:', error);
    });
  }
})();