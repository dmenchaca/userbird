// Userbird Widget
(function() {
  const API_BASE_URL = 'https://app.userbird.co';
  let settingsLoaded = false;
  let settingsPromise = null;
  let selectedImage = null;
  let currentTrigger = null;
  let modal = null;
  let pressedKeys = new Set();
  let formId = null;
  let successSound = null;
  
  const MESSAGES = {
    success: {
      title: 'Thank you',
      description: 'Your message has been received and will be reviewed by our team.',
      imageError: 'Only JPG and PNG images up to 5MB are allowed.'
    },
    labels: {
      submit: 'Send Feedback',
      submitting: 'Sending Feedback...',
      close: 'Close',
      cancel: 'Cancel'
    }
  };

  // Initialize success sound
  function initSuccessSound() {
    successSound = new Audio('https://ucarecdn.com/a46284ad-1b93-4eb8-8db0-4694994ee706/MagicShimmerChristmasDingChristmasStarTwinkle01SND417131.mp3');
    successSound.preload = 'auto';
  }

  function getSystemInfo() {
    const ua = navigator.userAgent;
    let os = 'Unknown';
    let urlPath = window.location.pathname + window.location.search;
    
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    
    const width = window.innerWidth;
    let category = 'Desktop';
    
    if (width < 768) category = 'Mobile';
    else if (width < 1024) category = 'Tablet';
    
    return { operating_system: os, screen_category: category, url_path: urlPath };
  }

  function injectStyles(buttonColor) {
    const style = document.createElement('style');
    style.textContent = `
      /* Light mode defaults */
      .userbird-modal {
        --ub-background: white;
        --ub-border-color: #e5e7eb;
        --ub-text: #111827;
        --ub-text-muted: #6b7280;
        --ub-hover-background: #f3f4f6;
        font-family: inherit;
      }

      /* Website dark mode settings */
      :root[data-theme="dark"] .userbird-modal,
      :root.dark .userbird-modal,
      :root[data-mode="dark"] .userbird-modal,
      :root[data-color-mode="dark"] .userbird-modal,
      :root[data-color-scheme="dark"] .userbird-modal,
      .dark-theme .userbird-modal,
      html[class*="dark"] .userbird-modal {
        --ub-background: #1f1f1f;
        --ub-border-color: #2e2e2e;
        --ub-text: #e5e5e5;
        --ub-text-muted: #a1a1a1;
        --ub-hover-background: #2e2e2e;
      }

      .userbird-modal {
        opacity: 0;
        visibility: hidden;
        position: fixed;
        z-index: 10000;
        background: var(--ub-background);
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2);
        width: 360px;
        max-width: calc(100vw - 2rem);
        border: 1px solid var(--ub-border-color);
        transition: opacity 0.05s ease-in-out, visibility 0.05s ease-in-out;
      }
      .userbird-modal.open {
        opacity: 1;
        visibility: visible;
      }
      .userbird-modal-content {
        position: relative;
        padding: 1rem;
      }
      .userbird-form {
        display: block;
      }
      .userbird-form.hidden {
        display: none;
      }
      .userbird-title {
        font-size: 1rem !important;
        font-weight: 600 !important;
        color: var(--ub-text) !important;
        margin-top: 0;
        margin-bottom: 1rem;
        padding: 0;
        line-height: normal;
        font-family: inherit;
      }
      .userbird-textarea {
        width: 100%;
        min-height: 100px;
        padding: 0.75rem; 
        border: 1px solid var(--ub-border-color);
        border-radius: 6px;
        resize: vertical;
        font-family: inherit;
        font-size: 14px;
        background: var(--ub-background);
        color: var(--ub-text);
      }
      .userbird-textarea:focus {
        outline: none;
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
        border: 1px solid var(--ub-border-color);
        border-radius: 6px;
        color: var(--ub-text-muted);
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        background: var(--ub-background);
      }
      .userbird-image-button:hover {
        background: var(--ub-hover-background);
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
        color: var(--ub-text-muted);
        border: 1px solid var(--ub-border-color);
      }
      .userbird-button-secondary:hover {
        background: var(--ub-hover-background);
      }
      .userbird-spinner {
        display: none;
        width: 16px !important;
        height: 16px !important;
        animation: userbird-spin 1s linear infinite;
      }
      @keyframes userbird-spin {
        to { transform: rotate(360deg); }
      }
      .userbird-button-secondary:hover {
        background: var(--ub-hover-background);
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
        opacity: 0;
        transform: scale(0.8);
        animation: userbird-success-icon 0.4s ease-out forwards;
      }
      .userbird-success-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: var(--ub-text);
        opacity: 0;
        transform: translateY(10px);
        animation: userbird-success-title 0.4s ease-out 0.2s forwards;
      }
      .userbird-success-message {
        color: var(--ub-text-muted);
        font-size: 0.875rem;
        opacity: 0;
        transform: translateY(10px);
        animation: userbird-success-message 0.4s ease-out 0.4s forwards;
      }
      .userbird-success-gif {
        max-width: 100%;
        margin-top: 1rem;
        border-radius: 6px;
        opacity: 0;
        transform: translateY(10px);
        animation: userbird-success-gif 0.4s ease-out 0.6s forwards;
      }
      @keyframes userbird-success-icon {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes userbird-success-title {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes userbird-success-message {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes userbird-success-gif {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .userbird-support-text {
        font-size: 0.75rem;
        color: var(--ub-text-muted);
        text-align: left;
        margin-top: 1rem;
      }
      .userbird-support-text a {
        color: ${buttonColor};
        text-decoration: none;
        font-weight: 500;
      }
      .userbird-support-text a:hover {
        text-decoration: underline;
      }
      .userbird-submit[disabled] .userbird-spinner {
        display: block;
        color: currentColor;
      }
      .userbird-submit[disabled] .userbird-submit-text {
        opacity: 0.8;
      }
      
      /* Branding styles */
      .userbird-branding {
        text-align: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #f3f4f6;
      }
      .userbird-branding-link {
        color: #9ca3af;
        font-size: 0.75rem;
        text-decoration: none;
      }
      .userbird-branding-link:hover {
        text-decoration: underline;
      }
      .userbird-branding-hidden {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function createModal() {
    const modal = document.createElement('div');
    
    modal.className = 'userbird-modal';
    
    modal.innerHTML = `
      <div class="userbird-modal-content">
        <div class="userbird-form">
          <h3 class="userbird-title">Feedback</h3>
          <textarea class="userbird-textarea" placeholder="Help us improve this page."></textarea>
          <div class="userbird-error"></div>
          <div class="userbird-buttons">
            <button class="userbird-button userbird-button-secondary userbird-close">${MESSAGES.labels.cancel}</button>
            <div class="userbird-actions">
              <div class="userbird-image-upload">
                <input type="file" accept="image/jpeg,image/png" class="userbird-file-input" />
                <button class="userbird-image-button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                </button>
                <div class="userbird-image-preview">
                  <button class="userbird-remove-image">&times;</button>
                </div>
              </div>
              <button class="userbird-button userbird-submit">
                <span class="userbird-submit-text">${MESSAGES.labels.submit}</span>
                <svg class="userbird-spinner" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="userbird-support-text"></div>
        </div>
        <div class="userbird-success">
          <svg class="userbird-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 4L12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3 class="userbird-success-title">${MESSAGES.success.title}</h3>
          <p class="userbird-success-message">${MESSAGES.success.description}</p>
          <!-- GIF will be dynamically added here if enabled -->
        </div>
        <div class="userbird-branding${window.UserBird?.removeBranding ? ' userbird-branding-hidden' : ''}">
          <a href="https://app.userbird.co/?ref=widget&domain=${encodeURIComponent(window.location.hostname)}" class="userbird-branding-link" target="_blank" rel="noopener noreferrer">We run on Userbird</a>
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
      supportTextElement: modal.querySelector('.userbird-support-text')
    };
  }

  function positionModal(trigger) {
    if (!modal?.modal) return;
    
    const modalElement = modal.modal;
    modalElement.style.transform = 'none';
    
    const rect = trigger ? trigger.getBoundingClientRect() : null;
    
    if (rect) {
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const modalWidth = modalElement.offsetWidth;
      
      const leftPosition = Math.max(8, Math.min(rect.left + scrollX, window.innerWidth + scrollX - modalWidth - 8));
      
      // Check if we're in success state with GIF
      const isSuccessWithGif = modal.successElement.classList.contains('open') && window.UserBird?.showGifOnSuccess === true;
      
      // Determine if trigger is in the upper or lower half of the screen
      const isInLowerHalf = rect.top > window.innerHeight / 2;
      
      if (isSuccessWithGif) {
        // Special positioning for success state with GIF
        if (isInLowerHalf) {
          // For triggers in the lower half, grow upward by anchoring to bottom
          modalElement.style.top = 'auto'; // Clear the top positioning
          modalElement.style.bottom = `${window.innerHeight - rect.bottom - scrollY - 8}px`;
          modalElement.style.left = `${leftPosition}px`;
        } else {
          // For triggers in the upper half, grow downward by anchoring to top
          modalElement.style.top = `${rect.bottom + scrollY + 8}px`;
          modalElement.style.bottom = 'auto'; // Clear the bottom positioning
          modalElement.style.left = `${leftPosition}px`;
        }
      } else {
        // Original positioning logic for normal state
        modalElement.style.bottom = 'auto'; // Clear any bottom positioning
        
        if (spaceBelow >= 300) {
          modalElement.style.top = `${rect.bottom + scrollY + 8}px`;
          modalElement.style.left = `${leftPosition}px`;
        } else if (spaceAbove >= 300) {
          modalElement.style.top = `${rect.top + scrollY - modalElement.offsetHeight - 8}px`;
          modalElement.style.left = `${leftPosition}px`;
        } else {
          modalElement.style.top = '50%';
          modalElement.style.left = '50%';
          modalElement.style.transform = 'translate(-50%, -50%)';
        }
      }
    } else {
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
      modalElement.style.bottom = 'auto'; // Clear any bottom positioning
    }
  }

  function positionModalForSuccess(trigger) {
    if (!modal?.modal || !window.UserBird?.showGifOnSuccess) return;
    
    const modalElement = modal.modal;
    const rect = trigger ? trigger.getBoundingClientRect() : null;
    
    if (rect) {
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      const modalWidth = modalElement.offsetWidth;
      // Estimate the height of the success modal with GIF
      const estimatedSuccessHeight = 350; // Approximate height based on GIF and content
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const leftPosition = Math.max(8, Math.min(rect.left + scrollX, window.innerWidth + scrollX - modalWidth - 8));
      
      modalElement.style.transform = 'none';
      
      if (spaceBelow >= estimatedSuccessHeight) {
        // Enough space below, position normally
        modalElement.style.top = `${rect.bottom + scrollY + 8}px`;
        modalElement.style.left = `${leftPosition}px`;
        modalElement.style.bottom = 'auto';
      } else if (spaceAbove >= estimatedSuccessHeight) {
        // Not enough space below, but enough above, position above
        modalElement.style.top = `${rect.top + scrollY - estimatedSuccessHeight - 8}px`;
        modalElement.style.left = `${leftPosition}px`;
        modalElement.style.bottom = 'auto';
      } else {
        // Not enough space in either direction, center it
        modalElement.style.top = '50%';
        modalElement.style.left = '50%';
        modalElement.style.transform = 'translate(-50%, -50%)';
        modalElement.style.bottom = 'auto';
      }
    } else {
      // No trigger, center it
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
      modalElement.style.bottom = 'auto';
    }
  }

  function openModal(trigger = null) {
    const hasVisibleModal = Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]')).some(modal => {
      if (modal.classList.contains('userbird-modal')) return false;
      const styles = window.getComputedStyle(modal);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });

    if (hasVisibleModal) return;
    
    if (trigger) {
      const icon = trigger.querySelector('svg');
      if (icon && !icon.classList.contains('pointer-events-none')) {
        console.warn(
          'Userbird: Icon button detected without pointer-events-none class.\n' +
          'Add pointer-events-none to your icon to prevent click event issues:\n' +
          '<button onclick="UserBird.open(this)">\n' +
          '  <svg class="pointer-events-none">...</svg>\n' +
          '</button>'
        );
      }
    }

    if (!settingsLoaded) {
      const loading = document.createElement('div');
      loading.className = 'userbird-loading';
      loading.innerHTML = '<div class="userbird-loading-spinner"></div>';
      document.body.appendChild(loading);
      
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        loading.style.top = `${rect.bottom + scrollY + 8}px`;
        loading.style.left = `${rect.left}px`;
      } else {
        loading.style.top = '50%';
        loading.style.left = '50%';
        loading.style.transform = 'translate(-50%, -50%)';
      }
      
      settingsPromise.then(() => {
        document.body.removeChild(loading);
        openModal(trigger);
      });
      return;
    }

    if (!modal) return;
    currentTrigger = trigger;

    function handleClickOutside(e) {
      const modalElement = modal.modal;
      if (modalElement && !modalElement.contains(e.target) && e.target !== trigger) {
        closeModal();
        document.removeEventListener('click', handleClickOutside);
      }
    }
    
    document.addEventListener('click', handleClickOutside);
    
    function handleEscKey(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscKey);
      }
    }
    document.addEventListener('keydown', handleEscKey);
    
    modal.modal.classList.add('open');
    positionModal(trigger);
    
    setTimeout(() => {
      modal.textarea.focus();
    }, 50);
  }

  function closeModal() {
    if (!modal) return;
    currentTrigger = null;
    
    modal.modal.classList.remove('open');
    // Reset both top and bottom positioning to avoid issues on next open
    modal.modal.style.bottom = 'auto';
    
    setTimeout(() => {
      modal.form.classList.remove('hidden');
      modal.successElement.classList.remove('open');
      modal.submitButton.disabled = false;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
    }, 150);
  }

  async function init() {
    window.addEventListener('focus', () => {
      if (pressedKeys.size > 0) {
        pressedKeys.clear();
      }
    });
    
    const isDarkMode = 
      document.documentElement.hasAttribute('data-theme') ||
      document.documentElement.hasAttribute('data-mode') ||
      document.documentElement.hasAttribute('data-color-scheme') ||
      document.documentElement.classList.contains('dark') ||
      document.documentElement.classList.contains('dark-theme') ||
      document.documentElement.getAttribute('class')?.includes('dark');

    formId = window.UserBird?.formId;
    const user = window.UserBird?.user;
    
    if (!formId) return;

    initSuccessSound();
    injectStyles();
    
    settingsPromise = fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`, {
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load settings: ${response.status}`);
        }
        const settings = await response.json();
        const buttonColor = settings.button_color || '#1f2937';
        const supportText = settings.support_text;
        const keyboardShortcut = settings.keyboard_shortcut;
        const soundEnabled = settings.sound_enabled;
        const showGifOnSuccess = settings.show_gif_on_success;
        const gifUrls = settings.gif_urls || [];
        const removeBranding = settings.remove_branding || false;
        
        console.log('Form settings loaded:', settings);
        console.log('Show GIF on success:', showGifOnSuccess);
        console.log('Custom GIF URLs:', gifUrls);
        console.log('Remove branding:', removeBranding);

        injectStyles(buttonColor);
        modal = createModal();
        setupModal(buttonColor, supportText);
        
        window.UserBird.shortcut = keyboardShortcut;
        window.UserBird.settings = {
          sound_enabled: soundEnabled
        };
        window.UserBird.showGifOnSuccess = showGifOnSuccess;
        window.UserBird.gifUrls = gifUrls;
        window.UserBird.removeBranding = removeBranding;
        
        // Update branding visibility based on setting
        const brandingElement = modal.modal.querySelector('.userbird-branding');
        if (brandingElement) {
          if (removeBranding) {
            brandingElement.classList.add('userbird-branding-hidden');
          } else {
            brandingElement.classList.remove('userbird-branding-hidden');
          }
        }
        
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        
        settingsLoaded = true;
        return settings;
      })
      .catch(error => {
        console.error('Error loading form settings:', error);
        injectStyles('#1f2937');
        modal = createModal();
        setupModal('#1f2937', null);
        settingsLoaded = true;
      });
    
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        if (modal.modal.classList.contains('open') && currentTrigger === defaultTrigger) {
          closeModal();
        } else {
          openModal(defaultTrigger);
        }
      });
    }
  }
  
  function setupModal(buttonColor, supportText) {
    const fileInput = modal.modal.querySelector('.userbird-file-input');
    const imageButton = modal.modal.querySelector('.userbird-image-button');
    const imagePreview = modal.modal.querySelector('.userbird-image-preview');
    const removeImageButton = modal.modal.querySelector('.userbird-remove-image');
    
    imageButton.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (!file.type.match(/^image\/(jpeg|png)$/)) {
        modal.errorElement.textContent = MESSAGES.success.imageError;
        modal.errorElement.style.display = 'block';
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        modal.errorElement.textContent = MESSAGES.success.imageError;
        modal.errorElement.style.display = 'block';
        return;
      }
      
      selectedImage = file;
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        imagePreview.innerHTML = '';
        imagePreview.appendChild(img);
        imagePreview.appendChild(removeImageButton);
        imagePreview.classList.add('show');
        imageButton.style.display = 'none';
      };
      
      reader.readAsDataURL(file);
    });
    
    removeImageButton.addEventListener('click', () => {
      selectedImage = null;
      imagePreview.classList.remove('show');
      imageButton.style.display = 'block';
      fileInput.value = '';
    });
    
    const supportTextElement = modal.supportTextElement;
    if (supportText) {
      const parsedText = supportText.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`
      );
      supportTextElement.innerHTML = parsedText;
    } else {
      supportTextElement.style.display = 'none';
    }

    modal.closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    window.addEventListener('resize', () => {
      if (modal.modal.classList.contains('open') && currentTrigger) {
        positionModal(currentTrigger);
      }
    });

    modal.submitButton.addEventListener('click', async () => {
      handleSubmit();
    });

    modal.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    });

    async function handleSubmit() {
      const message = modal.textarea.value.trim();
      if (!message) return;
      
      modal.submitButton.disabled = true;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submitting;

      try {
        await submitFeedback(message);
      } catch (error) {
        modal.errorElement.textContent = 'Failed to submit feedback';
        modal.errorElement.style.display = 'block';
        modal.submitButton.disabled = false;
        modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
      }
    }

    window.UserBird.open = (triggerElement) => {
      const trigger = triggerElement || document.getElementById(`userbird-trigger-${formId}`);
      if (modal.modal.classList.contains('open') && currentTrigger === trigger) {
        closeModal();
      } else {
        openModal(trigger);
      }
    };
  }

  async function submitFeedback(message) {
    const systemInfo = getSystemInfo();
    const userInfo = window.UserBird?.user || {};
    let imageData = null;

    if (selectedImage) {
      try {
        imageData = await uploadImage(selectedImage);
      } catch (error) {
        throw new Error('Failed to upload image');
      }
    }

    // Position the modal appropriately for success state before showing it
    positionModalForSuccess(currentTrigger);
    
    modal.form.classList.add('hidden');
    modal.successElement.classList.add('open');
    
    // Remove any existing GIF element
    const existingGif = modal.successElement.querySelector('.userbird-success-gif');
    if (existingGif) {
      existingGif.remove();
    }
    
    // Add the GIF to the success message if enabled
    if (window.UserBird?.showGifOnSuccess) {
      // Function to get a random GIF URL
      function getRandomGifUrl() {
        console.log('Getting random GIF, available GIFs:', window.UserBird?.gifUrls);
        if (window.UserBird?.gifUrls && window.UserBird.gifUrls.length > 0) {
          const randomIndex = Math.floor(Math.random() * window.UserBird.gifUrls.length);
          console.log('Selected random index:', randomIndex);
          const selectedUrl = window.UserBird.gifUrls[randomIndex];
          console.log('Selected GIF URL:', selectedUrl);
          return selectedUrl;
        }
        console.log('No custom GIFs found, not showing a GIF');
        return null;
      }
      
      const gifUrl = getRandomGifUrl();
      
      // Only show GIF if we have a valid URL
      if (gifUrl) {
        // Hide the SVG icon when GIF is shown
        const successIcon = modal.successElement.querySelector('.userbird-success-icon');
        if (successIcon) {
          successIcon.style.display = 'none';
        }
        
        // Set padding-top to 8px when GIF is shown
        modal.successElement.style.paddingTop = '8px';
        
        const successGif = document.createElement('img');
        successGif.src = gifUrl;
        successGif.alt = "Success GIF";
        successGif.className = "userbird-success-gif";
        successGif.style.maxWidth = "100%";
        successGif.style.marginTop = "1rem";
        successGif.style.borderRadius = "6px";
        modal.successElement.appendChild(successGif);
      }
    }
    
    if (window.UserBird?.settings?.sound_enabled && successSound) {
      try {
        await successSound.play();
      } catch (error) {
        // Ignore sound play errors
      }
    }

    modal.textarea.value = '';
    selectedImage = null;
    const imagePreview = modal.modal.querySelector('.userbird-image-preview');
    const imageButton = modal.modal.querySelector('.userbird-image-button');
    imagePreview.classList.remove('show');
    imagePreview.innerHTML = '';
    imageButton.style.display = 'block';
    modal.modal.querySelector('.userbird-file-input').value = '';
    
    try {
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/feedback`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        },
        body: JSON.stringify({ 
          formId, 
          message,
          ...systemInfo,
          user_id: userInfo.id,
          user_email: userInfo.email,
          user_name: userInfo.name,
          image_url: imageData?.url,
          image_name: imageData?.name,
          image_size: imageData?.size
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      return response.json();
    } catch (error) {
      return { success: false, error };
    }
  }

  function normalizeKey(key) {
    switch (key) {
      case 'Meta':
        return 'Command';
      case ' ':
        return 'Space';
      case 'Control':
      case 'Shift':
      case 'Alt':
        return key;
      default:
        return key.toUpperCase();
    }
  }

  function handleKeyDown(e) {
    const activeElement = document.activeElement;
    const isInputFocused = activeElement?.matches('input, textarea, [contenteditable]');
    
    const commonShortcuts = {
      'F': true,
      'P': true,
      'S': true,
      'C': true,
      'V': true,
      'X': true,
      'A': true,
      'Z': true,
      'Y': true,
      'R': true,
      'N': true,
      'T': true,
      'W': true,
      'H': true,
      'J': true,
      'D': true,
      'B': true,
      'L': true
    }
    
    const keyWithoutModifiers = e.key.toUpperCase();
    const isBrowserShortcut = (e.metaKey || e.ctrlKey) && commonShortcuts[keyWithoutModifiers];
    
    if (isInputFocused || isBrowserShortcut) {
      return;
    }
    
    const normalizedKey = normalizeKey(e.key);
    
    if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) {
      return;
    }
    
    pressedKeys.add(normalizedKey);
    
    const shortcut = window.UserBird?.shortcut;
    if (!shortcut) {
      return;
    }
    
    const currentKeys = Array.from(pressedKeys).sort().join('+');
    const shortcutKeys = shortcut.split('+')
      .map(k => normalizeKey(k))
      .sort()
      .join('+');
    
    if (currentKeys === shortcutKeys) {
      const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
      openModal(defaultTrigger);
      pressedKeys.clear();
    }
  }

  function handleKeyUp(e) {
    const normalizedKey = normalizeKey(e.key);

    if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) {
      pressedKeys.clear();
      return;
    }
    
    pressedKeys.delete(normalizedKey);
    
    if (['Command', 'Control', 'Alt', 'Shift'].includes(normalizedKey)) {
      pressedKeys.clear();
    }
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('formId', formId);

    const response = await fetch(`${API_BASE_URL}/.netlify/functions/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    return response.json();
  }

  function showSuccessMessage() {
    console.log('Showing success message. GIF flag:', window.UserBird?.showGifOnSuccess);
    console.log('Available GIF URLs for success message:', window.UserBird?.gifUrls);
    
    // Function to get a random GIF URL
    function getRandomGifUrl() {
      if (window.UserBird?.gifUrls && window.UserBird.gifUrls.length > 0) {
        // Randomly select a GIF from the array
        const randomIndex = Math.floor(Math.random() * window.UserBird.gifUrls.length);
        console.log('Success message - Selected random index:', randomIndex);
        const selectedUrl = window.UserBird.gifUrls[randomIndex];
        console.log('Success message - Selected GIF URL:', selectedUrl);
        return selectedUrl;
      }
      // Return null if no GIFs are available
      console.log('Success message - No custom GIFs found, not showing a GIF');
      return null;
    }
    
    let gifHtml = '';
    if (window.UserBird?.showGifOnSuccess) {
      const gifUrl = getRandomGifUrl();
      if (gifUrl) {
        gifHtml = `<img src="${gifUrl}" alt="Success GIF">`;
      }
    }
    
    console.log('Success message - Final GIF HTML to display:', gifHtml);
    
    const successMessage = document.createElement('div');
    successMessage.innerHTML = `
      <h2>${MESSAGES.success.title}</h2>
      <p>${MESSAGES.success.description}</p>
      ${gifHtml}
    `;
    document.body.appendChild(successMessage);
    console.log('Success message displayed.');
  }

  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();