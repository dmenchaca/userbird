// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  let settingsLoaded = false;
  let settingsPromise = null;
  let selectedImage = null;
  let screenshotDialog = null;
  
  // Load screenshot dependencies (html2canvas and markerjs3) when needed
  function loadScreenshotDependencies() {
    return new Promise((resolve, reject) => {
      // Check if libraries are already loaded
      if (window.html2canvas && window.markerjs3) {
        return resolve();
      }
      
      // Load html2canvas if needed
      const html2canvasPromise = typeof html2canvas === 'undefined' ? 
        loadScript(`${API_BASE_URL}/libs/html2canvas/html2canvas.min.js`) : 
        Promise.resolve();
      
      // Load markerjs3 if needed
      const markerjs3Promise = typeof window.markerjs3 === 'undefined' ? 
        loadScript(`${API_BASE_URL}/libs/markerjs3/markerjs3.js`) : 
        Promise.resolve();
      
      // Wait for both to load
      Promise.all([html2canvasPromise, markerjs3Promise])
        .then(resolve)
        .catch(reject);
    });
  }

  // Helper function to load scripts
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  let currentTrigger = null;
  let modal = null;
  let pressedKeys = new Set();
  let formId = null;
  let successSound = null;
  let isAnimationRunning = false;
  
  // Log buffer for console capture
  const MAX_LOG_ENTRIES = 100;
  let logBuffer = [];
  let consoleOriginals = {};
  let errorThrottleCount = 0;
  let lastErrorTime = 0;
  
  // Store the original open method if one is defined
  const originalOpen = window.UserBird && typeof window.UserBird.open === 'function' ? 
                      window.UserBird.open : null;
  
  // Initialize console log capture
  function initConsoleCapture() {
    // Skip in development mode
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      return;
    }
    
    // Only wrap if console exists
    if (typeof console !== 'undefined') {
      // Store original methods
      consoleOriginals = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug,
        trace: console.trace
      };
      
      // Wrap each method
      console.log = wrapConsoleMethod('log', consoleOriginals.log);
      console.warn = wrapConsoleMethod('warn', consoleOriginals.warn);
      console.error = wrapConsoleMethod('error', consoleOriginals.error);
      console.info = wrapConsoleMethod('info', consoleOriginals.info);
      console.debug = wrapConsoleMethod('debug', consoleOriginals.debug);
      console.trace = wrapConsoleMethod('trace', consoleOriginals.trace);
      
      // Add global error listeners
      window.addEventListener('error', captureGlobalError);
      window.addEventListener('unhandledrejection', captureUnhandledRejection);
      
      // Show a notification in dev environments when using localhost
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        consoleOriginals.info('[Userbird] Console logs are being captured for feedback reports.');
      }
    }
  }
  
  // Format log message for storage
  function formatLogMessage(args) {
    try {
      return Array.from(args).map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) {
          return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        }
        try {
          // For DOM nodes, return a simplified representation
          if (arg instanceof Node) {
            if (arg.nodeType === Node.ELEMENT_NODE) {
              const el = arg;
              const attrs = Array.from(el.attributes || [])
                .map(attr => `${attr.name}="${attr.value}"`)
                .join(' ');
              return `<${el.tagName.toLowerCase()}${attrs ? ' ' + attrs : ''}${el.children.length ? '...' : ' /'}>`; 
            }
            return `[${arg.nodeName}]`;
          }
          
          // For complex objects, use a more concise stringification
          if (typeof arg === 'object') {
            // Check if it's a native object like Response, Request, etc.
            const objClass = Object.prototype.toString.call(arg);
            if (objClass !== '[object Object]' && objClass !== '[object Array]') {
              return objClass;
            }
            
            // For regular objects and arrays, stringify with limits
            return JSON.stringify(arg, (key, value) => {
              // Limit string values to 100 chars
              if (typeof value === 'string' && value.length > 100) {
                return value.substring(0, 100) + '...';
              }
              return value;
            }, 2);
          }
          
          return String(arg);
        } catch (e) {
          return String(arg);
        }
      }).join(' ');
    } catch (e) {
      return 'Error formatting log message';
    }
  }
  
  // Wrap console method with logger
  function wrapConsoleMethod(level, originalMethod) {
    return function() {
      // Call original method
      originalMethod.apply(console, arguments);
      
      // Capture log for buffer
      try {
        const message = formatLogMessage(arguments);
        
        // Truncate if too long
        const truncatedMessage = message.length > 500 ? message.substring(0, 500) + '...(truncated)' : message;
        
        addLogEntry({
          level: level,
          message: truncatedMessage,
          timestamp: Date.now()
        });
      } catch (e) {
        // If logging fails, don't break the console
      }
    };
  }
  
  // Capture global errors
  function captureGlobalError(event) {
    // Throttle error capture (first 10 errors at full rate, then 1 per second)
    const now = Date.now();
    if (errorThrottleCount >= 10 && (now - lastErrorTime < 1000)) {
      return;
    }
    
    lastErrorTime = now;
    errorThrottleCount++;
    
    addLogEntry({
      level: 'uncaught',
      message: `${event.message || 'Unknown error'} at ${event.filename || 'unknown'}:${event.lineno || '?'}:${event.colno || '?'}`,
      timestamp: now,
      stack: event.error?.stack
    });
  }
  
  // Capture unhandled promise rejections
  function captureUnhandledRejection(event) {
    // Apply same throttling as errors
    const now = Date.now();
    if (errorThrottleCount >= 10 && (now - lastErrorTime < 1000)) {
      return;
    }
    
    lastErrorTime = now;
    errorThrottleCount++;
    
    let message = 'Unhandled Promise Rejection';
    let stack = null;
    
    if (event.reason) {
      if (typeof event.reason === 'string') {
        message = event.reason;
      } else if (event.reason instanceof Error) {
        message = event.reason.message || 'Unhandled Promise Rejection';
        stack = event.reason.stack;
      } else {
        try {
          message = JSON.stringify(event.reason);
        } catch (e) {
          message = 'Unhandled Promise Rejection (unstringifiable object)';
        }
      }
    }
    
    addLogEntry({
      level: 'unhandledrejection',
      message: message,
      timestamp: now,
      stack
    });
  }
  
  // Add entry to circular buffer
  function addLogEntry(entry) {
    logBuffer.push(entry);
    
    // Keep buffer size limited
    if (logBuffer.length > MAX_LOG_ENTRIES) {
      logBuffer.shift();
    }
  }
  
  // Get recent logs for feedback submission
  function getRecentLogs() {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    // Filter logs to last 5 minutes
    const recentLogs = logBuffer.filter(entry => entry.timestamp >= fiveMinutesAgo);
    
    // Enforce payload size limit (50KB estimate)
    let totalSize = 0;
    const logs = [];
    
    for (let i = recentLogs.length - 1; i >= 0; i--) {
      const log = recentLogs[i];
      const entrySize = JSON.stringify(log).length;
      
      if (totalSize + entrySize > 50000) {
        break;
      }
      
      logs.unshift(log); // Maintain chronological order
      totalSize += entrySize;
    }
    
    return logs;
  }
  
  // Simplified direct approach to handle trigger button clicks
  function setupTriggerEvents() {
    // Find all existing trigger buttons and add click listeners
    document.querySelectorAll('[id^="userbird-trigger-"]').forEach(triggerButton => {
      triggerButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (modal && modal.modal.classList.contains('open') && currentTrigger === triggerButton) {
          closeModal();
        } else {
          openModal(triggerButton);
        }
      });
    });
    
    // Also set up a MutationObserver to handle dynamically added trigger buttons
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              // Check if the added node is a trigger button
              if (node.id && node.id.startsWith('userbird-trigger-')) {
                node.addEventListener('click', function(event) {
                  event.preventDefault();
                  event.stopPropagation();
                  
                  if (modal && modal.modal.classList.contains('open') && currentTrigger === node) {
                    closeModal();
                  } else {
                    openModal(node);
                  }
                });
              }
              
              // Also check for trigger buttons inside the added node
              const triggerButtons = node.querySelectorAll('[id^="userbird-trigger-"]');
              triggerButtons.forEach(btn => {
                btn.addEventListener('click', function(event) {
                  event.preventDefault();
                  event.stopPropagation();
                  
                  if (modal && modal.modal.classList.contains('open') && currentTrigger === btn) {
                    closeModal();
                  } else {
                    openModal(btn);
                  }
                });
              });
            }
          });
        }
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
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
    successSound = new Audio('https://ruqbgoazhyfxrsxbttfp.supabase.co/storage/v1/object/public/app//Magic,%20Shimmer,%20Christmas,%20Ding,%20Christmas%20Star,%20Twinkle%2001%20SND41713%201.mp3');
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
        --ub-background: #0D0D0D;
        --ub-border-color: #363636;
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

      /* Update dark mode specific background for textarea */
      :root[data-theme="dark"] .userbird-textarea,
      :root.dark .userbird-textarea,
      :root[data-mode="dark"] .userbird-textarea,
      :root[data-color-mode="dark"] .userbird-textarea,
      :root[data-color-scheme="dark"] .userbird-textarea,
      .dark-theme .userbird-textarea,
      html[class*="dark"] .userbird-textarea {
        background: #171717;
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
        padding: 1rem;
        display: none;
      }
      .userbird-success.with-gif {
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
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
      }
      .userbird-branding-link {
        color: #9ca3af;
        font-size: 0.75rem;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        transition: all 0.15s ease;
      }
      .userbird-branding-link:hover {
        background-color: rgba(156, 163, 175, 0.1);
      }
      .userbird-branding-icon {
        display: inline-block;
        vertical-align: middle;
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
                <button class="userbird-image-button" title="Take screenshot">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <path d="M21 15l-5-5L5 21"></path>
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
          <div class="userbird-branding${window.UserBird?.removeBranding ? ' userbird-branding-hidden' : ''}">
            <a href="https://app.userbird.co/?ref=widget&domain=${encodeURIComponent(window.location.hostname)}" class="userbird-branding-link" target="_blank" rel="noopener noreferrer">
              We run on 
              <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" class="userbird-branding-icon">
                <path d="M14.5459 6.36328H14.555" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M3.09109 16.3642H10.9093C12.8381 16.3642 14.688 15.598 16.0519 14.2341C17.4158 12.8702 18.182 11.0204 18.182 9.0915V6.36423C18.184 5.5896 17.9387 4.83456 17.4816 4.20913C17.0246 3.5837 16.3798 3.12056 15.6411 2.8872C14.9025 2.65383 14.1086 2.66244 13.3752 2.91177C12.6418 3.1611 12.0072 3.63812 11.5638 4.27332L1.81836 18.1824" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.1816 6.36328L19.9998 6.81783L18.1816 7.27237" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M9.0918 16.3638V19.091" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12.7275 16.1367V19.0913" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.36426 16.3637C7.48527 16.3637 8.57905 16.0182 9.49674 15.3744C10.4144 14.7305 11.1114 13.8196 11.4929 12.7655C11.8745 11.7114 11.9219 10.5653 11.6289 9.48327C11.3358 8.40123 10.7165 7.43577 9.85517 6.71826" stroke="currentColor" stroke-width="1.81818" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Userbird
            </a>
          </div>
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
      // Don't close if animation is running
      if (isAnimationRunning && !modal.successElement.classList.contains('open')) {
        return;
      }
      
      const modalElement = modal.modal;
      if (modalElement && !modalElement.contains(e.target) && e.target !== trigger) {
        closeModal();
        document.removeEventListener('click', handleClickOutside);
      }
    }
    
    document.addEventListener('click', handleClickOutside);
    
    function handleEscKey(e) {
      // Don't close if animation is running
      if (isAnimationRunning && !modal.successElement.classList.contains('open')) {
        return;
      }
      
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
    
    // Don't close if animation is running (until the submit button is clicked)
    if (isAnimationRunning && !modal.successElement.classList.contains('open')) {
      return;
    }
    
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
    // Initialize console log capture
    initConsoleCapture();
    
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
        
        // Setup trigger button click events after settings are loaded
        setupTriggerEvents();
        
        return settings;
      })
      .catch(error => {
        injectStyles('#1f2937');
        modal = createModal();
        setupModal('#1f2937', null);
        settingsLoaded = true;
        
        // Setup trigger button click events even if settings failed
        setupTriggerEvents();
      });
  }
  
  function setupModal(buttonColor, supportText) {
    const fileInput = modal.modal.querySelector('.userbird-file-input');
    const imageButton = modal.modal.querySelector('.userbird-image-button');
    const imagePreview = modal.modal.querySelector('.userbird-image-preview');
    const removeImageButton = modal.modal.querySelector('.userbird-remove-image');
    
    // Initialize screenshot functionality when the widget loads
    loadScreenshotDependencies().then(result => {
      console.log('Screenshot dependencies pre-loaded');
    }).catch(err => {
      console.error('Failed to pre-load screenshot dependencies:', err);
    });
    
    // Change image button to trigger screenshot instead of file upload
    imageButton.addEventListener('click', () => {
      // Load screenshot dependencies and initialize dialog if needed
      UserBird.enableScreenshots().then(dialog => {
        if (dialog) {
          // Store the current trigger to reopen modal later
          const triggerToReopen = currentTrigger;
          
          // Close the widget modal before opening screenshot dialog
          closeModal();
          
          // Open screenshot dialog and capture the screen with dynamic color
          dialog.openWithScreenshot((annotatedImageDataUrl) => {
            if (!annotatedImageDataUrl) {
              // If no screenshot was taken, reopen the widget modal
              openModal(triggerToReopen);
              return;
            }
            
            // Convert data URL to Blob for consistency with the existing image handling
            fetch(annotatedImageDataUrl)
              .then(res => res.blob())
              .then(blob => {
                // Create a File object from the Blob (needed for consistency with file upload)
                const screenshotFile = new File([blob], 'screenshot.png', { type: 'image/png' });
                
                // Set as the selected image for submission
                selectedImage = screenshotFile;
                
                // Reopen the widget modal
                openModal(triggerToReopen);
                
                // After modal is reopened, update the UI to show the screenshot
                setTimeout(() => {
                  const imagePreview = modal.modal.querySelector('.userbird-image-preview');
                  const imageButton = modal.modal.querySelector('.userbird-image-button');
                  const removeImageButton = modal.modal.querySelector('.userbird-remove-image');
                  
                  // Create and display the screenshot image
                  const img = document.createElement('img');
                  img.src = URL.createObjectURL(screenshotFile);
                  img.alt = 'Screenshot';
                  img.style.cursor = 'pointer';
                  
                  // Add click handler to thumbnail for re-editing
                  img.addEventListener('click', () => {
                    // Store current trigger and close modal
                    const currentTriggerForReEdit = currentTrigger;
                    closeModal();
                    
                    // Open screenshot dialog with existing image for re-editing
                    dialog.open(annotatedImageDataUrl, (newAnnotatedImageDataUrl) => {
                      if (newAnnotatedImageDataUrl) {
                        // Update with new screenshot
                        fetch(newAnnotatedImageDataUrl)
                          .then(res => res.blob())
                          .then(blob => {
                            const newScreenshotFile = new File([blob], 'screenshot.png', { type: 'image/png' });
                            selectedImage = newScreenshotFile;
                            
                            // Reopen modal and update thumbnail
                            openModal(currentTriggerForReEdit);
                            setTimeout(() => {
                              const newImg = modal.modal.querySelector('.userbird-image-preview img');
                              if (newImg) {
                                newImg.src = URL.createObjectURL(newScreenshotFile);
                              }
                            }, 100);
                          });
                      } else {
                        // User cancelled, just reopen modal
                        openModal(currentTriggerForReEdit);
                      }
                    });
                  });
                  
                  // Clear previous content and add image and remove button
                  imagePreview.innerHTML = '';
                  imagePreview.appendChild(img);
                  imagePreview.appendChild(removeImageButton);
                  imagePreview.classList.add('show');
                  imageButton.style.display = 'none';
                }, 100);
              })
              .catch(err => {
                console.error('Error processing screenshot:', err);
                // Reopen the widget modal even if there was an error
                openModal(triggerToReopen);
              });
          }, buttonColor); // Pass the dynamic button color to the screenshot dialog
        } else {
          console.error('Screenshot dialog could not be initialized');
        }
      });
    });
    
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
    
    // Collect console logs for metadata
    const consoleLogs = getRecentLogs();

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
    
    // Get the branding element so we can reposition it
    const brandingElement = modal.successElement.querySelector('.userbird-branding');
    
    // Add the GIF to the success message if enabled
    if (window.UserBird?.showGifOnSuccess) {
      // Add class for GIF-specific styling
      modal.successElement.classList.add('with-gif');
      
      // Function to get a random GIF URL
      function getRandomGifUrl() {
        if (window.UserBird?.gifUrls && window.UserBird.gifUrls.length > 0) {
          const randomIndex = Math.floor(Math.random() * window.UserBird.gifUrls.length);
          const selectedUrl = window.UserBird.gifUrls[randomIndex];
          return selectedUrl;
        }
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
        
        const successGif = document.createElement('img');
        successGif.src = gifUrl;
        successGif.alt = "Success GIF";
        successGif.className = "userbird-success-gif";
        successGif.style.maxWidth = "100%";
        successGif.style.marginTop = "1rem";
        successGif.style.borderRadius = "6px";
        modal.successElement.appendChild(successGif);
        
        // Move branding after the GIF if branding is enabled
        if (brandingElement && !window.UserBird?.removeBranding) {
          // Remove and re-append to move it to the end
          brandingElement.parentNode.removeChild(brandingElement);
          modal.successElement.appendChild(brandingElement);
        }
      }
    } else {
      // Remove the with-gif class if GIF is not enabled
      modal.successElement.classList.remove('with-gif');
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
          image_size: imageData?.size,
          metadata: {
            consoleLogs: consoleLogs
          }
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
    // Function to get a random GIF URL
    function getRandomGifUrl() {
      if (window.UserBird?.gifUrls && window.UserBird.gifUrls.length > 0) {
        // Randomly select a GIF from the array
        const randomIndex = Math.floor(Math.random() * window.UserBird.gifUrls.length);
        const selectedUrl = window.UserBird.gifUrls[randomIndex];
        return selectedUrl;
      }
      // Return null if no GIFs are available
      return null;
    }
    
    let gifHtml = '';
    if (window.UserBird?.showGifOnSuccess) {
      const gifUrl = getRandomGifUrl();
      if (gifUrl) {
        gifHtml = `<img src="${gifUrl}" alt="Success GIF">`;
      }
    }
    
    const successMessage = document.createElement('div');
    successMessage.innerHTML = `
      <h2>${MESSAGES.success.title}</h2>
      <p>${MESSAGES.success.description}</p>
      ${gifHtml}
    `;
    document.body.appendChild(successMessage);
  }

  // Initialize global API
  window.UserBird = window.UserBird || {};
  window.UserBird.formId = window.UserBird.formId || formId;
  
  // Add animation control flags
  window.UserBird.setAnimationRunning = function(isRunning) {
    isAnimationRunning = isRunning;
  };

  // Enhanced open method - respects the original if it was defined previously
  // Enable screenshot capture and annotation functionality
  window.UserBird.enableScreenshots = function() {
    return loadScreenshotDependencies()
      .then(() => {
        console.log('Screenshot dependencies loaded successfully');
        // Initialize screenshot dialog if needed
        if (!screenshotDialog && window.ScreenshotDialog) {
          screenshotDialog = new window.ScreenshotDialog();
          console.log('Screenshot dialog initialized');
        }
        return screenshotDialog;
      })
      .catch(err => {
        console.error('Failed to load screenshot dependencies:', err);
        return null;
      });
  };

  window.UserBird.open = function(trigger) {
    if (originalOpen) {
      // Call original method first if it was defined
      originalOpen(trigger);
    }
    
    // Then call our implementation
    openModal(trigger);
  };

  // Initialize widget once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();