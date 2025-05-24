/**
 * Vanilla JavaScript Screenshot Dialog Component
 * Uses html2canvas for screenshot capture and markerjs3 for annotation functionality
 */
class ScreenshotDialog {
  constructor(buttonColor = '#1f2937') {
    this.isOpen = false;
    this.screenshotSrc = null;
    this.annotatedImage = null;
    this.markerArea = null;
    this.isAnnotationReady = false;
    this.onSaveAnnotation = null;
    this.isCapturing = false;
    this.buttonColor = buttonColor; // Store the dynamic button color
    this.imageCache = new Map(); // Cache for converted images
    
    // Toolbar state
    this.toolbarPosition = { top: 10, left: '50%', transform: 'translateX(-50%)' };
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    this.injectDarkModeStyles();
    this.injectScreenshotStyles();
    this.createDialog();
    this.attachEventListeners();
    this.loadHtml2Canvas();
  }

  async loadHtml2Canvas() {
    // Load html2canvas from local Netlify hosting instead of CDN
    if (typeof html2canvas === 'undefined') {
      const script = document.createElement('script');
      script.src = '/libs/html2canvas/html2canvas.min.js';
      script.onload = () => {
        // console.log('✅ html2canvas loaded successfully');
      };
      script.onerror = () => {
        console.error('❌ Failed to load html2canvas');
      };
      document.head.appendChild(script);
    }
  }

  injectDarkModeStyles() {
    // Inject CSS variables and dark mode styles that match the Userbird widget
    const style = document.createElement('style');
    style.textContent = `
      /* Light mode defaults for screenshot dialog */
      .screenshot-dialog-overlay {
        --ssd-background: white;
        --ssd-border-color: #e5e7eb;
        --ssd-text: #111827;
        --ssd-text-muted: #6b7280;
        --ssd-hover-background: #f3f4f6;
        --ssd-toolbar-background: rgba(255, 255, 255, 1.0);
        --ssd-tooltip-background: #374151;
        --ssd-tooltip-text: white;
      }

      /* Dark mode settings - matches Userbird widget selectors */
      :root[data-theme="dark"] .screenshot-dialog-overlay,
      :root.dark .screenshot-dialog-overlay,
      :root[data-mode="dark"] .screenshot-dialog-overlay,
      :root[data-color-mode="dark"] .screenshot-dialog-overlay,
      :root[data-color-scheme="dark"] .screenshot-dialog-overlay,
      .dark-theme .screenshot-dialog-overlay,
      html[class*="dark"] .screenshot-dialog-overlay {
        --ssd-background: #0D0D0D;
        --ssd-border-color: #363636;
        --ssd-text: #e5e5e5;
        --ssd-text-muted: #a1a1a1;
        --ssd-hover-background: #2e2e2e;
        --ssd-toolbar-background: rgba(13, 13, 13, 1.0);
        --ssd-tooltip-background: #363636;
        --ssd-tooltip-text: #e5e5e5;
      }
    `;
    document.head.appendChild(style);
  }

  injectScreenshotStyles() {
    // Add styles for screenshot quality improvement
    const style = document.createElement('style');
    style.textContent = `
      .screenshot-mode {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: geometricPrecision;
        font-smooth: always;
        image-rendering: -webkit-optimize-contrast;
      }
    `;
    document.head.appendChild(style);
  }

