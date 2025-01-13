// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  let settingsLoaded = false;
  let settingsPromise = null;
  let selectedImage = null;
  let currentTrigger = null;
  let modal = null;
  let formId = null;
  
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

  function getSystemInfo() {
    const ua = navigator.userAgent;
    let os = 'Unknown';
    
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    
    const width = window.innerWidth;
    let category = 'Desktop';
    
    if (width < 768) category = 'Mobile';
    else if (width < 1024) category = 'Tablet';
    
    return { operating_system: os, screen_category: category };
  }

  function injectStyles(buttonColor) {
    const style = document.createElement('style');
    style.textContent = `
      .userbird-loading {
        position: fixed;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        border: 1px solid #e5e7eb;
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
        color: #111827 !important;
        margin-top: 0;
        margin-bottom: 1rem;
        padding: 0;
        line-height: normal;
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
        animation: userbird-spin 1.5s linear infinite;
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
    `;
    document.head.appendChild(style);
  }

  function createModal() {
    const modal = document.createElement('div');
    
    modal.className = 'userbird-modal';
    
    modal.innerHTML = `
      <div class="userbird-modal-content">
        <div class="userbird-form">
          <h3 class="userbird-title">Send feedback</h3>
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
                <svg class="userbird-spinner" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </button>
            </div>
          </div>
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
      successElement: modal.querySelector('.userbird-success')
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
    // Wait for modal transition to complete before focusing
    setTimeout(() => {
      modal.textarea.focus();
    }, 50);
  }

  function closeModal() {
    if (!modal) return;
    currentTrigger = null;
    
    modal.modal.classList.remove('open');
    setTimeout(() => {
      modal.form.classList.remove('hidden');
      modal.successElement.classList.remove('open');
      modal.submitButton.disabled = false;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
    }, 150);
  }

  async function init() {
    console.log('Initializing widget');
    formId = window.UserBird?.formId;
    if (!formId) {
      console.error('No form ID provided');
      return;
    }

    // Inject styles
    injectStyles();
    
    // Start loading settings
    settingsPromise = fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`)
      .then(async (response) => {
        const settings = await response.json();
        const buttonColor = settings.button_color || '#1f2937';
        
        // Update styles with actual button color
        injectStyles(buttonColor);
        
        // Create modal with settings
        modal = createModal();
        setupModal();
        
        settingsLoaded = true;
        return settings;
      })
      .catch(error => {
        console.error('Error loading settings:', error);
        // Use defaults if settings fail to load
        injectStyles('#1f2937');
        modal = createModal();
        setupModal();
        settingsLoaded = true;
      });
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(defaultTrigger);
      });
    }
  }
  
  function setupModal() {
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
      const message = modal.textarea.value.trim();
      if (!message) return;

      modal.submitButton.disabled = true;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submitting;

      try {
        await submitFeedback(message);
        // Clear form state
        modal.textarea.value = '';
        selectedImage = null;
        const imagePreview = modal.modal.querySelector('.userbird-image-preview');
        const imageButton = modal.modal.querySelector('.userbird-image-button');
        imagePreview.classList.remove('show');
        imagePreview.innerHTML = '';
        imageButton.style.display = 'block';
        modal.modal.querySelector('.userbird-file-input').value = '';
        
        // Show success state
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
    window.UserBird.open = (triggerElement) => {
      // If triggerElement is provided, use it, otherwise try to find the default trigger
      const trigger = triggerElement || document.getElementById(`userbird-trigger-${formId}`);
      openModal(trigger);
    };
  }

  async function submitFeedback(message) {
    const systemInfo = getSystemInfo();
    const userInfo = window.UserBird?.user || {};
    
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
        user_name: userInfo.name
      })
    });

    if (!response.ok) {
      throw new Error('Failed to submit feedback');
    }
    
    return response.json();
  }

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();