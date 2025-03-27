interface Point {
  x: number;
  y: number;
}

interface AnimationOptions {
  delay?: number;
  loremText?: string;
  formId?: string;
}

export function initCursorDemo(options: AnimationOptions = {}) {
  const {
    delay = 5000,
    loremText = "This feature is really helpful. Thanks for building such a great widget!",
    formId = ""
  } = options;

  console.log('🎭 Demo animation initialized with options:', { delay, formId });
  
  // Check if we should run the animation
  // The auth component now handles the refresh check, so we just ensure 
  // we respect that decision here without additional checks
  
  let cursorElement: HTMLDivElement | null = null;
  let isAnimating = false;
  
  // Initialize the animation
  const init = () => {
    console.log('🖌️ Creating cursor element');
    // Create cursor element
    cursorElement = document.createElement('div');
    cursorElement.className = 'userbird-demo-cursor';
    cursorElement.style.cssText = `
      position: fixed;
      width: 24px;
      height: 24px;
      background-image: url('/cursor.svg');
      background-size: contain;
      background-repeat: no-repeat;
      pointer-events: none;
      z-index: 100000;
      transition: transform 0.1s ease;
      opacity: 0;
      transform: scale(0.8);
    `;
    document.body.appendChild(cursorElement);
    
    // Verify cursor element was created and is in the DOM
    const cursorInDOM = document.body.contains(cursorElement);
    console.log('🔍 Cursor element in DOM:', cursorInDOM);
    
    // Verify cursor image is loading
    const img = new Image();
    img.onload = () => console.log('✅ Cursor image loaded successfully');
    img.onerror = () => console.error('❌ Cursor image failed to load');
    img.src = '/cursor.svg';
  };
  
  // Animate the cursor to a point with smooth motion
  const moveCursorTo = (point: Point): Promise<void> => {
    return new Promise((resolve) => {
      if (!cursorElement || !isAnimating) return resolve();
      
      const startPoint = {
        x: parseFloat(cursorElement.style.left || '0'),
        y: parseFloat(cursorElement.style.top || '0')
      };
      
      const distance = Math.sqrt(
        Math.pow(point.x - startPoint.x, 2) + 
        Math.pow(point.y - startPoint.y, 2)
      );
      
      // Duration based on distance (faster for short distances)
      const duration = Math.min(Math.max(distance / 2, 300), 1000);
      const startTime = performance.now();
      
      const animate = (time: number) => {
        if (!cursorElement || !isAnimating) return resolve();
        
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing function for smoother motion
        const easing = easeOutQuad(progress);
        
        const currentX = startPoint.x + (point.x - startPoint.x) * easing;
        const currentY = startPoint.y + (point.y - startPoint.y) * easing;
        
        cursorElement.style.left = `${currentX}px`;
        cursorElement.style.top = `${currentY}px`;
        
        if (progress < 1 && isAnimating) {
          requestAnimationFrame(animate);
        } else {
          // Add small delay to make the animation feel more natural
          setTimeout(resolve, 100);
        }
      };
      
      requestAnimationFrame(animate);
    });
  };
  
  // Easing function for smoother motion
  const easeOutQuad = (t: number): number => {
    return t * (2 - t);
  };
  
  // Simulate clicking action with visual feedback
  const simulateClick = (element: Element): Promise<void> => {
    return new Promise((resolve) => {
      if (!cursorElement || !isAnimating) return resolve();
      
      // Visual feedback for click
      cursorElement.style.transform = 'scale(0.7)';
      
      setTimeout(() => {
        if (!cursorElement) return resolve();
        
        cursorElement.style.transform = 'scale(0.8)';
        
        // Trigger the click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        element.dispatchEvent(clickEvent);
        
        // Add delay to make it feel more natural
        setTimeout(resolve, 300);
      }, 150);
    });
  };
  
  // Simulate typing in a textarea or input
  const typeText = (element: HTMLTextAreaElement | HTMLInputElement, text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isAnimating) return resolve();
      
      let currentIndex = 0;
      element.focus();
      
      const typeNextChar = () => {
        if (currentIndex >= text.length || !isAnimating) {
          return resolve();
        }
        
        // Add random delay between keystrokes for realism
        const randomDelay = 50 + Math.random() * 100;
        
        setTimeout(() => {
          const currentText = element.value;
          const nextChar = text[currentIndex];
          element.value = currentText + nextChar;
          
          // Trigger input event for React controlled components
          const inputEvent = new Event('input', { bubbles: true });
          element.dispatchEvent(inputEvent);
          
          currentIndex++;
          typeNextChar();
        }, randomDelay);
      };
      
      typeNextChar();
    });
  };
  
  // Find the feedback button element
  const findFeedbackButton = (): HTMLElement | null => {
    console.log('🔍 Searching for feedback button...');
    
    // Try to find by ID first if formId is provided
    if (formId) {
      const buttonId = `userbird-trigger-${formId}`;
      console.log(`🔍 Looking for button with ID: ${buttonId}`);
      const buttonById = document.getElementById(buttonId);
      if (buttonById) {
        console.log(`✅ Found button by ID: ${buttonId}`);
        return buttonById;
      }
      console.log(`❌ Button with ID ${buttonId} not found`);
    }
    
    // Fallback to generic selectors with expanded options to find the button
    const selectors = [
      '.userbird-trigger',
      '[id^="userbird-trigger"]',
      '.ub-button',
      '[class*="feedback-button"]',
      '.userbird-fab',
      '#userbird-widget-button',
      '[class*="userbird-widget"]',
      '.userbird-button',
      '[class*="userbird"][class*="button"]',
      '[class*="feedback"][class*="button"]',
      'button[class*="userbird"]',
      'button[id*="userbird"]',
      'div[class*="feedback"]',
      'div[id*="feedback"]'
    ];
    
    console.log(`🔍 Trying expanded selectors: ${selectors.join(', ')}`);
    
    for (const selector of selectors) {
      console.log(`🔍 Trying selector: ${selector}`);
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        console.log(`✅ Found button with selector: ${selector}`);
        return element;
      }
    }
    
    console.log('❓ Looking for any buttons in the document');
    const allButtons = document.querySelectorAll('button');
    console.log(`📊 Found ${allButtons.length} buttons on the page`);
    
    // Last resort: try to find the button by inspecting all buttons for possible matches
    console.log('🔍 Trying to find button by inspecting all buttons...');
    for (let i = 0; i < allButtons.length; i++) {
      const button = allButtons[i];
      // Check if button has any indication of being a feedback button
      if (
        button.textContent?.toLowerCase().includes('feedback') ||
        button.id?.toLowerCase().includes('feedback') ||
        button.id?.toLowerCase().includes('userbird') ||
        button.className?.toLowerCase().includes('feedback') ||
        button.className?.toLowerCase().includes('userbird')
      ) {
        console.log(`✅ Found potential feedback button by content/attributes:`, 
          button.textContent || button.id || button.className);
        return button as HTMLElement;
      }
    }
    
    // If absolutely nothing works, fallback to the first button on the page
    if (allButtons.length > 0) {
      console.log('⚠️ No feedback button identified, using first button on page as fallback');
      return allButtons[0] as HTMLElement;
    }
    
    return null;
  };
  
  // Main animation sequence
  const startAnimation = async () => {
    if (isAnimating) return;
    isAnimating = true;
    console.log('▶️ Starting animation sequence');
    
    try {
      // Force a document reflow to ensure all elements are rendered
      console.log('🔄 Forcing document reflow to ensure elements are rendered');
      document.body.getBoundingClientRect();
      
      // Initialize cursor
      init();
      if (!cursorElement) {
        console.error('❌ Failed to create cursor element');
        return;
      }
      console.log('🖱️ Cursor element created');

      // Fade in the cursor
      cursorElement.style.opacity = '1';
      
      // Find the feedback button with retry mechanism
      let feedbackButton = null;
      let retries = 0;
      const maxRetries = 5;
      
      while (!feedbackButton && retries < maxRetries) {
        console.log(`🔄 Attempt ${retries + 1} to find feedback button`);
        feedbackButton = findFeedbackButton();
        
        if (!feedbackButton) {
          console.log(`⏳ Button not found, waiting 500ms before retry ${retries + 1}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        }
      }
      
      if (!feedbackButton) {
        console.error('❌ Feedback button not found after multiple attempts');
        
        // Debug: Check DOM for any widget-related elements
        console.log('🔍 Debugging DOM structure for widget elements:');
        const widgetElements = document.querySelectorAll('[id*="userbird"], [class*="userbird"], [id*="ub-"], [class*="ub-"]');
        console.log(`📊 Found ${widgetElements.length} potential widget elements`);
        
        if (widgetElements.length > 0) {
          console.log('📋 Widget elements found:');
          widgetElements.forEach(el => {
            const classStr = typeof el.className === 'string' 
              ? el.className.replace(/ /g, '.') 
              : Array.from(el.classList || []).join('.');
            console.log(`- ${el.tagName}${el.id ? ' #' + el.id : ''}${classStr ? ' .' + classStr : ''}`);
          });
        }
        
        cleanup();
        return;
      }
      console.log('🔍 Found feedback button:', feedbackButton.id || feedbackButton.className);
      
      // Get button position
      const buttonRect = feedbackButton.getBoundingClientRect();
      const buttonCenter = {
        x: buttonRect.left + buttonRect.width / 2,
        y: buttonRect.top + buttonRect.height / 2
      };
      console.log('📍 Button position:', buttonCenter);
      
      // Verify button position is within viewport and provide fallback if not
      const isButtonPositionValid = 
        buttonCenter.x > 0 && 
        buttonCenter.x < window.innerWidth && 
        buttonCenter.y > 0 && 
        buttonCenter.y < window.innerHeight;
      
      if (!isButtonPositionValid) {
        console.log('⚠️ Button position seems off-screen, using fallback coordinates');
        // Fallback position - bottom right corner
        buttonCenter.x = window.innerWidth - 100;
        buttonCenter.y = window.innerHeight - 100;
      }
      
      // Start from off-screen
      cursorElement.style.left = `${window.innerWidth}px`;
      cursorElement.style.top = `${window.innerHeight / 2}px`;
      
      // Wait a moment before starting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Move to feedback button
      console.log('🚶 Moving cursor to feedback button');
      await moveCursorTo(buttonCenter);
      
      // Click the feedback button
      console.log('👆 Clicking feedback button');
      await simulateClick(feedbackButton);
      
      // Wait a moment to see if modal appears
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check if a modal is visible
      let modalVisible = !!document.querySelector('.userbird-modal.open, .userbird-modal.userbird-open, .ub-modal.open, .ub-modal.ub-open');
      
      // If modal isn't visible, try keyboard shortcut as fallback
      if (!modalVisible) {
        console.log('⚠️ Modal not visible after button click, trying keyboard shortcut fallback');
        // Try keyboard shortcut 'L' which is common for the widget
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'l',
          code: 'KeyL',
          keyCode: 76,
          which: 76,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(keyEvent);
        
        // Wait again to see if that worked
        await new Promise(resolve => setTimeout(resolve, 500));
        modalVisible = !!document.querySelector('.userbird-modal.open, .userbird-modal.userbird-open, .ub-modal.open, .ub-modal.ub-open');
        
        if (!modalVisible) {
          console.log('⚠️ Keyboard shortcut also failed, continuing anyway');
        } else {
          console.log('✅ Modal opened via keyboard shortcut');
        }
      }
      
      // Wait for modal to appear
      console.log('⏳ Waiting for modal to appear');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find the textarea in the modal
      const textareaSelectors = [
        '.ub-textarea', 
        '.userbird-textarea',
        'textarea.ub-textarea', 
        'textarea.userbird-textarea',
        '.userbird-modal textarea',
        '.ub-modal textarea',
        'textarea[placeholder*="feedback"]',
        'textarea[placeholder*="mind"]',
        'textarea'
      ];
      
      console.log('🔍 Looking for textarea with selectors:', textareaSelectors);
      
      let textarea = null;
      for (const selector of textareaSelectors) {
        textarea = document.querySelector<HTMLTextAreaElement>(selector);
        if (textarea) {
          console.log(`✅ Found textarea with selector: ${selector}`);
          break;
        }
      }
      
      if (!textarea) {
        console.error('❌ Textarea not found');
        cleanup();
        return;
      }
      console.log('🔍 Found textarea');
      
      // Get textarea position
      const textareaRect = textarea.getBoundingClientRect();
      const textareaPoint = {
        x: textareaRect.left + 20,
        y: textareaRect.top + 20
      };
      
      // Move to textarea
      console.log('🚶 Moving cursor to textarea');
      await moveCursorTo(textareaPoint);
      
      // Type the text
      console.log('⌨️ Typing text in textarea');
      await typeText(textarea, loremText);
      console.log('✓ Finished typing');
      
      // Find the submit button
      const submitSelectors = [
        '.ub-submit', 
        '.userbird-submit',
        'button.ub-submit', 
        'button.userbird-submit',
        '.userbird-modal button:not(.userbird-close):not(.userbird-button-secondary)',
        '.ub-modal button:not(.ub-close):not(.ub-button-secondary)',
        'button[type="submit"]',
        'button:contains("Send")',
        'button:contains("Submit")',
        'button.userbird-button:not(.userbird-button-secondary)',
        'button.ub-button:not(.ub-button-secondary)'
      ];
      
      console.log('🔍 Looking for submit button with selectors:', submitSelectors);
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          submitButton = document.querySelector<HTMLElement>(selector);
          if (submitButton) {
            console.log(`✅ Found submit button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Some selectors like :contains may not be supported in all browsers
          console.log(`⚠️ Selector error for "${selector}":`, e);
        }
      }
      
      // Fallback: if no specific submit button found, find the last button in the modal
      if (!submitButton) {
        console.log('⚠️ No specific submit button found, looking for any button in modal');
        const modalButtons = document.querySelectorAll('.userbird-modal button, .ub-modal button');
        if (modalButtons.length > 0) {
          // Usually the primary/submit button is the last one
          submitButton = modalButtons[modalButtons.length - 1] as HTMLElement;
          console.log('✅ Using last button in modal as submit button');
        }
      }
      
      if (!submitButton) {
        console.error('❌ Submit button not found');
        cleanup();
        return;
      }
      console.log('🔍 Found submit button');
      
      // Get submit button position
      const submitRect = submitButton.getBoundingClientRect();
      const submitCenter = {
        x: submitRect.left + submitRect.width / 2,
        y: submitRect.top + submitRect.height / 2
      };
      
      // Move to submit button
      console.log('🚶 Moving cursor to submit button');
      await moveCursorTo(submitCenter);
      
      // Click the submit button
      console.log('👆 Clicking submit button');
      await simulateClick(submitButton);
      
      // Wait for success message
      console.log('⏳ Waiting for success message');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fade out cursor
      console.log('🏁 Animation complete, fading out cursor');
      if (cursorElement) {
        cursorElement.style.opacity = '0';
      }
      
      // Clean up
      setTimeout(cleanup, 500);
    } catch (error) {
      console.error('❌ Error in cursor animation:', error);
      cleanup();
    }
  };
  
  // Clean up function
  const cleanup = () => {
    console.log('🧹 Cleaning up animation');
    isAnimating = false;
    if (cursorElement) {
      cursorElement.remove();
      cursorElement = null;
    }
  };
  
  // Start the animation after the specified delay
  console.log(`⏱️ Animation will start in ${delay}ms`);
  setTimeout(startAnimation, delay);
  
  // Return cleanup function in case we need to stop the animation
  return cleanup;
} 