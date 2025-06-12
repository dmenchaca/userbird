// Usermonk Widget
// 
// Console Capture Behavior:
// - Controlled by backend 'collect_console_logs' setting (default: enabled)
// - To completely disable: Set window.UserMonk.disableConsoleCapture = true (overrides backend setting)
//
(function() {
  const API_BASE_URL = 'https://usermonk.netlify.app';
  let settingsLoaded = false;
  let settingsPromise = null;
  let selectedImage = null;
  let screenshotDialog = null;
  
  // Load screenshot dependencies (html2canvas and markerjs3) when needed
  function loadScreenshotDependencies() {
    return new Promise((resolve, reject) => {
      // Check if libraries are already loaded
      if (window.html2canvas && window.markerjs3 && window.ScreenshotDialog) {
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
      
      // Load screenshot dialog if needed
      const screenshotDialogPromise = typeof window.ScreenshotDialog === 'undefined' ?
        loadScript(`${API_BASE_URL}/libs/screenshot-dialog.js`) :
        Promise.resolve();
      
      // Wait for all to load
      Promise.all([html2canvasPromise, markerjs3Promise, screenshotDialogPromise])
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
  let isScreenshotDialogOpen = false; // Track screenshot dialog state
  
  // Log buffer for console capture
  const MAX_LOG_ENTRIES = 100;
  let logBuffer = [];
  let consoleOriginals = {};
  let errorThrottleCount = 0;
  let lastErrorTime = 0;
  
  // Store the original open method if one is defined
  const originalOpen = window.UserMonk && typeof window.UserMonk.open === 'function' ? 
                      window.UserMonk.open : null;
  
  // Initialize console log capture
  function initConsoleCapture() {
    // Allow explicit override to disable console capture
    if (window.UserMonk?.disableConsoleCapture === true) {
      return;
    }
    
    // Check backend setting if available - if explicitly disabled, don't capture
    if (window.UserMonk?.settings?.collect_console_logs === false) {
      return;
    }
    
    // Only wrap if console exists
    if (typeof console !== 'undefined') {
      // Merge any early logs that were captured before widget loaded
      if (window.UserMonk?.earlyLogs && Array.isArray(window.UserMonk.earlyLogs)) {
        logBuffer.push(...window.UserMonk.earlyLogs);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.info('[Usermonk] Merged', window.UserMonk.earlyLogs.length, 'early console logs');
        }
        // Clean up early logs
        delete window.UserMonk.earlyLogs;
      }
      
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
        consoleOriginals.info('[Usermonk] Console logs are being captured for feedback reports.');
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
    document.querySelectorAll('[id^="usermonk-trigger-"]').forEach(triggerButton => {
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
              if (node.id && node.id.startsWith('usermonk-trigger-')) {
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
              const triggerButtons = node.querySelectorAll('[id^="usermonk-trigger-"]');
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
      .usermonk-modal {
        --ub-background: white;
        --ub-border-color: #e5e7eb;
        --ub-text: #111827;
        --ub-text-muted: #6b7280;
        --ub-hover-background: #f3f4f6;
        --ub-tooltip-background: white;
        --ub-tooltip-text: #374151;
        font-family: inherit;
      }

      /* Website dark mode settings */
      :root[data-theme="dark"] .usermonk-modal,
      :root.dark .usermonk-modal,
      :root[data-mode="dark"] .usermonk-modal,
      :root[data-color-mode="dark"] .usermonk-modal,
      :root[data-color-scheme="dark"] .usermonk-modal,
      .dark-theme .usermonk-modal,
      html[class*="dark"] .usermonk-modal {
        --ub-background: #0D0D0D;
        --ub-border-color: #363636;
        --ub-text: #e5e5e5;
        --ub-text-muted: #a1a1a1;
        --ub-hover-background: #2e2e2e;
        --ub-tooltip-background: #374151;
        --ub-tooltip-text: white;
      }

      .usermonk-modal {
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
      .usermonk-modal.open {
        opacity: 1;
        visibility: visible;
      }
      .usermonk-modal-content {
        position: relative;
        padding: 1rem;
      }
      .usermonk-form {
        display: block;
      }
      .usermonk-form.hidden {
        display: none;
      }
      .usermonk-title {
        font-size: 1rem !important;
        font-weight: 600 !important;
        color: var(--ub-text) !important;
        margin-top: 0;
        margin-bottom: 1rem;
        padding: 0;
        line-height: normal;
        font-family: inherit;
      }
      .usermonk-textarea {
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
      :root[data-theme="dark"] .usermonk-textarea,
      :root.dark .usermonk-textarea,
      :root[data-mode="dark"] .usermonk-textarea,
      :root[data-color-mode="dark"] .usermonk-textarea,
      :root[data-color-scheme="dark"] .usermonk-textarea,
      .dark-theme .usermonk-textarea,
      html[class*="dark"] .usermonk-textarea {
        background: #171717;
      }

      .usermonk-textarea:focus {
        outline: none;
      }
      .usermonk-image-upload {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .usermonk-file-input {
        display: none;
      }
      .usermonk-image-button {
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
      .usermonk-image-button:hover {
        background: var(--ub-hover-background);
      }
      .usermonk-image-preview {
        display: none;
        position: relative;
      }
      .usermonk-image-preview.show {
        display: block;
      }
      .usermonk-image-preview img {
        width: 36px;
        height: 36px;
        object-fit: cover;
        border-radius: 6px;
      }
      .usermonk-remove-image {
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
      .usermonk-buttons {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1rem;
      }
      .usermonk-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .usermonk-button {
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
      .usermonk-button {
        background: ${buttonColor};
        color: white;
        border: none;
      }
      .usermonk-button:hover {
        opacity: 0.9;
      }
      .usermonk-button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      .usermonk-button-secondary {
        background: transparent;
        color: var(--ub-text-muted);
        border: 1px solid var(--ub-border-color);
      }
      .usermonk-button-secondary:hover {
        background: var(--ub-hover-background);
      }
      .usermonk-spinner {
        display: none;
        width: 16px !important;
        height: 16px !important;
        animation: usermonk-spin 1s linear infinite;
      }
      @keyframes usermonk-spin {
        to { transform: rotate(360deg); }
      }
      .usermonk-button-secondary:hover {
        background: var(--ub-hover-background);
      }
      .usermonk-success {
        text-align: center;
        padding: 1rem;
        display: none;
      }
      .usermonk-success.with-gif {
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
      }
      .usermonk-success.open {
        display: block;
      }
      .usermonk-success-icon {
        width: 48px;
        height: 48px;
        margin: 0 auto 1rem;
        color: #22c55e;
        opacity: 0;
        transform: scale(0.8);
        animation: usermonk-success-icon 0.4s ease-out forwards;
      }
      .usermonk-success-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: var(--ub-text);
        opacity: 0;
        transform: translateY(10px);
        animation: usermonk-success-title 0.4s ease-out 0.2s forwards;
      }
      .usermonk-success-message {
        color: var(--ub-text-muted);
        font-size: 0.875rem;
        opacity: 0;
        transform: translateY(10px);
        animation: usermonk-success-message 0.4s ease-out 0.4s forwards;
      }
      .usermonk-success-gif {
        max-width: 100%;
        margin-top: 1rem;
        border-radius: 6px;
        opacity: 0;
        transform: translateY(10px);
        animation: usermonk-success-gif 0.4s ease-out 0.6s forwards;
      }
      @keyframes usermonk-success-icon {
        from {
          opacity: 0;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes usermonk-success-title {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes usermonk-success-message {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes usermonk-success-gif {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .usermonk-support-text {
        font-size: 0.75rem;
        color: var(--ub-text-muted);
        text-align: left;
        margin-top: 1rem;
      }
      .usermonk-support-text a {
        color: ${buttonColor};
        text-decoration: none;
        font-weight: 500;
      }
      .usermonk-support-text a:hover {
        text-decoration: underline;
      }
      .usermonk-submit[disabled] .usermonk-spinner {
        display: block;
        color: currentColor;
      }
      .usermonk-submit[disabled] .usermonk-submit-text {
        opacity: 0.8;
      }
      
      /* Branding styles */
      .usermonk-branding {
        text-align: center;
        margin-top: 1rem;
      }
      .usermonk-branding-link {
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
      .usermonk-branding-link:hover {
        background-color: rgba(156, 163, 175, 0.1);
      }
      .usermonk-branding-icon {
        display: inline-block;
        vertical-align: middle;
      }
      .usermonk-branding-hidden {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function createModal() {
    const modal = document.createElement('div');
    
    modal.className = 'usermonk-modal';
    
    modal.innerHTML = `
      <div class="usermonk-modal-content">
        <div class="usermonk-form">
          <h3 class="usermonk-title">Feedback</h3>
          <textarea class="usermonk-textarea" placeholder="Help us improve this page."></textarea>
          <div class="usermonk-error"></div>
          <div class="usermonk-buttons">
            <button class="usermonk-button usermonk-button-secondary usermonk-close">${MESSAGES.labels.cancel}</button>
            <div class="usermonk-actions">
              <div class="usermonk-image-upload">
                <input type="file" accept="image/jpeg,image/png" class="usermonk-file-input" />
                <button class="usermonk-image-button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                </button>
                <div class="usermonk-image-preview">
                  <button class="usermonk-remove-image">&times;</button>
                </div>
              </div>
              <button class="usermonk-button usermonk-submit">
                <span class="usermonk-submit-text">${MESSAGES.labels.submit}</span>
                <svg class="usermonk-spinner" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="usermonk-support-text"></div>
        </div>
        <div class="usermonk-success">
          <svg class="usermonk-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 4L12 14.01l-3-3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3 class="usermonk-success-title">${MESSAGES.success.title}</h3>
          <p class="usermonk-success-message">${MESSAGES.success.description}</p>
          <!-- GIF will be dynamically added here if enabled -->
          <div class="usermonk-branding${window.UserMonk?.removeBranding ? ' usermonk-branding-hidden' : ''}">
            <a href="https://app.usermonk.com/?ref=widget&domain=${encodeURIComponent(window.location.hostname)}" class="usermonk-branding-link" target="_blank" rel="noopener noreferrer">
              We run on 🌀 Usermonk
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    return {
      modal,
      form: modal.querySelector('.usermonk-form'),
      textarea: modal.querySelector('.usermonk-textarea'),
      submitButton: modal.querySelector('.usermonk-submit'),
      closeButtons: modal.querySelectorAll('.usermonk-close'),
      errorElement: modal.querySelector('.usermonk-error'),
      successElement: modal.querySelector('.usermonk-success'),
      supportTextElement: modal.querySelector('.usermonk-support-text')
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
      const isSuccessWithGif = modal.successElement.classList.contains('open') && window.UserMonk?.showGifOnSuccess === true;
      
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
    if (!modal?.modal || !window.UserMonk?.showGifOnSuccess) return;
    
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
      if (modal.classList.contains('usermonk-modal')) return false;
      const styles = window.getComputedStyle(modal);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });

    if (hasVisibleModal) return;
    
    // Trigger element passed for modal positioning

    if (!settingsLoaded) {
      const loading = document.createElement('div');
      loading.className = 'usermonk-loading';
      loading.innerHTML = '<div class="usermonk-loading-spinner"></div>';
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
      
      // Don't close if screenshot dialog is open
      if (isScreenshotDialogOpen) {
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
      modal.submitButton.querySelector('.usermonk-submit-text').textContent = MESSAGES.labels.submit;
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

    formId = window.UserMonk?.formId;
    const user = window.UserMonk?.user;
    
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
        const collectConsoleLogs = settings.collect_console_logs !== false; // Default to true
        const screenshotMethod = settings.screenshot_method || 'canvas'; // Default to canvas
        
        injectStyles(buttonColor);
        modal = createModal();
        setupModal(buttonColor, supportText);
        
        window.UserMonk.shortcut = keyboardShortcut;
        window.UserMonk.settings = {
          sound_enabled: soundEnabled,
          collect_console_logs: collectConsoleLogs,
          screenshot_method: screenshotMethod
        };
        window.UserMonk.showGifOnSuccess = showGifOnSuccess;
        window.UserMonk.gifUrls = gifUrls;
        window.UserMonk.removeBranding = removeBranding;
        
        // Re-initialize console capture now that we have backend settings
        // This handles cases where console capture was initialized before settings loaded
        if (collectConsoleLogs && !window.UserMonk?.disableConsoleCapture) {
          initConsoleCapture();
        }
        
        // Update branding visibility based on setting
        const brandingElement = modal.modal.querySelector('.usermonk-branding');
        if (brandingElement) {
          if (removeBranding) {
            brandingElement.classList.add('usermonk-branding-hidden');
          } else {
            brandingElement.classList.remove('usermonk-branding-hidden');
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
  
  // Add tooltip functionality
  function addTooltip(element, text) {
    let tooltipElement = null;
    let timeoutId = null;

    const showTooltip = () => {
      if (tooltipElement) return;
      
      timeoutId = setTimeout(() => {
        tooltipElement = document.createElement('div');
        tooltipElement.textContent = text;
        tooltipElement.style.cssText = `
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) scale(0.95);
          background: var(--ub-tooltip-background);
          color: var(--ub-tooltip-text);
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid var(--ub-border-color);
          font-size: 12px;
          white-space: nowrap;
          z-index: 10002;
          pointer-events: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          opacity: 0;
          transition: opacity 0.15s ease-out, transform 0.15s ease-out;
        `;
        element.appendChild(tooltipElement);
        
        // Trigger animation on next frame
        requestAnimationFrame(() => {
          tooltipElement.style.opacity = '1';
          tooltipElement.style.transform = 'translateX(-50%) scale(1)';
        });
      }, 300);
    };

    const hideTooltip = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (tooltipElement) {
        tooltipElement.style.opacity = '0';
        tooltipElement.style.transform = 'translateX(-50%) scale(0.95)';
        
        // Remove element after animation completes
        setTimeout(() => {
          if (tooltipElement && tooltipElement.parentNode) {
            tooltipElement.remove();
            tooltipElement = null;
          }
        }, 150);
      }
    };

    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);
    element.addEventListener('click', hideTooltip);
  }
  
  function setupModal(buttonColor, supportText) {
    const fileInput = modal.modal.querySelector('.usermonk-file-input');
    const imageButton = modal.modal.querySelector('.usermonk-image-button');
    const imagePreview = modal.modal.querySelector('.usermonk-image-preview');
    const removeImageButton = modal.modal.querySelector('.usermonk-remove-image');
    
    // Add tooltip to the screenshot button
    addTooltip(imageButton, 'Capture screenshot');
    
    // Initialize screenshot functionality when the widget loads
    loadScreenshotDependencies().then(result => {
      // console.log('Screenshot dependencies pre-loaded');
    }).catch(err => {
      console.error('Failed to pre-load screenshot dependencies:', err);
    });
    
    // Change image button to trigger screenshot instead of file upload
    imageButton.addEventListener('click', () => {
      // Load screenshot dependencies and initialize dialog if needed
      UserMonk.enableScreenshots().then(dialog => {
        if (dialog) {
          // Store the current trigger to reopen modal later
          const triggerToReopen = currentTrigger;
          
          // Close the widget modal before opening screenshot dialog
          closeModal();
          
          // Wait for browser to render the modal as hidden, then take screenshot
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Add small delay to ensure modal is completely gone
              setTimeout(() => {
                // Two animation frames + delay ensures modal is visually gone
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
                        const imagePreview = modal.modal.querySelector('.usermonk-image-preview');
                        const imageButton = modal.modal.querySelector('.usermonk-image-button');
                        const removeImageButton = modal.modal.querySelector('.usermonk-remove-image');
                        
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
                                    const newImg = modal.modal.querySelector('.usermonk-image-preview img');
                                    if (newImg) {
                                      newImg.src = URL.createObjectURL(newScreenshotFile);
                                    }
                                  }, 100);
                                });
                            } else {
                              // User cancelled, just reopen modal
                              openModal(currentTriggerForReEdit);
                            }
                          }, buttonColor); // Pass the dynamic button color for re-editing
                        });
                        
                        // Clear previous content and add image and remove button
                        imagePreview.innerHTML = '';
                        imagePreview.appendChild(img);
                        imagePreview.appendChild(removeImageButton);
                        imagePreview.classList.add('show');
                        imageButton.style.display = 'none';
                      }, 100); // 100ms delay to ensure modal is completely hidden
                    })
                    .catch(err => {
                      console.error('Error processing screenshot:', err);
                      // Reopen the widget modal even if there was an error
                      openModal(triggerToReopen);
                    });
                }, buttonColor); // Pass the dynamic button color to the screenshot dialog
              }, 100); // 100ms delay to ensure modal is completely hidden
            });
          });
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
      modal.submitButton.querySelector('.usermonk-submit-text').textContent = MESSAGES.labels.submitting;

      try {
        await submitFeedback(message);
      } catch (error) {
        modal.errorElement.textContent = 'Failed to submit feedback';
        modal.errorElement.style.display = 'block';
        modal.submitButton.disabled = false;
        modal.submitButton.querySelector('.usermonk-submit-text').textContent = MESSAGES.labels.submit;
      }
    }

    window.UserMonk.open = (triggerElement) => {
      const trigger = triggerElement || document.getElementById(`usermonk-trigger-${formId}`);
      if (modal.modal.classList.contains('open') && currentTrigger === trigger) {
        closeModal();
      } else {
        openModal(trigger);
      }
    };
  }

  async function submitFeedback(message) {
    const systemInfo = getSystemInfo();
    const userInfo = window.UserMonk?.user || {};
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
    const existingGif = modal.successElement.querySelector('.usermonk-success-gif');
    if (existingGif) {
      existingGif.remove();
    }
    
    // Get the branding element so we can reposition it
    const brandingElement = modal.successElement.querySelector('.usermonk-branding');
    
    // Add the GIF to the success message if enabled
    if (window.UserMonk?.showGifOnSuccess) {
      // Add class for GIF-specific styling
      modal.successElement.classList.add('with-gif');
      
      // Function to get a random GIF URL
      function getRandomGifUrl() {
        if (window.UserMonk?.gifUrls && window.UserMonk.gifUrls.length > 0) {
          const randomIndex = Math.floor(Math.random() * window.UserMonk.gifUrls.length);
          const selectedUrl = window.UserMonk.gifUrls[randomIndex];
          return selectedUrl;
        }
        return null;
      }
      
      const gifUrl = getRandomGifUrl();
      
      // Only show GIF if we have a valid URL
      if (gifUrl) {
        // Hide the SVG icon when GIF is shown
        const successIcon = modal.successElement.querySelector('.usermonk-success-icon');
        if (successIcon) {
          successIcon.style.display = 'none';
        }
        
        const successGif = document.createElement('img');
        successGif.src = gifUrl;
        successGif.alt = "Success GIF";
        successGif.className = "usermonk-success-gif";
        successGif.style.maxWidth = "100%";
        successGif.style.marginTop = "1rem";
        successGif.style.borderRadius = "6px";
        modal.successElement.appendChild(successGif);
        
        // Move branding after the GIF if branding is enabled
        if (brandingElement && !window.UserMonk?.removeBranding) {
          // Remove and re-append to move it to the end
          brandingElement.parentNode.removeChild(brandingElement);
          modal.successElement.appendChild(brandingElement);
        }
      }
    } else {
      // Remove the with-gif class if GIF is not enabled
      modal.successElement.classList.remove('with-gif');
    }
    
    if (window.UserMonk?.settings?.sound_enabled && successSound) {
      try {
        await successSound.play();
      } catch (error) {
        // Ignore sound play errors
      }
    }

    modal.textarea.value = '';
    selectedImage = null;
    const imagePreview = modal.modal.querySelector('.usermonk-image-preview');
    const imageButton = modal.modal.querySelector('.usermonk-image-button');
    imagePreview.classList.remove('show');
    imagePreview.innerHTML = '';
    imageButton.style.display = 'block';
    modal.modal.querySelector('.usermonk-file-input').value = '';
    
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
    // If screenshot dialog is open, don't handle any keyboard shortcuts
    if (isScreenshotDialogOpen) {
      return;
    }
    
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
    
    const shortcut = window.UserMonk?.shortcut;
    if (!shortcut) {
      return;
    }
    
    const currentKeys = Array.from(pressedKeys).sort().join('+');
    const shortcutKeys = shortcut.split('+')
      .map(k => normalizeKey(k))
      .sort()
      .join('+');
    
    if (currentKeys === shortcutKeys) {
      const defaultTrigger = document.getElementById(`usermonk-trigger-${formId}`);
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
      if (window.UserMonk?.gifUrls && window.UserMonk.gifUrls.length > 0) {
        // Randomly select a GIF from the array
        const randomIndex = Math.floor(Math.random() * window.UserMonk.gifUrls.length);
        const selectedUrl = window.UserMonk.gifUrls[randomIndex];
        return selectedUrl;
      }
      // Return null if no GIFs are available
      return null;
    }
    
    let gifHtml = '';
    if (window.UserMonk?.showGifOnSuccess) {
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
  window.UserMonk = window.UserMonk || {};
  window.UserMonk.formId = window.UserMonk.formId || formId;
  
  // Expose console log functions
  window.UserMonk.getRecentLogs = getRecentLogs;
  
  // Add animation control flags
  window.UserMonk.setAnimationRunning = function(isRunning) {
    isAnimationRunning = isRunning;
  };

  // Add screenshot dialog state control
  window.UserMonk.setScreenshotDialogOpen = function(isOpen) {
    isScreenshotDialogOpen = isOpen;
  };

  // Enhanced open method - respects the original if it was defined previously
  // Enable screenshot capture and annotation functionality
  window.UserMonk.enableScreenshots = function() {
    return loadScreenshotDependencies()
      .then(() => {
        // Initialize screenshot dialog if needed
        if (!screenshotDialog && window.ScreenshotDialog) {
          screenshotDialog = new window.ScreenshotDialog();
        }
        return screenshotDialog;
      })
      .catch(err => {
        console.error('Failed to load screenshot dependencies:', err);
        return null;
      });
  };

  window.UserMonk.open = function(trigger) {
    if (originalOpen) {
      // Call original method first if it was defined
      originalOpen(trigger);
    }
    
    // Then call our implementation
    openModal(trigger);
  };

  // Initialize console capture immediately - don't wait for DOM or settings
  // This ensures we capture early console logs from Next.js components
  initConsoleCapture();

  // Initialize widget once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // For Next.js apps, also wait a bit for hydration to complete
    if (typeof window !== 'undefined' && window.next) {
      // Delay initialization slightly for Next.js hydration
      setTimeout(init, 100);
    } else {
      init();
    }
  }
})();