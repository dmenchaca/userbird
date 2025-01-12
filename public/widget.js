// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  let settingsLoaded = false;
  let settingsPromise = null;
  let modal = null;
  let formId = null;
  let selectedImage = null;
  let currentTrigger = null;

  function injectStyles(buttonColor) {
    const style = document.createElement('style');
    style.textContent = `
      .userbird-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
      }
      .userbird-loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #e5e7eb;
        border-top-color: ${buttonColor || '#1f2937'};
        border-radius: 50%;
        animation: userbird-spin 0.6s linear infinite;
      }
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
        padding-top: 0.75rem;
        padding-right: 1rem;
        padding-bottom: 1rem;
        padding-left: 1rem;
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
        border-color: ${buttonColor || '#1f2937'};
        box-shadow: 0 0 0 1px ${buttonColor || '#1f2937'}15
      }
      .userbird-image-upload {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .userbird-file-input {
        display: none;
      }
      .userbird-image-button {
        padding: 0.5rem 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        background: white;
      }
      .userbird-image-button:hover {
        background: #f3f4f6;
      }
      .userbird-image-preview {
        display: none;
        position: relative;
      }
      .userbird-image-preview.show {
        display: block;
      }
      .userbird-image-preview img {
        width: 36px;
        height: 36px;
        object-fit: cover;
        border-radius: 6px;
      }
      .userbird-remove-image {
        position: absolute;
        top: -0.5rem;
        right: -0.5rem;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        background: #ef4444;
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        line-height: 1;
      }
      .userbird-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1rem;
      }
      .userbird-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
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
        background: ${buttonColor || '#1f2937'};
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
        animation: userbird-spin 1.5s linear infinite;
        stroke-width: 2;
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
      .userbird-support-text {
        font-size: 0.75rem;
        color: #666666;
        text-align: left;
        margin-top: 1rem;
      }
    `;
    document.head.appendChild(style);
  }

  // ... (rest of the existing code)

  async function init() {
    // Get form settings including button color
    formId = window.UserBird?.formId;
    if (!formId) return;

    // Inject initial styles
    injectStyles();
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(defaultTrigger);
      });
    }
    
    // Start loading settings
    settingsPromise = fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load settings');
        }
        const settings = await response.json();
        const buttonColor = settings.button_color || '#1f2937';
        const supportText = settings.support_text;
        
        // Update styles with actual button color
        injectStyles(buttonColor);
        
        // Create modal with settings
        if (!modal) {
          modal = createModal();
          setupModal(buttonColor, supportText);
        }
        
        settingsLoaded = true;
        return settings;
      })
      .catch(error => {
        console.error('Error loading settings:', error);
        // Use defaults if settings fail to load
        injectStyles('#1f2937');
        if (!modal) {
          modal = createModal();
          setupModal('#1f2937', null);
        }
        settingsLoaded = true;
        return { button_color: '#1f2937', support_text: null };
      });
  }

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();