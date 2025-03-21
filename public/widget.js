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
    
    console.group('Userbird Modal Positioning');
    
    const modalElement = modal.modal;
    modalElement.style.transform = 'none';
    
    const rect = trigger ? trigger.getBoundingClientRect() : null;
    
    if (rect) {
      console.log('Trigger position:', {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right
      });
      
      // Get scroll position
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      console.log('Scroll position:', { scrollX, scrollY });
      
      // Calculate available space
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const modalWidth = modalElement.offsetWidth;
      
      console.log('Available space:', {
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
        console.log('Positioning below trigger:', {
          top: rect.bottom + scrollY + 8,
          left: leftPosition
        });
      } else if (spaceAbove >= 300) {
        modalElement.style.top = `${rect.top + scrollY - modalElement.offsetHeight - 8}px`;
        modalElement.style.left = `${leftPosition}px`;
        console.log('Positioning above trigger:', {
          top: rect.top + scrollY - modalElement.offsetHeight - 8,
          left: leftPosition
        });
      } else {
        modalElement.style.top = '50%';
        modalElement.style.left = '50%';
        modalElement.style.transform = 'translate(-50%, -50%)';
        console.log('Centering modal (not enough space above or below)');
      }
    } else {
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
      console.log('Centering modal (no trigger)');
    }
    
    console.groupEnd();
  }

  function openModal(trigger = null) {
    // Check for existing modals/dialogs
    const hasVisibleModal = Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [aria-modal="true"]')).some(modal => {
      // Skip our own modal
      if (modal.classList.contains('userbird-modal')) return false;
      
      // Check if the modal is visible
      const styles = window.getComputedStyle(modal);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });

    if (hasVisibleModal) {
      console.log('Widget prevented from opening: Another modal is visible');
      return;
    }

    if (!settingsLoaded) {
      // Create loading spinner
      const loading = document.createElement('div');
      loading.className = 'userbird-loading';
      loading.innerHTML = '<div class="userbird-loading-spinner"></div>';
      document.body.appendChild(loading);
      
      // Position loading spinner
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
      
      // Wait for settings to load
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
        console.log('Click detected outside widget:', {
          clickedElement: e.target,
          clickX: e.clientX,
          clickY: e.clientY
        });
        closeModal();
        document.removeEventListener('click', handleClickOutside);
      }
    }
    
    // Add click outside detection
    document.addEventListener('click', handleClickOutside);
    
    // Add ESC key handler
    function handleEscKey(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscKey);
      }
    }
    document.addEventListener('keydown', handleEscKey);
    
    modal.modal.classList.add('open');
    positionModal(trigger);
    
    // Log modal styles after opening
    const modalElement = modal.modal;
    console.log('Modal styles:', {
      background: window.getComputedStyle(modalElement).background,
      color: window.getComputedStyle(modalElement).color,
      borderColor: window.getComputedStyle(modalElement).borderColor
    });
    
    // Wait for modal transition to complete before focusing
    setTimeout(() => {
      modal.textarea.focus();
    }, 50);
  }

  function closeModal() {
    if (!modal) return;
    console.group('Widget State Reset');
    console.log('1. Starting modal close sequence');
    currentTrigger = null;
    
    modal.modal.classList.remove('open');
    console.log('2. Modal visibility removed');
    setTimeout(() => {
      console.log('3. Starting state reset after animation');
      modal.form.classList.remove('hidden');
      console.log('4. Form visibility restored');
      modal.successElement.classList.remove('open');
      console.log('5. Success state removed');
      modal.submitButton.disabled = false;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
      console.log('6. Button state reset');
      console.groupEnd();
    }, 150);
  }

  async function init() {
    console.log('Initializing widget');
    
    // Add window focus handler to reset shortcuts when browser regains focus
    window.addEventListener('focus', () => {
      if (pressedKeys.size > 0) {
        console.log('Browser regained focus, clearing shortcut state');
        pressedKeys.clear();
      }
    });
    
    // Check for website theme settings
    const isDarkMode = 
      document.documentElement.hasAttribute('data-theme') ||
      document.documentElement.hasAttribute('data-mode') ||
      document.documentElement.hasAttribute('data-color-scheme') ||
      document.documentElement.classList.contains('dark') ||
      document.documentElement.classList.contains('dark-theme') ||
      document.documentElement.getAttribute('class')?.includes('dark');

    // Log theme detection details
    console.log('Theme detection:', {
      isDarkMode,
      htmlTheme: document.documentElement.getAttribute('data-theme'),
      htmlMode: document.documentElement.getAttribute('data-mode'),
      htmlColorScheme: document.documentElement.getAttribute('data-color-scheme'),
      rootClasses: {
        dark: document.documentElement.classList.contains('dark'),
        light: document.documentElement.classList.contains('light'),
        darkTheme: document.documentElement.classList.contains('dark-theme'),
        allClasses: document.documentElement.getAttribute('class')
      }
    });

    formId = window.UserBird?.formId;
    const user = window.UserBird?.user;
    
    if (!formId) {
      console.error('No form ID provided');
      return;
    }

    console.log('Initializing with:', { formId, user });

    // Initialize success sound
    initSuccessSound();

    // Inject styles
    injectStyles();
    
    // Start loading settings
    settingsPromise = fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`, {
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(async (response) => {
        console.log('Settings response:', response.status);
        if (!response.ok) {
          throw new Error(`Failed to load settings: ${response.status}`);
        }
        const settings = await response.json();
        console.log('Loaded settings:', settings);
        const buttonColor = settings.button_color || '#1f2937';
        const supportText = settings.support_text;
        const keyboardShortcut = settings.keyboard_shortcut;
        const soundEnabled = settings.sound_enabled;
        
        // Update styles with actual button color
        injectStyles(buttonColor);
        
        // Create modal with settings
        modal = createModal();
        setupModal(buttonColor, supportText);
        
        // Store shortcut in UserBird object
        window.UserBird.shortcut = keyboardShortcut;
        window.UserBird.settings = {
          sound_enabled: soundEnabled
        };
        
        // Add keyboard event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        
        settingsLoaded = true;
        return settings;
      })
      .catch(error => {
        console.warn('Using default settings:', error);
        // Use defaults if settings fail to load
        injectStyles('#1f2937');
        modal = createModal();
        setupModal('#1f2937', null);
        settingsLoaded = true;
      });
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        // If modal is open and clicked the same trigger, close it
        if (modal.modal.classList.contains('open') && currentTrigger === defaultTrigger) {
          closeModal();
        } else {
          openModal(defaultTrigger);
        }
      });
    }
  }
  
  function setupModal(buttonColor, supportText) {
    // Setup image upload
    const fileInput = modal.modal.querySelector('.userbird-file-input');
    const imageButton = modal.modal.querySelector('.userbird-image-button');
    const imagePreview = modal.modal.querySelector('.userbird-image-preview');
    const removeImageButton = modal.modal.querySelector('.userbird-remove-image');
    
    imageButton.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Validate file type and size
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
    
    // Handle support text if present
    const supportTextElement = modal.supportTextElement;
    if (supportText) {
      // Simple markdown link parser: [text](url)
      const parsedText = supportText.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`
      );
      supportTextElement.innerHTML = parsedText;
    } else {
      supportTextElement.style.display = 'none';
    }

    // Event handlers
    modal.closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    // Add window resize handler
    window.addEventListener('resize', () => {
      if (modal.modal.classList.contains('open') && currentTrigger) {
        positionModal(currentTrigger);
      }
    });

    modal.submitButton.addEventListener('click', async () => {
      handleSubmit();
    });

    // Add keyboard shortcut for submission
    modal.textarea.addEventListener('keydown', (e) => {
      // Check for Cmd+Enter (Mac) or Ctrl+Enter (non-Mac)
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

    // Expose open method globally
    window.UserBird.open = (triggerElement) => {
      // If triggerElement is provided, use it, otherwise try to find the default trigger
      const trigger = triggerElement || document.getElementById(`userbird-trigger-${formId}`);
      // If modal is open and clicked the same trigger, close it
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

    console.group('Widget Submit Flow');
    console.log('1. Starting feedback submission');
    
    // Handle image upload first if present
    if (selectedImage) {
      try {
        console.log('2. Starting image upload');
        imageData = await uploadImage(selectedImage);
        console.log('3. Image upload completed:', imageData);
      } catch (error) {
        console.error('Image upload failed:', error);
        throw new Error('Failed to upload image');
      }
    }

    // Show success state immediately
    modal.form.classList.add('hidden');
    modal.successElement.classList.add('open');
    
    // Play success sound if enabled
    if (window.UserBird?.settings?.sound_enabled && successSound) {
      try {
        await successSound.play();
      } catch (error) {
        console.warn('Failed to play success sound:', error);
      }
    }
    
    console.log('4. Success state shown');

    // Reset form state immediately after showing success
    modal.textarea.value = '';
    selectedImage = null;
    const imagePreview = modal.modal.querySelector('.userbird-image-preview');
    const imageButton = modal.modal.querySelector('.userbird-image-button');
    imagePreview.classList.remove('show');
    imagePreview.innerHTML = '';
    imageButton.style.display = 'block';
    modal.modal.querySelector('.userbird-file-input').value = '';
    console.log('5. Form state reset completed');
    
    console.log('Submitting feedback in background:', {
      formId,
      message,
      userInfo,
      hasImage: !!imageData
    });
    console.log('6. Starting feedback submission');
    
    try {
      // Submit feedback
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

      console.log('Feedback submission response:', response.status);
      console.log('7. API request completed:', { status: response.status });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      console.log('8. Submission successful');
      return response.json();
    } catch (error) {
      console.error('Background submission failed:', error);
      console.log('8. Submission failed:', error);
      // Don't revert success state, just log the error
      return { success: false, error };
      console.log('9. Submit flow completed');
      console.groupEnd();
    }
  }

  function normalizeKey(key) {
    // Normalize special keys
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
        // Convert other keys to uppercase for case-insensitive comparison
        return key.toUpperCase();
    }
  }

  function handleKeyDown(e) {
    // Check if an input field or text area is focused
    const activeElement = document.activeElement;
    const isInputFocused = activeElement?.matches('input, textarea, [contenteditable]');
    
    // Common browser shortcuts to ignore
    const commonShortcuts = {
      'F': true,      // Find
      'P': true,      // Print
      'S': true,      // Save
      'C': true,      // Copy
      'V': true,      // Paste
      'X': true,      // Cut
      'A': true,      // Select All
      'Z': true,      // Undo
      'Y': true,      // Redo
      'R': true,      // Reload
      'N': true,      // New Window
      'T': true,      // New Tab
      'W': true,      // Close Tab
      'H': true,      // History
      'J': true,      // Downloads
      'D': true,      // Bookmark
      'B': true,      // Bookmarks
      'L': true       // Location/URL bar
    }
    
    // Get the key without modifiers
    const keyWithoutModifiers = e.key.toUpperCase();
    
    // Check if this is a browser shortcut
    const isBrowserShortcut = (e.metaKey || e.ctrlKey) && commonShortcuts[keyWithoutModifiers];
    
    // Ignore if input is focused or it's a browser shortcut
    if (isInputFocused || isBrowserShortcut) {
      return;
    }
    
    const normalizedKey = normalizeKey(e.key);
    
    // Don't add the key if a browser feature is active
    if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) {
      return;
    }
    
    pressedKeys.add(normalizedKey);
    
    // Get current shortcut from settings
    const shortcut = window.UserBird?.shortcut;
    if (!shortcut) {
      return;
    }
    
    // Convert current pressed keys to sorted array for comparison
    const currentKeys = Array.from(pressedKeys).sort().join('+');
    
    // Normalize and sort shortcut keys for comparison
    const shortcutKeys = shortcut.split('+')
      .map(k => normalizeKey(k))
      .sort()
      .join('+');
    
    if (currentKeys === shortcutKeys) {
      // Get default trigger or create a centered trigger
      const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
      openModal(defaultTrigger);
      // Clear pressed keys after triggering
      pressedKeys.clear();
    }
  }

  function handleKeyUp(e) {
    const normalizedKey = normalizeKey(e.key);

    // If a browser feature is active, clear all shortcuts
    if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) {
      pressedKeys.clear();
      return;
    }
    
    pressedKeys.delete(normalizedKey);
    
    // Clear all pressed keys if any modifier key is released
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

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();