// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  let settingsLoaded = false;
  let settingsPromise = null;
  let modal = null;
  let formId = null;
  
  // Add debug logging function
  const debug = {
    log: (...args) => console.log('[Userbird Debug]', ...args),
    group: (name) => console.group('[Userbird Debug] ' + name),
    groupEnd: () => console.groupEnd()
  };

  function injectStyles(buttonColor = '#1f2937') {
    debug.log('Injecting styles with button color:', buttonColor);
    
    const style = document.createElement('style');
    style.textContent = `
      .userbird-modal {
        opacity: 0;
        visibility: hidden;
        position: fixed;
        z-index: 10000;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        width: 400px;
        max-width: calc(100vw - 2rem);
        border: 1px solid #e5e7eb;
        transition: opacity 0.1s ease-in-out, visibility 0.1s ease-in-out;
      }
      .userbird-modal.open {
        opacity: 1;
        visibility: visible;
      }
      .userbird-modal-content {
        position: relative;
        padding: 0.75rem 1rem 1rem 1rem;
      }
      .userbird-loading {
        display: none;
        position: absolute;
        inset: 0;
        align-items: center;
        justify-content: center;
        background: white;
        border-radius: 8px;
      }
      .userbird-loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #e5e7eb;
        border-top-color: ${buttonColor};
        border-radius: 50%;
        animation: userbird-spin 0.6s linear infinite;
      }
      .userbird-form {
        display: block;
      }
      .userbird-form.hidden {
        display: none;
      }
      .userbird-title {
        all: initial;
        display: block;
        font-family: inherit;
        font-size: 1rem !important;
        font-weight: 600 !important;
        color: #111827 !important;
        margin-top: 0;
        margin-bottom: 0;
        padding: 0;
        line-height: normal;
        padding-bottom: 1rem;
      }
      .userbird-textarea {
        width: 100%;
        min-height: 100px;
        padding: 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        resize: vertical;
        font-family: inherit;
        font-size: 14px;
      }
      .userbird-textarea:focus {
        outline: none;
        border-color: ${buttonColor};
        box-shadow: 0 0 0 1px ${buttonColor}15
      }
      .userbird-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
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
        text-align: center;
        padding: 2rem 1rem;
        display: none;
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
      }
    `;
    document.head.appendChild(style);
    debug.log('Styles injected successfully');
  }

  function createModal() {
    debug.log('Creating modal');
    const modal = document.createElement('div');
    
    modal.className = 'userbird-modal';
    
    modal.innerHTML = `
      <div class="userbird-modal-content">
        <div class="userbird-loading">
          <div class="userbird-loading-spinner"></div>
        </div>
        <div class="userbird-form">
          <h3 class="userbird-title">Send feedback</h3>
          <textarea class="userbird-textarea" placeholder="Help us improve this page."></textarea>
          <div class="userbird-error"></div>
          <div class="userbird-buttons">
            <button class="userbird-button userbird-button-secondary userbird-close">Cancel</button>
            <button class="userbird-button userbird-submit">Send Feedback</button>
          </div>
        </div>
        <div class="userbird-success">
          <svg class="userbird-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 4L12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3 class="userbird-success-title">Thank you</h3>
          <p class="userbird-success-message">Your message has been received and will be reviewed by our team.</p>
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
      successElement: modal.querySelector('.userbird-success'),
      loadingElement: modal.querySelector('.userbird-loading')
    };
  }

  function positionModal(trigger) {
    if (!modal?.modal) return;
    
    debug.group('Positioning Modal');
    
    const modalElement = modal.modal;
    modalElement.style.transform = 'none';
    
    const rect = trigger ? trigger.getBoundingClientRect() : null;
    
    if (rect) {
      debug.log('Trigger position:', {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right
      });
      
      // Get scroll position
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      debug.log('Scroll position:', { scrollX, scrollY });
      
      // Calculate available space
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const modalWidth = modalElement.offsetWidth;
      
      debug.log('Available space:', {
        spaceBelow,
        spaceAbove,
        modalWidth,
        windowHeight: window.innerHeight,
        windowWidth: window.innerWidth
      });
      
      // Calculate position accounting for scroll
      const leftPosition = Math.max(8, Math.min(rect.left + scrollX, window.innerWidth + scrollX - modalWidth - 8));
      
      if (spaceBelow >= 300) {
        modalElement.style.top = `${rect.bottom + scrollY + 8}px`;
        modalElement.style.left = `${leftPosition}px`;
        debug.log('Positioning below trigger');
      } else if (spaceAbove >= 300) {
        modalElement.style.top = `${rect.top + scrollY - modalElement.offsetHeight - 8}px`;
        modalElement.style.left = `${leftPosition}px`;
        debug.log('Positioning above trigger');
      } else {
        modalElement.style.top = '50%';
        modalElement.style.left = '50%';
        modalElement.style.transform = 'translate(-50%, -50%)';
        debug.log('Centering modal (not enough space above or below)');
      }
    } else {
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
      debug.log('Centering modal (no trigger)');
    }
    
    debug.groupEnd();
  }

  function openModal(trigger = null) {
    debug.group('Opening Modal');
    debug.log('Settings loaded:', settingsLoaded);
    debug.log('Modal object:', modal);
    
    if (!settingsLoaded) {
      debug.log('Settings not loaded, showing loading state');
      
      // Show loading state
      if (modal) {
        debug.log('Modal elements:', {
          loadingElement: modal.loadingElement,
          form: modal.form,
          modalElement: modal.modal
        });
        
        modal.loadingElement.style.display = 'flex';
        modal.form.style.visibility = 'hidden';
        modal.modal.classList.add('open');
        
        debug.log('Applied styles:', {
          loadingDisplay: modal.loadingElement.style.display,
          formVisibility: modal.form.style.visibility,
          modalClasses: modal.modal.className
        });
        
        positionModal(trigger);
      } else {
        debug.log('Modal not initialized yet');
      }
      
      // Wait for settings to load
      debug.log('Waiting for settings to load...');
      settingsPromise.then(() => {
        debug.log('Settings loaded, updating modal state');
        if (modal) {
          modal.loadingElement.style.display = 'none';
          modal.form.style.visibility = 'visible';
          debug.log('Updated styles:', {
            loadingDisplay: modal.loadingElement.style.display,
            formVisibility: modal.form.style.visibility
          });
        }
      }).catch(error => {
        debug.log('Error loading settings:', error);
      });
      
      debug.groupEnd();
      return;
    }

    if (!modal) return;
    
    // Restore form state
    modal.form.style.visibility = 'visible';
    modal.loadingElement.style.display = 'none';
    modal.modal.classList.add('open');
    positionModal(trigger);
    
    // Wait for modal transition to complete before focusing
    setTimeout(() => {
      modal.textarea.focus();
    }, 50);
    
    debug.groupEnd();
  }

  function setupModal(buttonColor, supportText) {
    if (!modal) return;
    
    debug.group('Setting up modal');
    
    // Handle support text if present
    const supportTextElement = modal.modal.querySelector('.userbird-support-text');
    if (supportText && supportTextElement) {
      // Simple markdown link parser: [text](url)
      const parsedText = supportText.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        `<a href="$2" target="_blank" rel="noopener noreferrer" style="color: ${buttonColor}; font-weight: 500; text-decoration: none;">$1</a>`
      );
      supportTextElement.innerHTML = parsedText;
    } else if (supportTextElement) {
      supportTextElement.style.display = 'none';
    }

    // Event handlers
    modal.closeButtons.forEach(button => {
      button.addEventListener('click', () => {
        modal.modal.classList.remove('open');
        setTimeout(() => {
          modal.form.classList.remove('hidden');
          modal.successElement.classList.remove('open');
          modal.submitButton.disabled = false;
          modal.submitButton.textContent = 'Send Feedback';
        }, 150);
      });
    });

    // Add window resize handler
    window.addEventListener('resize', () => {
      if (modal.modal.classList.contains('open')) {
        positionModal(currentTrigger);
      }
    });

    modal.submitButton.addEventListener('click', async () => {
      const message = modal.textarea.value.trim();
      if (!message) return;

      modal.submitButton.disabled = true;
      modal.submitButton.textContent = 'Sending...';

      try {
        await submitFeedback(message);
        modal.textarea.value = '';
        modal.form.classList.add('hidden');
        modal.successElement.classList.add('open');
      } catch (error) {
        modal.errorElement.textContent = 'Failed to submit feedback';
        modal.errorElement.style.display = 'block';
        modal.submitButton.disabled = false;
        modal.submitButton.textContent = 'Send Feedback';
      }
    });
    
    debug.log('Modal setup complete');
    debug.groupEnd();
  }

  async function init() {
    debug.group('Initializing Widget');
    
    // Get form settings including button color
    formId = window.UserBird?.formId;
    debug.log('Form ID:', formId);
    
    if (!formId) {
      debug.log('No form ID found, aborting initialization');
      debug.groupEnd();
      return;
    }

    // Inject initial styles
    injectStyles();
    debug.log('Initial styles injected');
    
    // Create modal with loading state
    modal = createModal();
    debug.log('Initial modal created');
    
    // Start loading settings
    debug.log('Starting settings load');
    settingsPromise = fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`)
      .then(async (response) => {
        debug.log('Settings response received:', response.status);
        const settings = await response.json();
        debug.log('Settings loaded:', settings);
        
        const buttonColor = settings.button_color || '#1f2937';
        const supportText = settings.support_text;
        
        // Update styles with actual button color
        injectStyles(buttonColor);
        debug.log('Styles updated with button color:', buttonColor);
        
        setupModal(buttonColor, supportText);
        debug.log('Modal setup complete');
        
        settingsLoaded = true;
        debug.log('Settings loaded flag set to true');
        
        return settings;
      })
      .catch(error => {
        debug.log('Error loading settings:', error);
        // Use defaults if settings fail to load
        injectStyles('#1f2937');
        setupModal('#1f2937', null);
        settingsLoaded = true;
        debug.log('Fallback initialization complete');
      });
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    debug.log('Default trigger found:', !!defaultTrigger);
    
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(defaultTrigger);
      });
    }
    
    debug.groupEnd();
  }

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(error => {
      debug.log('Initialization error:', error);
    });
  }
})();