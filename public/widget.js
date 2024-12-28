// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  
  const Logger = {
    debug: (message, ...args) => console.log(`[Userbird Debug] ${message}`, ...args),
    error: (message, ...args) => console.error(`[Userbird Error] ${message}`, ...args)
  };

  async function submitFeedback(formId, message) {
    Logger.debug('Submitting feedback to:', `${API_BASE_URL}/.netlify/functions/feedback/`);
    const response = await fetch(`${API_BASE_URL}/.netlify/functions/feedback/`, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      mode: 'cors',
      body: JSON.stringify({ formId, message })
    });

    Logger.debug('Response status:', response.status);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Network error' }));
      Logger.error('Response error:', data);
      throw new Error(data.error || 'Failed to submit feedback');
    }
    
    return response.json();
  }

  // Core widget functionality
  const UserBirdWidget = {
    formId: null,
    state: 'normal', // 'normal' | 'success' | 'error'
    elements: {
      modal: null,
      backdrop: null,
      trigger: null,
      submitButton: null,
      textarea: null,
      errorElement: null,
      successElement: null,
      formElement: null
    },

    async init(config) {
      Logger.debug('Initializing widget with config:', config);
      this.formId = config.formId;
      if (!this.formId) {
        Logger.error('No form ID provided');
        return;
      }

      this.injectStyles();
      await this.createElements();
      this.setupEventListeners();
      Logger.debug('Widget initialized successfully');
    },

    injectStyles() {
      Logger.debug('Injecting styles');
      const style = document.createElement('style');
      style.textContent = `
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
        }
        .userbird-success-message {
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }
        .userbird-modal {
          display: none;
          position: fixed;
          z-index: 10000;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
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
          font-family: inherit;
          font-size: 14px;
        }
        .userbird-button {
          background: #1f2937;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
        }
        .userbird-button:hover { background: #374151; }
        .userbird-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .userbird-close {
          background: transparent;
          border: 1px solid #e5e7eb;
          color: #6b7280;
        }
        .userbird-close:hover { background: #f3f4f6; }
        .userbird-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        .userbird-error {
          color: #dc2626;
          font-size: 0.875rem;
          margin-top: 0.5rem;
          display: none;
        }
      `;
      document.head.appendChild(style);
    },

    async createElements() {
      Logger.debug('Creating elements');
      
      // Create form content
      const formContent = `
        <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Send Feedback</h3>
        <textarea class="userbird-textarea" placeholder="What's on your mind?"></textarea>
        <div class="userbird-error"></div>
        <div class="userbird-buttons">
          <button class="userbird-button userbird-close">Cancel</button>
          <button class="userbird-button userbird-submit">Send Feedback</button>
        </div>
      `;

      // Create success content
      const successContent = `
        <div class="userbird-success">
          <svg class="userbird-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 4L12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3 class="userbird-success-title">Thank you for your feedback!</h3>
          <p class="userbird-success-message">Your message has been received and will be reviewed by our team.</p>
          <button class="userbird-button userbird-close">Close</button>
        </div>
      `;

      // Create modal
      this.elements.modal = document.createElement('div');
      this.elements.modal.className = 'userbird-modal';
      this.elements.modal.innerHTML = formContent + successContent;

      // Create backdrop
      this.elements.backdrop = document.createElement('div');
      this.elements.backdrop.className = 'userbird-backdrop';

      // Append elements
      document.body.appendChild(this.elements.backdrop);
      document.body.appendChild(this.elements.modal);

      // Store element references
      this.elements.trigger = document.getElementById(`userbird-trigger-${this.formId}`);
      this.elements.submitButton = this.elements.modal.querySelector('.userbird-submit');
      this.elements.textarea = this.elements.modal.querySelector('.userbird-textarea');
      this.elements.errorElement = this.elements.modal.querySelector('.userbird-error');
      this.elements.successElement = this.elements.modal.querySelector('.userbird-success');
      this.elements.formElement = this.elements.modal.querySelector('form');

      if (!this.elements.trigger) {
        Logger.error('Trigger button not found');
        throw new Error('Trigger button not found');
      }

      Logger.debug('Elements created successfully');
    },

    setupEventListeners() {
      Logger.debug('Setting up event listeners');
      
      // Modal events
      const handleEscKey = (e) => {
        if (e.key === 'Escape' && this.elements.modal.classList.contains('open')) {
          Logger.debug('Modal closed: Pressed ESC key');
          this.closeModal();
        }
      };

      this.elements.trigger?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        Logger.debug('Trigger clicked');
        this.openModal();
      });
      
      this.elements.backdrop?.addEventListener('click', () => {
        Logger.debug('Modal closed: Clicked outside');
        this.closeModal();
      });
      
      // Add ESC key handler
      document.addEventListener('keydown', handleEscKey);
      
      this.elements.modal?.querySelector('.userbird-close')?.addEventListener('click', () => {
        Logger.debug('Close button clicked');
        this.closeModal();
      });

      // Store the handler for cleanup
      this._escKeyHandler = handleEscKey;
      
      // Form events
      this.elements.modal?.addEventListener('submit', (e) => e.preventDefault());
      this.elements.submitButton?.addEventListener('click', () => {
        Logger.debug('Submit button clicked');
        this.handleSubmit();
      });
      
      Logger.debug('Event listeners set up');
    },

    openModal() {
      Logger.debug('Opening modal');
      this.elements.backdrop.classList.add('open');
      this.elements.modal.classList.add('open');
      this.setState('normal');
      this.positionModal();
      this.elements.textarea.focus();
    },

    closeModal() {
      Logger.debug('Closing modal');
      this.elements.backdrop.classList.remove('open');
      this.elements.modal.classList.remove('open');
      this.elements.textarea.value = '';
      this.elements.submitButton.disabled = false;
      this.elements.submitButton.textContent = 'Send Feedback';
      this.hideError();
      setTimeout(() => this.setState('normal'), 150);
    },

    positionModal() {
      const trigger = this.elements.trigger;
      const modal = this.elements.modal;
      
      const triggerRect = trigger.getBoundingClientRect();
      const modalRect = modal.getBoundingClientRect();
      
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      
      if (spaceBelow >= modalRect.height + 8) {
        modal.style.top = `${triggerRect.bottom + 8}px`;
      } else if (spaceAbove >= modalRect.height + 8) {
        modal.style.top = `${triggerRect.top - modalRect.height - 8}px`;
      } else {
        modal.style.top = '50%';
        modal.style.transform = 'translateY(-50%)';
      }
      
      const left = Math.min(
        Math.max(8, triggerRect.left),
        window.innerWidth - modalRect.width - 8
      );
      modal.style.left = `${left}px`;
    },

    setState(state) {
      this.state = state;
      if (state === 'success') {
        this.elements.successElement.classList.add('open');
        this.elements.textarea.style.display = 'none';
        this.elements.submitButton.style.display = 'none';
      } else {
        this.elements.successElement.classList.remove('open');
        this.elements.textarea.style.display = 'block';
        this.elements.submitButton.style.display = 'inline-flex';
      }
    },

    async handleSubmit() {
      const message = this.elements.textarea?.value.trim();
      if (!message) {
        Logger.debug('Empty message, skipping submission');
        return;
      }

      Logger.debug('Submitting feedback:', { formId: this.formId, message });
      this.elements.submitButton.disabled = true;
      this.elements.submitButton.textContent = 'Sending...';
      this.hideError();

      try {
        await submitFeedback(this.formId, message);
        Logger.debug('Feedback submitted successfully');
        this.setState('success');
      } catch (error) {
        Logger.error('Failed to submit feedback:', error);
        this.showError(error instanceof Error ? error.message : 'Failed to submit feedback');
        this.elements.submitButton.textContent = 'Send Feedback';
        this.elements.submitButton.disabled = false;
      }
    },

    showError(message) {
      Logger.debug('Showing error:', message);
      this.elements.errorElement.textContent = message;
      this.elements.errorElement.style.display = 'block';
    },

    hideError() {
      Logger.debug('Hiding error');
      this.elements.errorElement.style.display = 'none';
    }
  };

  // Initialize the widget
  const formId = window.UserBird?.formId;
  Logger.debug('Starting widget initialization with formId:', formId);
  UserBirdWidget.init({ formId }).catch(error => {
    Logger.error('Failed to initialize widget:', error);
  });
})();