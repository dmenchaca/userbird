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
    this.originalImageSources = new Map(); // Store original image sources for restoration
    
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
        --ssd-tooltip-background: white;
        --ssd-tooltip-text: #374151;
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
        --ssd-tooltip-background: #374151;
        --ssd-tooltip-text: white;
      }
    `;
    document.head.appendChild(style);
  }

  injectScreenshotStyles() {
    // Add styles for screenshot quality improvement and toolbar animations
    const style = document.createElement('style');
    style.textContent = `
      .screenshot-mode {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: geometricPrecision;
        font-smooth: always;
        image-rendering: -webkit-optimize-contrast;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      }

      .screenshot-mode * {
        font-family: inherit !important;
      }

      /* Elegant magical toolbar animation */
      @keyframes magicalAppear {
        0% {
          opacity: 0;
          transform: translateX(-50%) translateY(20px) scale(0.9);
          filter: blur(8px) brightness(1.3);
          box-shadow: 0 0 30px rgba(255, 255, 255, 0);
        }
        30% {
          opacity: 0.6;
          transform: translateX(-50%) translateY(5px) scale(0.95);
          filter: blur(4px) brightness(1.15);
          box-shadow: 0 0 25px rgba(255, 255, 255, 0.3);
        }
        60% {
          opacity: 0.9;
          transform: translateX(-50%) translateY(-2px) scale(1.02);
          filter: blur(1px) brightness(1.05);
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
        }
        100% {
          opacity: 1;
          transform: translateX(-50%) translateY(0px) scale(1);
          filter: blur(0px) brightness(1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
      }

      .screenshot-toolbar.magical-appear {
        animation: magicalAppear 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }

      /* Ensure toolbar maintains its position during animation */
      .screenshot-toolbar {
        animation-fill-mode: both;
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
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 12px;
      display: flex;
      gap: 12px;
      align-items: center;
      border: 1px solid var(--ssd-border-color);
    `;

    // Drag handle
    this.dragHandle = document.createElement('div');
    this.dragHandle.className = 'toolbar-drag-handle';
    this.dragHandle.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
      padding-right: 6px;
      cursor: grab;
      color: var(--ssd-text-muted);
      padding: 6px;
      border-radius: 6px;
      transition: all 0.2s;
    `;
    this.dragHandle.addEventListener('mouseenter', () => {
      this.dragHandle.style.color = 'var(--ssd-text)';
      this.dragHandle.style.backgroundColor = 'var(--ssd-hover-background)';
    });
    this.dragHandle.addEventListener('mouseleave', () => {
      this.dragHandle.style.color = 'var(--ssd-text-muted)';
      this.dragHandle.style.backgroundColor = 'transparent';
    });

    this.toolbarContent.appendChild(this.dragHandle);
    this.toolbar.appendChild(this.toolbarContent);
  }

  createButton(iconSvg, text, tooltip, onClick, variant = 'outline') {
    const button = document.createElement('button');
    // Scale up icons by replacing width="16" height="16" with width="24" height="24"
    const scaledIconSvg = iconSvg.replace(/width="16" height="16"/g, 'width="24" height="24"');
    button.innerHTML = `${scaledIconSvg} ${text ? `<span style="margin-left: 6px;">${text}</span>` : ''}`;
    
    const baseStyles = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      border: none;
      height: 48px;
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
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) scale(0.95);
          background: var(--ssd-tooltip-background);
          color: var(--ssd-tooltip-text);
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid var(--ssd-border-color);
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

  createAnnotationTools() {
    const tools = document.createElement('div');
    tools.style.cssText = 'display: flex; gap: 12px; align-items: center;';

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
    separator.style.cssText = 'width: 1px; height: 36px; background: var(--ssd-border-color);';

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
    tools.style.cssText = 'display: flex; gap: 12px; align-items: center;';

    // Delete button
    const deleteButton = this.createButton(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      'Delete',
      'Delete screenshot',
      () => this.deleteScreenshot()
    );

    // Separator
    const separator = document.createElement('div');
    separator.style.cssText = 'width: 1px; height: 36px; background: var(--ssd-border-color);';

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

    // Check if toolbar was previously hidden to determine if we should animate
    const wasHidden = this.toolbar.style.display === 'none';

    // Mirror React logic exactly:
    // Show annotation tools when: isAnnotationReady && markerArea && !annotatedImage
    if (this.isAnnotationReady && this.markerArea && !this.annotatedImage) {
      // console.log('Creating annotation tools');
      toolsContainer.appendChild(this.createAnnotationTools());
      this.showToolbarWithAnimation(wasHidden);
    }
    // Show preview tools when: annotatedImage exists (regardless of mode)
    else if (this.annotatedImage) {
      // console.log('Creating preview tools');
      toolsContainer.appendChild(this.createPreviewTools());
      this.showToolbarWithAnimation(wasHidden);
    }
    else {
      // console.log('No tools to show, hiding toolbar');
      this.toolbar.style.display = 'none';
      // Remove animation class when hiding
      this.toolbar.classList.remove('magical-appear');
    }

    this.toolbarContent.appendChild(toolsContainer);
  }

  showToolbarWithAnimation(wasHidden) {
    this.toolbar.style.display = 'block';
    
    // Only animate if toolbar was previously hidden
    if (wasHidden) {
      // Check if toolbar was dragged (has pixel positioning)
      const wasDragged = this.isToolbarDragged();
      
      if (wasDragged) {
        // If dragged, show immediately without animation to preserve position
        // console.log('Toolbar was dragged, showing without animation');
      } else {
        // If still centered, apply magical animation
        // console.log('Toolbar is centered, applying magical animation');
        
        // Remove any existing animation class first
        this.toolbar.classList.remove('magical-appear');
        
        // Force a reflow to ensure the class removal takes effect
        this.toolbar.offsetHeight;
        
        // Add the animation class
        this.toolbar.classList.add('magical-appear');
        
        // Remove the animation class after it completes to allow future animations
        setTimeout(() => {
          this.toolbar.classList.remove('magical-appear');
        }, 800); // Match the animation duration
      }
    }
  }

  isToolbarDragged() {
    // Check if toolbar has been moved from its default centered position
    // Default position has left: 50% and transform: translateX(-50%)
    const currentLeft = this.toolbar.style.left;
    const currentTransform = this.toolbar.style.transform;
    
    // If left is a pixel value (not 50%) or transform is 'none', it was dragged
    return (currentLeft && currentLeft !== '50%') || currentTransform === 'none';
  }

  async captureScreenshot() {
    if (this.isCapturing) {
      // console.log('Screenshot capture already in progress');
      return null;
    }

    // Clear any previous screenshot data before capturing a new one
    this.screenshotSrc = null;
    this.annotatedImage = null;
    
    this.isCapturing = true;
    // console.log('📸 Starting screenshot capture...');

    try {
      // Check which screenshot method to use
      const screenshotMethod = window.UserMonk?.settings?.screenshot_method || 'canvas';
      
      if (screenshotMethod === 'browser') {
        // Use browser Screen Capture API
        return await this.captureBrowserScreenshot();
      } else {
        // Use existing canvas method (html2canvas)
        return await this.captureCanvasScreenshot();
      }
    } catch (error) {
      console.error('❌ Screenshot capture failed:', error);
      this.isCapturing = false;
      return null;
    }
  }

  async captureBrowserScreenshot() {
    try {
      // Check if browser supports Screen Capture API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        console.warn('Browser Screen Capture API not supported, falling back to canvas method');
        return await this.captureCanvasScreenshot();
      }

      // console.log('📸 Using browser Screen Capture API...');
      
      // Request screen capture with constraints that prefer current tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'browser', // Prefer browser tab over screen/window
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false, // We don't need audio for screenshots
        preferCurrentTab: true // Hint to prefer current tab (Chrome-specific)
      });

      // Create video element to capture frame from stream
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Wait a bit for the video to start playing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create canvas and capture the frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0);
      
      // Convert to blob
      const blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png');
      });

      // IMPORTANT: Stop all tracks immediately to remove "Stop sharing" dialog
      stream.getTracks().forEach(track => {
        track.stop();
      });

      // Clean up video element
      video.srcObject = null;

      if (!blob) {
        throw new Error('Failed to capture screenshot from browser stream');
      }

      // Convert blob to data URL for annotation
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // console.log('✅ Browser screenshot captured successfully');
      return dataUrl;

    } catch (error) {
      // console.error('❌ Browser screenshot failed:', error);
      
      // Handle user cancellation gracefully
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
        // console.log('User cancelled screen capture, falling back to canvas method');
        return await this.captureCanvasScreenshot();
      }
      
      // For other errors, also fallback to canvas
      console.warn('Browser screenshot failed, falling back to canvas method:', error.message);
      return await this.captureCanvasScreenshot();
    }
  }

  async captureCanvasScreenshot() {
    try {
      // Check if html2canvas is available
      if (typeof html2canvas === 'undefined') {
        console.error('html2canvas not loaded');
        this.isCapturing = false;
        return null;
      }

      // console.log('📸 Using canvas screenshot method (html2canvas)...');

      // Only process images if we detect known problematic domains
      if (this.hasProblematicImages()) {
        await this.waitForImages();
        // console.log('✅ Images processed');
      } else {
        // console.log('✅ No problematic images detected - skipping processing');
      }

      // Wait for converted images to be ready in the DOM
      await this.waitForConvertedImages();

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

      // Convert to data URL immediately
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      // console.log('✅ Canvas screenshot captured successfully');
      
      // Add a short delay to ensure html2canvas has completely finished
      // processing all images before restoring originals
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Restore original image sources after screenshot and delay
      this.restoreOriginalImages();
      
      this.isCapturing = false;
      return dataUrl;
    } catch (error) {
      console.error('❌ Canvas screenshot capture failed:', error);
      document.body.classList.remove('screenshot-mode');
      
      // Restore original image sources even if screenshot failed
      this.restoreOriginalImages();
      
      this.isCapturing = false;
      return null;
    }
  }

  /**
   * ==========================================
   * CORS IMAGE CONVERSION SYSTEM
   * ==========================================
   * 
   * WHY THIS IS NECESSARY:
   * html2canvas cannot capture images from cross-origin domains due to CORS restrictions.
   * This affects images from:
   * - External CDNs (Google Cloud Storage, AWS S3, CloudFront)
   * - Social media platforms (Gravatar, Facebook, Instagram) 
   * - Image services (Unsplash, Google Photos)
   * - Next.js optimized images that proxy external URLs
   * 
   * WHAT HAPPENS WITHOUT THIS:
   * - Images appear as blank/missing in screenshots
   * - Console shows CORS errors
   * - Screenshot quality is poor due to missing visual elements
   * 
   * HOW THE CONVERSION WORKS:
   * 1. Detect problematic images by checking src, srcset, and currentSrc
   * 2. Convert each image to a data URL using canvas (bypasses CORS for rendering)
   * 3. Replace the original src/srcset with the data URL
   * 4. Take screenshot with html2canvas (now uses local data URLs)
   * 5. Restore original src/srcset after screenshot
   * 
   * CRITICAL IMPLEMENTATION DETAILS:
   * - Must check ALL image attributes: src, srcset, currentSrc
   * - Must remove srcset when applying conversion (prevents browser from reverting)
   * - Must store original attributes for restoration
   * - Must handle Next.js image optimization URLs (nested URL extraction)
   * - Must use sequential processing for cache efficiency
   * - Must verify all problematic images are converted before screenshot
   * 
   * DEBUGGING TIPS:
   * - Check console for "Still found X problematic images" warnings
   * - Look for images with intact srcset attributes after conversion
   * - Verify data URLs are actually applied to DOM elements
   * - Check timing of restoration vs screenshot completion
   * 
   * COMMON FAILURE PATTERNS:
   * 1. Image detected but srcset not removed → Browser reverts to original URL
   * 2. Conversion succeeds but restoration happens too early → html2canvas gets original URLs
   * 3. URL variations not cached properly → Same image converted multiple times
   * 4. New domains added but not in problematicDomains list → Images not detected
   */

  // Check if page has images from known problematic domains
  // This is the entry point - determines if conversion is needed at all
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
      'amazonaws.com',          // AWS S3
      'unsplash.com',           // Unsplash images
      'plus.unsplash.com'       // Unsplash Plus images
    ];
    
    const images = document.querySelectorAll('img');
    for (const img of images) {
      // Check src attribute
      if (img.src && this.isProblematicImage(img.src, problematicDomains)) {
        return true;
      }
      
      // Check srcset attribute for responsive images
      if (img.srcset) {
        const srcsetUrls = img.srcset.split(',').map(src => src.trim().split(' ')[0]);
        for (const srcsetUrl of srcsetUrls) {
          if (this.isProblematicImage(srcsetUrl, problematicDomains)) {
            return true;
          }
        }
      }
      
      // Check currentSrc (the actual URL being used)
      if (img.currentSrc && this.isProblematicImage(img.currentSrc, problematicDomains)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Enhanced problematic image detection with support for:
   * - Direct cross-origin URLs
   * - Next.js image optimization proxies  
   * - Blob URLs from file uploads
   * - URL parameter patterns
   * 
   * IMPORTANT: This method handles nested URLs in Next.js optimized images like:
   * /_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fimage.jpg
   * 
   * It extracts and checks the actual underlying URL, not just the proxy URL.
   */
  isProblematicImage(src, problematicDomains) {
    try {
      // Check for blob URLs first (these are always problematic for screenshots)
      if (src.startsWith('blob:')) {
        return true;
      }
      
      // Use document.baseURI for proper relative URL resolution on the current page
      // This ensures relative URLs are resolved relative to the page being screenshotted, not the widget
      const baseURI = document.baseURI || window.location.href;
      
      // Check the immediate domain first
      const url = new URL(src, baseURI);
      
      if (problematicDomains.some(domain => url.hostname.includes(domain))) {
        return true;
      }
      
      // Check for Next.js image optimization URLs
      if (url.pathname.includes('/_next/image') && url.searchParams.has('url')) {
        const nestedUrl = decodeURIComponent(url.searchParams.get('url'));
        try {
          const nestedUrlObj = new URL(nestedUrl);
          if (problematicDomains.some(domain => nestedUrlObj.hostname.includes(domain))) {
            return true;
          }
        } catch (e) {
          console.warn('Failed to parse nested URL:', e);
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
            if (problematicDomains.some(domain => nestedUrlObj.hostname.includes(domain))) {
              return true;
            }
          } catch (e) {
            console.warn('Failed to parse URL parameter:', e);
          }
        }
      }
      
      return false;
    } catch (e) {
      console.warn('Error checking if image is problematic:', e);
      return false;
    }
  }

  // Check if image is from a known problematic domain (kept for backward compatibility)
  isProblematicDomain(src, problematicDomains) {
    return this.isProblematicImage(src, problematicDomains);
  }

  /**
   * MAIN IMAGE CONVERSION ORCHESTRATOR
   * 
   * This is the heart of the CORS image conversion system. It:
   * 1. Identifies ALL problematic images (src, srcset, currentSrc)
   * 2. Converts them to data URLs sequentially (for cache efficiency)
   * 3. Applies conversions while preserving originals for restoration
   * 4. Verifies all problematic images were successfully converted
   * 
   * CRITICAL SEQUENCING:
   * - Images are processed sequentially, not in parallel
   * - Same-origin images are prioritized (better cache sharing)
   * - Each image's srcset is completely removed when converted
   * - Original src/srcset are stored in this.originalImageSources Map
   * 
   * FAILURE MODES TO WATCH FOR:
   * - Images detected but not converted (network/CORS failures)
   * - srcset not removed (browser reverts to original URLs)
   * - Restoration called too early (before html2canvas finishes)
   * - Cache misses due to URL variations
   * 
   * DEBUGGING: Check the final verification step - it will log any images
   * that remain problematic after conversion attempts.
   */
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
      'amazonaws.com',          // AWS S3
      'unsplash.com',           // Unsplash images
      'plus.unsplash.com'       // Unsplash Plus images
    ];
    
    // Filter problematic images - check BOTH src and srcset
    const problematicImages = images.filter(img => {
      // Check the actual URL being displayed (currentSrc for srcset support)
      const actualSrc = img.currentSrc || img.src;
      if (actualSrc && this.isProblematicImage(actualSrc, problematicDomains)) {
        return true;
      }
      
      // Also check all URLs in srcset attribute
      if (img.srcset) {
        const srcsetUrls = img.srcset.split(',').map(src => src.trim().split(' ')[0]);
        for (const srcsetUrl of srcsetUrls) {
          if (srcsetUrl && this.isProblematicImage(srcsetUrl, problematicDomains)) {
            return true;
          }
        }
      }
      
      return false;
    });

    // Sort images by priority: same-origin first (more likely to succeed)
    problematicImages.sort((a, b) => {
      const aUrl = a.currentSrc || a.src;
      const bUrl = b.currentSrc || b.src;
      const aSameOrigin = aUrl.startsWith(window.location.origin);
      const bSameOrigin = bUrl.startsWith(window.location.origin);
      
      if (aSameOrigin && !bSameOrigin) return -1; // a comes first
      if (!aSameOrigin && bSameOrigin) return 1;  // b comes first
      return 0; // same priority
    });

    // Process images sequentially to ensure cache sharing works properly
    for (const img of problematicImages) {
      // Determine the actual URL being used (currentSrc for srcset support, fallback to src)
      const actualSrc = img.currentSrc || img.src;
      const originalSrc = actualSrc;
        
        // Check cache first
      if (this.imageCache.has(actualSrc)) {
        this.applyConvertedImage(img, this.imageCache.get(actualSrc));
        continue;
      }
      
      // Try to find if we already have a successful conversion for the same underlying image
      const baseImageUrl = this.extractBaseImageUrl(actualSrc);
      const existingConversion = this.findExistingConversion(baseImageUrl);
      
      if (existingConversion) {
        this.applyConvertedImage(img, existingConversion);
        continue;
        }
        
        // Skip very small images
        if (img.width < 20 && img.height < 20) {
        continue;
        }
        
        try {
          const dataUrl = await this.convertImageToDataUrl(img);
          if (dataUrl) {
          this.imageCache.set(actualSrc, dataUrl); // Cache using the actual URL
          // Also cache using the base URL for sharing between similar images
          const baseUrl = this.extractBaseImageUrl(actualSrc);
          if (baseUrl !== actualSrc) {
            this.imageCache.set(baseUrl, dataUrl);
          }
          
          this.applyConvertedImage(img, dataUrl);
          } else {
          console.warn('❌ Image conversion returned null for:', originalSrc.substring(0, 80) + '...');
          }
        } catch (e) {
        console.warn('❌ Failed to convert image:', originalSrc.substring(0, 80) + '...', e);
      }
    }
    
    // Final verification - check for any remaining problematic images
    const stillProblematic = Array.from(document.querySelectorAll('img')).filter(img => {
      const actualSrc = img.currentSrc || img.src;
      if (actualSrc && this.isProblematicImage(actualSrc, problematicDomains)) {
        return true;
      }
      if (img.srcset) {
        const srcsetUrls = img.srcset.split(',').map(src => src.trim().split(' ')[0]);
        for (const srcsetUrl of srcsetUrls) {
          if (srcsetUrl && this.isProblematicImage(srcsetUrl, problematicDomains)) {
            return true;
          }
        }
      }
      return false;
    });
    
    if (stillProblematic.length > 0) {
      console.warn('⚠️ Still found', stillProblematic.length, 'problematic images after conversion:');
      stillProblematic.forEach((img, index) => {
        console.warn(`   ${index + 1}. Alt: "${img.alt}", Classes: "${img.className}"`);
        console.warn(`      src: ${img.src?.substring(0, 100)}...`);
        console.warn(`      srcset: ${img.srcset ? 'EXISTS' : 'none'}`);
        console.warn(`      currentSrc: ${img.currentSrc?.substring(0, 100)}...`);
      });
    }
  }

  // Apply converted image and store original for restoration
  applyConvertedImage(img, dataUrl) {
    // Store original sources before modifying (for restoration later)
    const imageId = img.src + (img.srcset || ''); // Create unique ID
    if (!this.originalImageSources.has(imageId)) {
      this.originalImageSources.set(imageId, {
        src: img.src,
        srcset: img.srcset || null,
        element: img
      });
    }
    
    // Always remove srcset first to ensure our data URL takes precedence
    if (img.srcset) {
      img.removeAttribute('srcset');
    }
    
    // Set the converted data URL as the source
    img.src = dataUrl;
  }

  /**
   * URL UTILITY METHODS
   * 
   * These methods handle the complexity of Next.js image optimization and other proxy patterns:
   * - extractBaseImageUrl(): Extracts the actual image URL from proxy URLs
   * - findExistingConversion(): Checks cache for similar images to avoid duplicate work
   * - isProblematicImage(): Detects if an image needs CORS conversion (handles nested URLs)
   * 
   * RESTORATION SYSTEM:
   * - applyConvertedImage(): Safely applies converted data URLs while storing originals
   * - restoreOriginalImages(): Restores all original src/srcset after screenshot
   * 
   * The cache system (this.imageCache) and restoration system (this.originalImageSources)
   * work together to ensure efficiency and proper cleanup.
   */

  // Extract the base image URL from Next.js optimized URLs or other proxies
  extractBaseImageUrl(src) {
    try {
      // Use document.baseURI for proper relative URL resolution on the current page
      const baseURI = document.baseURI || window.location.href;
      const url = new URL(src, baseURI);
      
      // Handle Next.js image optimization
      if (url.pathname.includes('/_next/image') && url.searchParams.has('url')) {
        const nestedUrl = decodeURIComponent(url.searchParams.get('url'));
        // Remove query parameters that might vary (w, q, etc.) but keep core image ID
        const baseUrl = new URL(nestedUrl);
        return baseUrl.origin + baseUrl.pathname; // Remove query params
      }
      
      // For direct URLs, remove query parameters that might vary
      return url.origin + url.pathname;
    } catch (e) {
      return src; // Fallback to original if parsing fails
    }
  }

  // Find if we already have a successful conversion for the same base image
  findExistingConversion(baseImageUrl) {
    for (const [cachedUrl, dataUrl] of this.imageCache.entries()) {
      const cachedBaseUrl = this.extractBaseImageUrl(cachedUrl);
      if (cachedBaseUrl === baseImageUrl) {
        return dataUrl;
      }
    }
    return null;
  }

  // Restore original image sources after screenshot
  restoreOriginalImages() {
    this.originalImageSources.forEach((originalData, imageId) => {
      const img = originalData.element;
      if (img && img.parentNode) { // Make sure element still exists in DOM
        img.src = originalData.src;
        if (originalData.srcset) {
          img.setAttribute('srcset', originalData.srcset);
        }
      }
    });
    
    // Clear the storage
    this.originalImageSources.clear();
  }
  
  // Convert image to data URL using canvas (optimized for speed)
  async convertImageToDataUrl(img) {
    return new Promise((resolve) => {
      const processImageConversion = async () => {
        try {
          // Use the actual URL being displayed (currentSrc for srcset support)
          const actualSrc = img.currentSrc || img.src;
        
          // Calculate canvas dimensions once (will be reused for each attempt)
          const maxSize = 1200; // Much higher limit for better quality
          const ratio = Math.min(maxSize / (img.naturalWidth || img.width), 
                                maxSize / (img.naturalHeight || img.height), 1);
          
          const canvasWidth = (img.naturalWidth || img.width) * ratio;
          const canvasHeight = (img.naturalHeight || img.height) * ratio;
          
          // Special handling for blob URLs - draw directly from the existing img element
          if (img.src.startsWith('blob:')) {
            try {
              // For blob URLs, we can draw the already-loaded img element directly
              if (img.complete && img.naturalWidth > 0) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png', 1.0);
                resolve(dataUrl);
                return;
              } else {
                // If the image isn't loaded yet, wait for it
                const onLoad = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;
                    
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/png', 1.0);
                    resolve(dataUrl);
                  } catch (e) {
                    resolve(null);
                  }
                  img.removeEventListener('load', onLoad);
                  img.removeEventListener('error', onError);
                };
                
                const onError = () => {
                  resolve(null);
                  img.removeEventListener('load', onLoad);
                  img.removeEventListener('error', onError);
                };
                
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);
                
                // Timeout for blob URLs too
                setTimeout(() => {
                  img.removeEventListener('load', onLoad);
                  img.removeEventListener('error', onError);
                  resolve(null);
                }, 500);
                return;
              }
            } catch (e) {
              resolve(null);
              return;
            }
          }
          
          /*
           * ========================================================================
           * CRITICAL: CANVAS TAINTING AND CORS HANDLING
           * ========================================================================
           * 
           * ISSUE: Canvas becomes "tainted" when drawing cross-origin images without CORS.
           * Once tainted, canvas.toDataURL() will ALWAYS throw SecurityError, even if 
           * subsequent operations have proper CORS headers.
           * 
           * SOLUTION: Create a fresh canvas for each CORS attempt.
           * 
           * FAILURE PATTERN (what was happening before):
           * 1. Create single canvas
           * 2. First attempt (no CORS): drawImage() succeeds, canvas becomes tainted
           * 3. First attempt: toDataURL() fails due to tainted canvas
           * 4. Second attempt (with CORS): uses same tainted canvas 
           * 5. Second attempt: Even with CORS, toDataURL() fails because canvas is already tainted
           * 6. Result: Both attempts fail even if CORS headers are available
           * 
           * WORKING PATTERN (current implementation):
           * 1. First attempt: Create fresh canvas, try without CORS
           * 2. If fails: Create NEW fresh canvas, try with CORS
           * 3. Each canvas is independent and uncontaminated
           * 
           * WARNING: Do NOT "optimize" by reusing canvas between attempts!
           * This will break Google avatars and other cross-origin images.
           * 
           * References:
           * - https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
           * - https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
           * ========================================================================
           */
          
          // Standard handling for regular URLs
          // Try without CORS first, then fallback to CORS if needed
          let timeoutId;
          
          const tryImageLoad = (useCors = false) => {
            return new Promise((imgResolve) => {
              // CRITICAL: Create a fresh canvas for each attempt to avoid canvas tainting issues
              // DO NOT move this outside the function - each attempt needs its own clean canvas
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = canvasWidth;
              canvas.height = canvasHeight;
              
              const proxyImg = new Image();
              if (useCors) {
                proxyImg.crossOrigin = 'anonymous';
              }
              
              const cleanup = () => {
                proxyImg.onload = null;
                proxyImg.onerror = null;
                if (timeoutId) {
                  clearTimeout(timeoutId);
                }
              };
        
              proxyImg.onload = () => {
                try {
                  // Separate canvas drawing from data URL conversion to identify specific failure points
                  try {
                    ctx.drawImage(proxyImg, 0, 0, canvas.width, canvas.height);
                  } catch (drawError) {
                    console.warn('   ❌ Failed to draw image to canvas (likely CORS restriction):', {
                      name: drawError.name || 'Unknown',
                      message: drawError.message || 'No message',
                      toString: drawError.toString()
                    });
                    cleanup();
                    imgResolve(null);
                    return;
                  }
                  
                  try {
                    const dataUrl = canvas.toDataURL('image/png', 1.0);
                    cleanup();
                    imgResolve(dataUrl);
                  } catch (dataUrlError) {
                    console.warn('   ❌ Failed to convert canvas to data URL (canvas tainted by CORS):', {
                      name: dataUrlError.name || 'Unknown', 
                      message: dataUrlError.message || 'No message',
                      toString: dataUrlError.toString()
                    });
                    cleanup();
                    imgResolve(null);
                  }
                } catch (e) {
                  console.warn('   ❌ Unexpected error in image conversion:', {
                    name: e.name || 'Unknown',
                    message: e.message || 'No message', 
                    toString: e.toString()
                  });
                  cleanup();
                  imgResolve(null);
                }
              };
              
              proxyImg.onerror = (e) => {
                console.warn('   ❌ Proxy image failed to load' + (useCors ? ' (with CORS)' : ' (without CORS)'), e);
                cleanup();
                imgResolve(null);
              };
              
              // Set timeout for this attempt
              timeoutId = setTimeout(() => {
                cleanup();
                imgResolve(null);
              }, 3000);
              
              proxyImg.src = actualSrc;
            });
          };
          
          // Try without CORS first
          let result = await tryImageLoad(false);
          
          // If that failed, try with CORS using a fresh canvas
          if (!result) {
            result = await tryImageLoad(true);
          }
          
          resolve(result);
        
        } catch (e) {
          resolve(null);
        }
      };
      
      // Start the async process
      processImageConversion();
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

  // Wait for converted images to load in the DOM
  async waitForConvertedImages() {
    const convertedImages = Array.from(document.querySelectorAll('img')).filter(img => 
      img.src.startsWith('data:image/')
    );
    
    if (convertedImages.length === 0) {
      return;
    }
    
    const imagePromises = convertedImages.map(img => {
      return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          resolve();
        } else {
          const onLoad = () => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve(); // Resolve anyway to not block
          };
          
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
        }
      });
    });
    
    await Promise.all(imagePromises);
    
    // Add a small additional delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 100));
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