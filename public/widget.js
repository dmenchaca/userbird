// Userbird Widget
(function() {
  const API_BASE_URL = 'https://app.userbird.co';
  let settingsLoaded = false;
  let settingsPromise = null;
  let selectedImage = null;
  let currentTrigger = null;
  let modal = null;
  let formId = null;
  let dropdownVisible = false;
  
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
      cancel: 'Cancel',
      uploadScreenshot: 'Upload screenshot',
      captureScreenshot: 'Capture screenshot'
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
        width: 16px !important;
        height: 16px !important;
        animation: userbird-spin 1s linear infinite;
      }
      @keyframes userbird-spin {
        to { transform: rotate(360deg); }
      }
      .userbird-button-secondary:hover {
        background: #f3f4f6;
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
        color: #111827;
        opacity: 0;
        transform: translateY(10px);
        animation: userbird-success-title 0.4s ease-out 0.2s forwards;
      }
      .userbird-success-message {
        color: #6b7280;
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
        color: #666666;
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
      
      /* Dropdown styles */
      .userbird-dropdown {
        position: relative;
        display: inline-block;
      }
      .userbird-dropdown-content {
        display: none;
        position: absolute;
        bottom: 100%;
        left: 0;
        margin-bottom: 4px;
        background-color: white;
        min-width: 180px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        z-index: 10001;
      }
      .userbird-dropdown-content.show {
        display: block;
      }
      .userbird-dropdown-item {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #4b5563;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .userbird-dropdown-item:first-child {
        border-top-left-radius: 6px;
        border-top-right-radius: 6px;
      }
      .userbird-dropdown-item:last-child {
        border-bottom-left-radius: 6px;
        border-bottom-right-radius: 6px;
      }
      .userbird-dropdown-item:hover {
        background-color: #f3f4f6;
      }
      .userbird-dropdown-item svg {
        width: 16px;
        height: 16px;
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
                <div class="userbird-dropdown">
                  <button class="userbird-image-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                  </button>
                  <div class="userbird-dropdown-content">
                    <div class="userbird-dropdown-item userbird-upload-option">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      ${MESSAGES.labels.uploadScreenshot}
                    </div>
                    <div class="userbird-dropdown-item userbird-capture-option">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                      ${MESSAGES.labels.captureScreenshot}
                    </div>
                  </div>
                </div>
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
      supportTextElement: modal.querySelector('.userbird-support-text'),
      imageButton: modal.querySelector('.userbird-image-button'),
      dropdownContent: modal.querySelector('.userbird-dropdown-content'),
      uploadOption: modal.querySelector('.userbird-upload-option'),
      captureOption: modal.querySelector('.userbird-capture-option'),
      fileInput: modal.querySelector('.userbird-file-input')
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

  // Load html2canvas library dynamically
  function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
      if (window.html2canvas) {
        resolve(window.html2canvas);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.async = true;
      
      script.onload = () => {
        window.html2canvas = window.html2canvas || {};
        resolve(window.html2canvas);
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load html2canvas library'));
      };
      
      document.head.appendChild(script);
    });
  }
  
  // Compress image to target size
  async function compressImage(file, maxSizeMB = 3) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        
        img.onload = function() {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate initial dimensions while maintaining aspect ratio
          const maxDimension = 1920; // Start with a reasonable max dimension
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with high quality
          let quality = 0.9;
          const maxSize = maxSizeMB * 1024 * 1024;
          
          function compressWithQuality() {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
            
            console.log(`Compressed image: ${(bytes / (1024 * 1024)).toFixed(2)}MB with quality ${quality}`);
            
            if (bytes > maxSize && quality > 0.1) {
              // Reduce quality and try again
              quality -= 0.1;
              compressWithQuality();
            } else {
              // Convert data URL to Blob
              fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                  const compressedFile = new File([blob], file.name || 'screenshot.jpg', { 
                    type: 'image/jpeg',
                    lastModified: new Date().getTime()
                  });
                  resolve(compressedFile);
                })
                .catch(reject);
            }
          }
          
          compressWithQuality();
        };
        
        img.onerror = reject;
      };
      
      reader.onerror = reject;
    });
  }
  
  // Capture screenshot function
  async function captureScreenshot() {
    try {
      // We're not hiding the modal anymore as requested
      const modalElement = modal.modal;
      const wasOpen = modalElement.classList.contains('open');
      
      // Load html2canvas library if not already loaded
      const html2canvas = await loadHtml2Canvas();
      
      // Create a viewport-sized canvas to capture only what's visible
      const viewportCanvas = document.createElement('canvas');
      viewportCanvas.width = window.innerWidth;
      viewportCanvas.height = window.innerHeight;
      
      // Capture the current viewport
      const canvas = await html2canvas(document.documentElement, {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        scrollX: 0,
        scrollY: 0,
        scale: 1,
        allowTaint: true,
        useCORS: true,
        backgroundColor: 'white',
        logging: false
      });
      
      // Convert canvas to blob
      const dataUrl = canvas.toDataURL('image/png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'screenshot.png', { type: 'image/png' });
      
      return file;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      throw error;
    }
  }
  
  // Process captured screenshot
  function processScreenshot(file) {
    if (!file) return;
    
    selectedImage = file;
    const reader = new FileReader();
    const imagePreview = modal.modal.querySelector('.userbird-image-preview');
    const removeImageButton = modal.modal.querySelector('.userbird-remove-image');
    const imageButton = modal.imageButton;
    
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      
      // Create a new container for the preview
      imagePreview.innerHTML = '';
      imagePreview.appendChild(img);
      imagePreview.appendChild(removeImageButton);
      
      // Show the preview and hide the button
      imagePreview.classList.add('show');
      imageButton.style.display = 'none';
    };
    
    reader.readAsDataURL(file);
  }
  
  function setupModal(buttonColor, supportText) {
    // Setup dropdown toggle
    const imageButton = modal.imageButton;
    const dropdownContent = modal.dropdownContent;
    const uploadOption = modal.uploadOption;
    const captureOption = modal.captureOption;
    const fileInput = modal.fileInput;
    const imagePreview = modal.modal.querySelector('.userbird-image-preview');
    const removeImageButton = modal.modal.querySelector('.userbird-remove-image');
    
    // Toggle dropdown when clicking the image button
    imageButton.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownContent.classList.toggle('show');
      dropdownVisible = !dropdownVisible;
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      if (dropdownVisible) {
        dropdownContent.classList.remove('show');
        dropdownVisible = false;
      }
    });
    
    // Upload option
    uploadOption.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
      dropdownContent.classList.remove('show');
      dropdownVisible = false;
    });
    
    // Capture option
    captureOption.addEventListener('click', async (e) => {
      e.stopPropagation();
      dropdownContent.classList.remove('show');
      dropdownVisible = false;
      
      try {
        // Show a loading indicator in the image button
        imageButton.innerHTML = `
          <svg class="userbird-spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        `;
        
        const screenshot = await captureScreenshot();
        
        // Process the screenshot immediately
        processScreenshot(screenshot);
        
        // If the screenshot is large, compress it in the background for upload
        if (screenshot.size > 3 * 1024 * 1024) {
          compressImage(screenshot, 3).then(compressedFile => {
            selectedImage = compressedFile;
          }).catch(error => {
            console.error('Error compressing screenshot:', error);
          });
        }
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
        modal.errorElement.textContent = 'Failed to capture screenshot';
        modal.errorElement.style.display = 'block';
        
        // Reset the image button
        imageButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        `;
      }
    });
    
    // File input change
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Validate file type and size
      if (!file.type.match(/^image\/(jpeg|png)$/)) {
        modal.errorElement.textContent = MESSAGES.success.imageError;
        modal.errorElement.style.display = 'block';
        return;
      }
      
      // Process the image immediately to show the thumbnail
      processScreenshot(file);
      
      // If the file is too large, compress it in the background for upload
      if (file.size > 5 * 1024 * 1024) {
        try {
          const compressedFile = await compressImage(file, 3);
          selectedImage = compressedFile; // Update the selected image with the compressed version
        } catch (error) {
          console.error('Error compressing image:', error);
          modal.errorElement.textContent = MESSAGES.success.imageError;
          modal.errorElement.style.display = 'block';
        }
      }
    });
    
    removeImageButton.addEventListener('click', () => {
      selectedImage = null;
      imagePreview.classList.remove('show');
      imageButton.style.display = 'block';
      fileInput.value = '';
      
      // Reset the image button to its original state
      imageButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      `;
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
        
        // Reset the image button to its original state
        imageButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        `;
        
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
    
    // Show success state immediately
    modal.form.classList.add('hidden');
    modal.successElement.classList.add('open');
    
    console.log('Submitting feedback in background:', {
      formId,
      message,
      userInfo
    });
    
    try {
      // Upload image first if present
      const imageData = selectedImage ? await uploadImage(selectedImage) : null;
      console.log('Image upload result:', imageData);
    
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
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      return response.json();
    } catch (error) {
      console.error('Background submission failed:', error);
      // Don't revert success state, just log the error
      return { success: false, error };
    }
  }

  async function uploadImage(file) {
    if (!file) return null;
    
    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      throw new Error('Only JPG and PNG images are allowed');
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be under 5MB');
    }
    
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
    
    const data = await response.json();
    return {
      url: data.url,
      name: file.name,
      size: file.size
    };
  }

  async function init() {
    console.log('Initializing widget');
    formId = window.UserBird?.formId;
    const user = window.UserBird?.user;
    
    if (!formId) {
      console.error('No form ID provided');
      return;
    }

    console.log('Initializing with:', { formId, user });

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
        
        // Update styles with actual button color
        injectStyles(buttonColor);
        
        // Create modal with settings
        modal = createModal();
        setupModal(buttonColor, supportText);
        
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

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();