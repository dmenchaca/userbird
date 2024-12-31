// Main widget code
(function() {
  const Logger = {
    debug: (message, ...args) => console.log(`[Userbird Debug] ${message}`, ...args),
    error: (message, ...args) => console.error(`[Userbird Error] ${message}`, ...args)
  };

  const API_BASE_URL = 'https://userbird.netlify.app';

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
      <h3>Send Feedback</h3>
      <textarea class="userbird-textarea" placeholder="What's on your mind?"></textarea>
      <div class="userbird-buttons">
        <button class="userbird-close">Cancel</button>
        <button class="userbird-submit">Send</button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    return {
      modal,
      backdrop,
      textarea: modal.querySelector('.userbird-textarea'),
      submitButton: modal.querySelector('.userbird-submit'),
      closeButton: modal.querySelector('.userbird-close')
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
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-family: inherit !important;
        font-size: 14px !important;
      }
      .userbird-button:hover {
        opacity: 0.9 !important;
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
        padding: 1rem;
      }
      .userbird-modal.open { display: block; }
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
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        resize: vertical;
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
      });

      elements.closeButton.addEventListener('click', () => {
        elements.modal.classList.remove('open');
        elements.backdrop.classList.remove('open');
      });

      elements.backdrop.addEventListener('click', () => {
        elements.modal.classList.remove('open');
        elements.backdrop.classList.remove('open');
      });

      elements.submitButton.addEventListener('click', async () => {
        const message = elements.textarea.value.trim();
        if (!message) return;

        try {
          await submitFeedback(formId, message);
          elements.modal.classList.remove('open');
          elements.backdrop.classList.remove('open');
          elements.textarea.value = '';
        } catch (error) {
          Logger.error('Failed to submit feedback:', error);
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