  createDialog() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'screenshot-dialog-overlay';
    this.overlay.tabIndex = -1; // Make focusable for focus management
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.8);
      display: none;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      outline: none;
    `;

    // Create dialog content
    this.dialog = document.createElement('div');
    this.dialog.className = 'screenshot-dialog-content';
    this.dialog.style.cssText = `
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      max-width: 95vw;
      width: auto;
      max-height: 95vh;
      background: var(--ssd-background);
      border-radius: 8px;
      padding: 0;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border: 1px solid var(--ssd-border-color);
    `;

    // Create close button in top right corner
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'screenshot-dialog-close';
    this.closeButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    this.closeButton.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 10003;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: var(--ssd-background);
      color: var(--ssd-text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--ssd-border-color);
    `;
    
    // Add hover effects for close button
    this.closeButton.addEventListener('mouseenter', () => {
      this.closeButton.style.background = 'var(--ssd-hover-background)';
      this.closeButton.style.color = 'var(--ssd-text)';
    });
    this.closeButton.addEventListener('mouseleave', () => {
      this.closeButton.style.background = 'var(--ssd-background)';
      this.closeButton.style.color = 'var(--ssd-text-muted)';
    });
    
    // Add click handler for close button
    this.closeButton.addEventListener('click', () => {
      this.close();
    });

    // Create container for image and annotations
    this.container = document.createElement('div');
    this.container.className = 'screenshot-container';
    this.container.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--ssd-border-color);
      border-radius: 6px;
      overflow: hidden;
    `;

    // Create image element
    this.imageElement = document.createElement('img');
    this.imageElement.style.cssText = `
      max-width: 95vw;
      max-height: 90vh;
      object-fit: contain;
      image-rendering: auto;
    `;

    // Create toolbar
    this.createToolbar();

    // Assemble dialog
    this.container.appendChild(this.imageElement);
    this.container.appendChild(this.toolbar);
    this.dialog.appendChild(this.closeButton);
    this.dialog.appendChild(this.container);
    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);
  }

  createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'screenshot-toolbar';
    this.toolbar.style.cssText = `
      position: absolute;
      z-index: 10001;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      user-select: none;
      transition: all 0.1s ease;
      display: none;
    `;

    this.toolbarContent = document.createElement('div');
    this.toolbarContent.style.cssText = `
      background: var(--ssd-toolbar-background);
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 16px;
      display: flex;
      gap: 16px;
      align-items: center;
      border: 1px solid var(--ssd-border-color);
    `;

    // Drag handle
    this.dragHandle = document.createElement('div');
    this.dragHandle.className = 'toolbar-drag-handle';
    this.dragHandle.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="12" r="1"></circle>
        <circle cx="9" cy="5" r="1"></circle>
        <circle cx="9" cy="19" r="1"></circle>
        <circle cx="15" cy="12" r="1"></circle>
        <circle cx="15" cy="5" r="1"></circle>
        <circle cx="15" cy="19" r="1"></circle>
      </svg>
    `;
    this.dragHandle.style.cssText = `
      display: flex;
      align-items: center;
      padding-right: 8px;
      cursor: grab;
      color: var(--ssd-text);
      padding: 8px;
      border-radius: 8px;
      transition: all 0.2s;
    `;
    this.dragHandle.addEventListener('mouseenter', () => {
      this.dragHandle.style.color = 'var(--ssd-text)';
      this.dragHandle.style.backgroundColor = 'var(--ssd-hover-background)';
    });
    this.dragHandle.addEventListener('mouseleave', () => {
      this.dragHandle.style.color = 'var(--ssd-text)';
      this.dragHandle.style.backgroundColor = 'transparent';
    });

    this.toolbarContent.appendChild(this.dragHandle);
    this.toolbar.appendChild(this.toolbarContent);
  }

  createButton(iconSvg, text, tooltip, onClick, variant = 'outline') {
    const button = document.createElement('button');
    // Scale up icons by replacing width="16" height="16" with width="32" height="32"
    const scaledIconSvg = iconSvg.replace(/width="16" height="16"/g, 'width="32" height="32"');
    button.innerHTML = `${scaledIconSvg} ${text ? `<span style="margin-left: 8px;">${text}</span>` : ''}`;
    
    const baseStyles = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 500;
      padding: 1rem 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      border: none;
    `;

    if (variant === 'outline') {
      button.style.cssText = baseStyles + `
        background: transparent;
        border: 1px solid var(--ssd-border-color);
        color: var(--ssd-text);
      `;
      button.addEventListener('mouseenter', () => {
        button.style.background = 'var(--ssd-hover-background)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
      });
    } else {
      button.style.cssText = baseStyles + `
        background: ${this.buttonColor};
        color: white;
      `;
      button.addEventListener('mouseenter', () => {
        button.style.opacity = '0.9';
      });
      button.addEventListener('mouseleave', () => {
        button.style.opacity = '1';
      });
    }

    button.addEventListener('click', onClick);

    // Add tooltip
    if (tooltip) {
      this.addTooltip(button, tooltip);
    }

    return button;
  }

  addTooltip(element, text) {
    let tooltipElement = null;
    let timeoutId = null;

    const showTooltip = () => {
      if (tooltipElement) return;
      
      timeoutId = setTimeout(() => {
        tooltipElement = document.createElement('div');
        tooltipElement.textContent = text;
        tooltipElement.style.cssText = `
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--ssd-tooltip-background);
          color: var(--ssd-tooltip-text);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10002;
          pointer-events: none;
        `;
        element.appendChild(tooltipElement);
      }, 300);
    };

    const hideTooltip = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
      }
    };

    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);
    element.addEventListener('click', hideTooltip);
  }

  createAnnotationTools() {
    const tools = document.createElement('div');
    tools.style.cssText = 'display: flex; gap: 16px; align-items: center;';

    // Rectangle tool
    const rectButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
      '',
      'Rectangle',
      () => this.createMarker('RectMarker')
    );

    // Arrow tool
    const arrowButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 7 10 10"></path><path d="M17 7v10H7"></path></svg>',
      '',
      'Arrow',
      () => this.createMarker('ArrowMarker')
    );

    // Text tool
    const textButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,7 4,4 20,4 20,7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>',
      '',
      'Text',
      () => this.createMarker('TextMarker')
    );

    // Hide tool
    const hideButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>',
      '',
      'Hide',
      () => this.createMarker('CoverMarker')
    );

    // Separator
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 48px; background: var(--ssd-border-color);';

    // Done button
    const doneButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>',
      'Done',
      'Save Annotation',
      () => this.saveAnnotation(),
      'default'
    );

    tools.appendChild(rectButton);
    tools.appendChild(arrowButton);
    tools.appendChild(textButton);
    tools.appendChild(hideButton);
    tools.appendChild(separator);
    tools.appendChild(doneButton);

    return tools;
  }

  createPreviewTools() {
    const tools = document.createElement('div');
    tools.style.cssText = 'display: flex; gap: 16px; align-items: center;';

    // Delete button
    const deleteButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      'Delete',
      'Delete screenshot',
      () => this.deleteScreenshot()
    );

    // Separator
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 48px; background: var(--ssd-border-color);';

    // Close button
    const closeButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      'Close',
      'Close dialog',
      () => this.close(),
      'default'
    );

    tools.appendChild(deleteButton);
    tools.appendChild(separator);
    tools.appendChild(closeButton);

    return tools;
  }

  attachEventListeners() {
    // Close on overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Toolbar dragging
    this.dragHandle.addEventListener('mousedown', this.handleMouseDown.bind(this));

    // Comprehensive keyboard event handling to prevent host app shortcuts
    this.overlay.addEventListener('keydown', this.handleKeyDown.bind(this), true); // Use capture phase
    this.overlay.addEventListener('keyup', this.handleKeyUp.bind(this), true); // Use capture phase
    this.overlay.addEventListener('keypress', this.handleKeyPress.bind(this), true); // Use capture phase
    
    // Focus management - ensure focus stays within dialog
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
  }

  handleFocusIn(e) {
    // Only manage focus when screenshot dialog is open
    if (!this.isOpen) return;
    
    // Allow MarkerArea to manage its own elements (text inputs, etc.)
    // Only redirect focus if it's going to completely unrelated elements
    if (!this.overlay.contains(e.target) && 
        !e.target.closest('.markerjs-marker-area') && 
        !e.target.closest('[class*="marker"]')) {
      // Focus moved to unrelated element, bring it back to overlay
      this.overlay.focus();
    }
  }

  handleMouseDown(e) {
    if (!this.dragHandle.contains(e.target)) return;

    const rect = this.toolbar.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    this.isDragging = true;
    this.dragHandle.style.cursor = 'grabbing';

    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  handleMouseMove(e) {
    if (!this.isDragging) return;

    const containerRect = this.container.getBoundingClientRect();
    const newLeft = e.clientX - containerRect.left - this.dragOffset.x;
    const newTop = e.clientY - containerRect.top - this.dragOffset.y;

    const toolbarWidth = this.toolbar.offsetWidth;
    const toolbarHeight = this.toolbar.offsetHeight;

    const boundedLeft = Math.max(0, Math.min(newLeft, containerRect.width - toolbarWidth));
    const boundedTop = Math.max(0, Math.min(newTop, containerRect.height - toolbarHeight));

    this.toolbar.style.left = `${boundedLeft}px`;
    this.toolbar.style.top = `${boundedTop}px`;
    this.toolbar.style.transform = 'none';
  }

  handleMouseUp() {
    this.isDragging = false;
    this.dragHandle.style.cursor = 'grab';
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  handleKeyDown(e) {
    // Always prevent keyboard shortcuts from bubbling to host application
    // But allow normal typing and MarkerArea interactions
    
    // Don't interfere with MarkerArea text inputs and other interactive elements
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable ||
        e.target.closest('.markerjs-marker-area')) {
      // Allow normal typing and interaction - only stop propagation for shortcuts
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.length === 1) {
        e.stopPropagation(); // Prevent shortcuts but allow normal typing
      }
      return;
    }
    
    // For all other elements, prevent all keyboard events from bubbling
    e.stopPropagation();
    
    // Specifically handle ESC key to prevent it from closing the widget
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return; // Do nothing - ESC is completely disabled for closing
    }
    
    // Only handle our specific shortcuts if dialog is open and annotation is ready
    if (!this.isOpen || !this.markerArea || !this.isAnnotationReady || this.annotatedImage) return;

    // Undo: Ctrl+Z or Cmd+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (typeof this.markerArea.undo === 'function') {
        this.markerArea.undo();
      }
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (typeof this.markerArea.redo === 'function') {
        this.markerArea.redo();
      }
    }
  }

  handleKeyUp(e) {
    // Only prevent shortcuts from bubbling, allow normal typing
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable ||
        e.target.closest('.markerjs-marker-area')) {
      // Allow normal typing - only stop shortcuts
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.length === 1) {
        e.stopPropagation();
      }
      return;
    }
    
    // For other elements, prevent all events from bubbling
    e.stopPropagation();
  }

  handleKeyPress(e) {
    // Only prevent shortcuts from bubbling, allow normal typing
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable ||
        e.target.closest('.markerjs-marker-area')) {
      // Allow normal typing - only stop shortcuts
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.length === 1) {
        e.stopPropagation();
      }
      return;
    }
    
    // For other elements, prevent all events from bubbling
    e.stopPropagation();
  }

  open(screenshotSrc, onSaveAnnotation = null, buttonColor = null) {
    // Update button color if provided
    if (buttonColor) {
      this.buttonColor = buttonColor;
    }
    
    // Notify widget that screenshot dialog is open to prevent shortcuts
    if (window.UserBird && window.UserBird.setScreenshotDialogOpen) {
      window.UserBird.setScreenshotDialogOpen(true);
    }
    
    this.screenshotSrc = screenshotSrc;
    this.onSaveAnnotation = onSaveAnnotation;
    this.isOpen = true;

    // console.log('📸 Screenshot dialog opened');
    // console.log('🔗 Original screenshotSrc stored:', this.screenshotSrc?.substring(0, 50) + '...');
    // console.log('🎨 Current annotatedImage:', this.annotatedImage ? 'exists' : 'null');

    // Reset image to original state before opening
    this.resetImageElement();

    // Show overlay
    this.overlay.style.display = 'block';
    setTimeout(() => {
      this.overlay.style.opacity = '1';
    }, 10);

    // Handle dialog open events - mirrors React useEffect logic
    if (this.annotatedImage) {
      // When opening with an existing annotated image (thumbnail click),
      // show the preview mode immediately
      this.isAnnotationReady = false;
      this.imageElement.src = this.annotatedImage;
      setTimeout(() => {
        this.updateToolbar();
      }, 100);
    } else if (screenshotSrc && !this.isAnnotationReady) {
      // When opening with a new screenshot, start annotation mode
      this.imageElement.src = screenshotSrc;
      this.imageElement.onload = () => {
        // Ensure image is reset after loading
        this.resetImageElement();
        setTimeout(() => {
          this.startAnnotation();
        }, 100);
      };
    }
  }

  resetImageElement() {
    if (this.imageElement) {
      // Reset all possible CSS properties that might be modified by MarkerArea
      this.imageElement.style.cssText = `
        max-width: 95vw;
        max-height: 90vh;
        object-fit: contain;
        image-rendering: auto;
        width: auto;
        height: auto;
        transform: none;
        display: block;
      `;
      
      // Remove any attributes that might have been added
      this.imageElement.removeAttribute('width');
      this.imageElement.removeAttribute('height');
    }
  }

  close() {
    // Notify widget that screenshot dialog is closed
    if (window.UserBird && window.UserBird.setScreenshotDialogOpen) {
      window.UserBird.setScreenshotDialogOpen(false);
    }
    
    this.isOpen = false;
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.overlay.style.display = 'none';
    }, 200);

    // Hide toolbar when closing
    this.toolbar.style.display = 'none';
    this.cleanup();
  }

  cleanup() {
    // Notify widget that screenshot dialog is closed
    if (window.UserBird && window.UserBird.setScreenshotDialogOpen) {
      window.UserBird.setScreenshotDialogOpen(false);
    }
    
    // Remove focus event listener
    document.removeEventListener('focusin', this.handleFocusIn.bind(this));
    
    if (this.markerArea) {
      try {
        if (this.markerArea.parentNode) {
          this.markerArea.parentNode.removeChild(this.markerArea);
        }
      } catch (e) {
        console.error("Error cleaning up marker area:", e);
      }
      this.markerArea = null;
    }
    this.isAnnotationReady = false;
    
    // Reset image element after MarkerArea cleanup
    this.resetImageElement();
  }

  async startAnnotation() {
    if (!this.imageElement || !this.container) return;

    // console.log('🎨 Starting annotation mode');
    // console.log('🔗 Image source for annotation:', this.imageElement.src?.substring(0, 50) + '...');

    this.cleanup();

    try {
      // Import markerjs3 classes from global object (assuming CDN)
      const { MarkerArea } = window.markerjs3;
      
      this.markerArea = new MarkerArea();
      this.markerArea.targetImage = this.imageElement;
      this.container.appendChild(this.markerArea);

      this.isAnnotationReady = true;
      // console.log('✅ Annotation mode ready - MarkerArea initialized');
      this.updateToolbar();

      // Hide the original image when MarkerArea is active
      this.imageElement.style.display = 'none';
    } catch (error) {
      console.error("Error setting up annotation:", error);
      this.isAnnotationReady = false;
    }
  }

  createMarker(markerType) {
    if (this.markerArea) {
      const marker = this.markerArea.createMarker(markerType);
      
      // Set thicker stroke width for rectangles and arrows
      if (marker && (markerType === 'RectMarker' || markerType === 'ArrowMarker')) {
        try {
          if (marker.strokeWidth !== undefined) {
            marker.strokeWidth = 5;
          }
          if (marker.strokeColor !== undefined) {
            marker.strokeColor = this.buttonColor;
          }
        } catch (e) {
          console.error('Error setting marker style:', e);
        }
      }
    }
  }

  async saveAnnotation() {
    if (!this.markerArea || !this.screenshotSrc) return;

    // console.log('💾 Starting save annotation process');
    // console.log('🔗 Using original screenshotSrc:', this.screenshotSrc?.substring(0, 50) + '...');

    try {
      // Import Renderer from global object
      const { Renderer } = window.markerjs3;
      
      const state = this.markerArea.getState();
      
      // Create temporary image
      const img = document.createElement('img');
      img.src = this.screenshotSrc;
      
      // console.log('📷 Created temp image from original screenshotSrc for rendering');
      
      await new Promise(resolve => {
        img.onload = resolve;
      });
      
      const renderer = new Renderer();
      renderer.targetImage = img;
      renderer.naturalSize = true;
      renderer.imageType = 'image/png';
      renderer.imageQuality = 1.0;
      
      const dataUrl = await renderer.rasterize(state);
      
      // console.log('✅ Annotation saved successfully');
      // console.log('🎨 annotatedImage created:', dataUrl?.substring(0, 50) + '...');
      
      if (this.onSaveAnnotation) {
        this.onSaveAnnotation(dataUrl);
      }
      
      this.annotatedImage = dataUrl;
      // console.log('📝 State updated - annotatedImage now exists');
      this.cleanup();
      this.close();
    } catch (error) {
      console.error("Error saving annotation:", error);
    }
  }

  deleteScreenshot() {
    // Clear all screenshot data
    this.annotatedImage = null;
    this.screenshotSrc = null;
    this.isAnnotationReady = false;
    
    // Notify React component
    if (this.onSaveAnnotation) {
      this.onSaveAnnotation(null);
    }
    
    this.close();
  }
  
  /**
   * Completely reset the dialog state
   * Used when removing thumbnails or starting fresh
   */
  reset() {
    // Notify widget that screenshot dialog is closed
    if (window.UserBird && window.UserBird.setScreenshotDialogOpen) {
      window.UserBird.setScreenshotDialogOpen(false);
    }
    
    // Clear all screenshot data
    this.annotatedImage = null;
    this.screenshotSrc = null;
    this.isAnnotationReady = false;
    this.isCapturing = false;
    
    // Reset UI elements
    this.resetImageElement();
    
    // Clean up marker area if it exists
    if (this.markerArea) {
      this.markerArea.close();
      this.markerArea = null;
    }
  }

  updateToolbar() {
    // IMPORTANT: This method mirrors React's state-based toolbar logic exactly.
    // React shows tools based ONLY on state, NOT on "modes" or parameters.
    // Do NOT add mode parameters - just check state like React does.
    // console.log('updateToolbar called - annotatedImage exists:', !!this.annotatedImage, 'isAnnotationReady:', this.isAnnotationReady, 'markerArea exists:', !!this.markerArea);
    
    // Clear existing tools
    const existingTools = this.toolbarContent.querySelector('.toolbar-tools');
    if (existingTools) {
      existingTools.remove();
    }

    const toolsContainer = document.createElement('div');
    toolsContainer.className = 'toolbar-tools';

    // Mirror React logic exactly:
    // Show annotation tools when: isAnnotationReady && markerArea && !annotatedImage
    if (this.isAnnotationReady && this.markerArea && !this.annotatedImage) {
      // console.log('Creating annotation tools');
      toolsContainer.appendChild(this.createAnnotationTools());
      this.toolbar.style.display = 'block';
    }
    // Show preview tools when: annotatedImage exists (regardless of mode)
    else if (this.annotatedImage) {
      // console.log('Creating preview tools');
      toolsContainer.appendChild(this.createPreviewTools());
      this.toolbar.style.display = 'block';
    }
    else {
      // console.log('No tools to show, hiding toolbar');
      this.toolbar.style.display = 'none';
    }

    this.toolbarContent.appendChild(toolsContainer);
  }

  async captureScreenshot() {
    if (this.isCapturing || typeof html2canvas === 'undefined') {
      // console.log('Screenshot capture already in progress or html2canvas not loaded');
      return null;
    }

    // Clear any previous screenshot data before capturing a new one
    this.screenshotSrc = null;
    this.annotatedImage = null;
    
    this.isCapturing = true;
    // console.log('📸 Starting screenshot capture...');

    try {
      // Wait for fonts to be ready
      await document.fonts.ready;
      // console.log('✅ Fonts loaded');

      // Only process images if we detect known problematic domains
      if (this.hasProblematicImages()) {
        await this.waitForImages();
        // console.log('✅ Images processed');
      } else {
        // console.log('✅ No problematic images detected - skipping processing');
      }

      // Apply screenshot mode class for better quality
      document.body.classList.add('screenshot-mode');

      // Capture with optimized settings for speed
      const canvas = await html2canvas(document.body, {
        scale: 2, // Back to maximum quality
        allowTaint: true,
        foreignObjectRendering: true,
        logging: false, // Disabled for speed
        backgroundColor: null,
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 100, // Very short timeout
        removeContainer: true,
        ignoreElements: (element) => {
          // Ignore elements that might cause issues
          return element.classList.contains('html2canvas-ignore') ||
                 element.getAttribute('data-html2canvas-ignore') === 'true';
        }
      });

      // Remove screenshot mode class
      document.body.classList.remove('screenshot-mode');

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      // console.log('✅ Screenshot captured successfully');
      
      this.isCapturing = false;
      return dataUrl;
    } catch (error) {
      console.error('❌ Screenshot capture failed:', error);
      document.body.classList.remove('screenshot-mode');
      this.isCapturing = false;
      return null;
    }
  }

  // Check if page has images from known problematic domains
  hasProblematicImages() {
    const problematicDomains = [
      'googleusercontent.com',
      'gravatar.com', 
      'facebook.com',
      'fbcdn.net',
      'instagram.com',
      'cdninstagram.com',
      'storage.googleapis.com',  // Google Cloud Storage
      'cloudfront.net',         // AWS CloudFront
      'amazonaws.com'           // AWS S3
    ];
    
    const images = document.querySelectorAll('img');
    for (const img of images) {
      if (img.src && this.isProblematicImage(img.src, problematicDomains)) {
        return true;
      }
    }
    return false;
  }

  // Enhanced check for problematic images including nested URLs
  isProblematicImage(src, problematicDomains) {
    try {
      // Check the immediate domain first
      const url = new URL(src, window.location.href);
      if (problematicDomains.some(domain => url.hostname.includes(domain))) {
        // console.log('🔍 Found problematic image (direct):', url.hostname, 'in', src.substring(0, 100) + '...');
        return true;
      }
      
      // Check for Next.js image optimization URLs
      if (url.pathname.includes('/_next/image') && url.searchParams.has('url')) {
        const nestedUrl = decodeURIComponent(url.searchParams.get('url'));
        // console.log('🔍 Found Next.js image optimization URL, nested URL:', nestedUrl.substring(0, 100) + '...');
        try {
          const nestedUrlObj = new URL(nestedUrl);
          if (problematicDomains.some(domain => nestedUrlObj.hostname.includes(domain))) {
            // console.log('🔍 Found problematic image (nested):', nestedUrlObj.hostname, 'in Next.js optimized image');
            return true;
          }
        } catch (e) {
          // console.warn('Failed to parse nested URL:', e);
        }
      }
      
      // Check for other image proxy patterns (e.g., ?url=, &url=, etc.)
      const urlParams = url.search;
      if (urlParams.includes('url=')) {
        const urlMatch = urlParams.match(/url=([^&]+)/);
        if (urlMatch) {
          try {
            const nestedUrl = decodeURIComponent(urlMatch[1]);
            const nestedUrlObj = new URL(nestedUrl);
            // console.log('🔍 Found URL parameter pattern, nested URL:', nestedUrl.substring(0, 100) + '...');
            if (problematicDomains.some(domain => nestedUrlObj.hostname.includes(domain))) {
              // console.log('🔍 Found problematic image (URL param):', nestedUrlObj.hostname);
              return true;
            }
          } catch (e) {
            // console.warn('Failed to parse URL parameter:', e);
          }
        }
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }

  // Check if image is from a known problematic domain (kept for backward compatibility)
  isProblematicDomain(src, problematicDomains) {
    return this.isProblematicImage(src, problematicDomains);
  }

  // Wait for all images to load before taking screenshot
  async waitForImages() {
    const images = Array.from(document.querySelectorAll('img'));
    const problematicDomains = [
      'googleusercontent.com',
      'gravatar.com', 
      'facebook.com',
      'fbcdn.net',
      'instagram.com',
      'cdninstagram.com',
      'storage.googleapis.com',  // Google Cloud Storage
      'cloudfront.net',         // AWS CloudFront
      'amazonaws.com'           // AWS S3
    ];
    
    // console.log('🔍 Found', images.length, 'total images on page');
    
    // Only process images from known problematic domains
    const imagePromises = images
      .filter(img => img.src && this.isProblematicImage(img.src, problematicDomains))
      .map(async (img) => {
        const originalSrc = img.src;
        // console.log('🔄 Processing problematic image:', originalSrc.substring(0, 100) + '...');
        
        // Check cache first
        if (this.imageCache.has(img.src)) {
          // console.log('💾 Using cached conversion for:', originalSrc.substring(0, 50) + '...');
          img.src = this.imageCache.get(img.src);
          return Promise.resolve();
        }
        
        // Skip very small images
        if (img.width < 20 && img.height < 20) {
          // console.log('⏭️ Skipping very small image:', img.width + 'x' + img.height);
          return Promise.resolve();
        }
        
        try {
          const dataUrl = await this.convertImageToDataUrl(img);
          if (dataUrl) {
            this.imageCache.set(img.src, dataUrl); // Cache the result
            // console.log('✅ Successfully converted image');
            // console.log('   Original:', originalSrc.substring(0, 80) + '...');
            // console.log('   Converted:', dataUrl.substring(0, 80) + '...');
            img.src = dataUrl;
          } else {
            // console.warn('❌ Image conversion returned null for:', originalSrc.substring(0, 80) + '...');
          }
        } catch (e) {
          // console.warn('❌ Failed to convert image:', originalSrc.substring(0, 80) + '...', e);
        }
        
        return Promise.resolve();
      });

    const problematicImages = images.filter(img => img.src && this.isProblematicImage(img.src, problematicDomains));
    // console.log('🎯 Found', problematicImages.length, 'problematic images to convert');

    await Promise.all(imagePromises);
    // console.log('✅ Finished processing all problematic images');
  }
  
  // Convert image to data URL using canvas (optimized for speed)
  async convertImageToDataUrl(img) {
    return new Promise((resolve) => {
      try {
        // console.log('🔄 Starting image conversion for:', img.src.substring(0, 100) + '...');
        // console.log('   Image dimensions:', img.width + 'x' + img.height, 'natural:', (img.naturalWidth || 'unknown') + 'x' + (img.naturalHeight || 'unknown'));
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Optimize canvas size for faster processing
        const maxSize = 200; // Limit size for avatars/small images
        const ratio = Math.min(maxSize / (img.naturalWidth || img.width), 
                              maxSize / (img.naturalHeight || img.height), 1);
        
        canvas.width = (img.naturalWidth || img.width) * ratio;
        canvas.height = (img.naturalHeight || img.height) * ratio;
        
        // console.log('   Canvas size:', canvas.width + 'x' + canvas.height, 'ratio:', ratio);
        
        // Create a new image element to avoid CORS issues
        const proxyImg = new Image();
        proxyImg.crossOrigin = 'anonymous';
        
        proxyImg.onload = () => {
          try {
            // console.log('   ✅ Proxy image loaded successfully');
            ctx.drawImage(proxyImg, 0, 0, canvas.width, canvas.height);
            // Use lower quality for faster conversion
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            // console.log('   ✅ Canvas conversion successful, data URL length:', dataUrl.length);
            resolve(dataUrl);
          } catch (e) {
            // console.warn('   ❌ Failed to draw image to canvas:', e);
            resolve(null);
          }
        };
        
        proxyImg.onerror = (e) => {
          // console.warn('   ❌ Proxy image failed to load:', e);
          resolve(null);
        };
        
        // console.log('   🔄 Loading proxy image...');
        proxyImg.src = img.src;
        
        // Much shorter timeout for faster processing
        setTimeout(() => {
          // console.warn('   ⏰ Image conversion timed out after 500ms');
          resolve(null);
        }, 500); // Reduced from 2000ms to 500ms
        
      } catch (e) {
        // console.warn('   ❌ Image conversion failed with exception:', e);
        resolve(null);
      }
    });
  }

  async openWithScreenshot(onSaveAnnotation = null, buttonColor = null) {
    // Update button color if provided
    if (buttonColor) {
      this.buttonColor = buttonColor;
    }
    
    // Reset completely before taking a new screenshot
    // This ensures we don't have any lingering state from previous screenshots
    this.reset();
    
    // Capture screenshot first, then open dialog
    const screenshotSrc = await this.captureScreenshot();
    if (screenshotSrc) {
      this.open(screenshotSrc, onSaveAnnotation);
    } else {
      // console.error('Failed to capture screenshot');
    }
  }
}

// Export for use in other files
window.ScreenshotDialog = ScreenshotDialog;

/*
Usage Examples:

1. Basic usage - capture screenshot and open annotation dialog:
   const dialog = new ScreenshotDialog();
   dialog.openWithScreenshot();

2. With callback to handle saved annotations:
   const dialog = new ScreenshotDialog();
   dialog.openWithScreenshot((annotatedImageDataUrl) => {
     if (annotatedImageDataUrl) {
       // console.log('Annotation saved:', annotatedImageDataUrl);
       // Handle the annotated image (save to server, display thumbnail, etc.)
     } else {
       // console.log('Screenshot deleted');
     }
   });

3. With custom button color:
   const dialog = new ScreenshotDialog('#3b82f6'); // Custom blue color
   dialog.openWithScreenshot(callback, '#3b82f6');

4. Open with existing screenshot and custom color:
   const dialog = new ScreenshotDialog();
   dialog.open(existingImageDataUrl, callbackFunction, '#ef4444');

5. Just capture screenshot without opening dialog:
   const dialog = new ScreenshotDialog();
   const screenshotDataUrl = await dialog.captureScreenshot();
   
6. Integration example with dynamic color:
   // In your existing code (e.g., widget.js):
   const handleScreenshotClick = async () => {
     if (window.ScreenshotDialog) {
       const buttonColor = '#1f2937'; // Get from form settings
       const dialog = new window.ScreenshotDialog(buttonColor);
       await dialog.openWithScreenshot((annotatedImage) => {
         // Handle the result
         setScreenshotImage(annotatedImage);
       }, buttonColor);
     }
   };

KEYBOARD ISOLATION:
- When the screenshot dialog is open, keyboard shortcuts from the host application are selectively prevented
- This includes custom shortcuts defined by the host app (e.g., 's' for status, 'a' for other actions)
- Text annotation typing works normally and will not trigger any external shortcuts
- MarkerArea interactions (clicking tools, typing text annotations) work as expected
- Widget shortcuts are disabled while the dialog is open
- Only specific screenshot dialog shortcuts work: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Y (redo), Escape (close)
- Focus is managed to prevent accidental activation of host app elements
*/ 