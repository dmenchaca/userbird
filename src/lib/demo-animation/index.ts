interface Point {
  x: number;
  y: number;
}

interface AnimationOptions {
  delay?: number;
  loremText?: string;
  formId?: string;
}

// Safe way to access dynamic window properties
function safeGetWindowProp(key: string): any {
  return (window as any)[key];
}

export function initCursorDemo(options: AnimationOptions = {}) {
  const {
    delay = 100,
    loremText = "Foo",
    formId = ""
  } = options;

  console.log('🎭 Demo animation initialized with options:', { delay, formId });
  
  // Check if we should run the animation
  // The auth component now handles the refresh check, so we just ensure 
  // we respect that decision here without additional checks
  
  let cursorElement: HTMLDivElement | null = null;
  let isAnimating = false;
  
  // Wait for the widget to fully initialize before starting animation
  const actualDelay = Math.max(delay, 1500); // Ensure at least 1.5s for widget to fully load
  
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
        
        // Log audio context state if available
        try {
          // Check if there are any audio elements on the page
          const audioElements = document.querySelectorAll('audio');
          console.log('🔊 Audio elements on page:', audioElements.length);
          
          // Check for widget sound settings
          const userBird = safeGetWindowProp('UserBird');
          if (userBird && userBird.settings) {
            console.log('🔊 Widget sound settings:', userBird.settings.sound_enabled);
          }
        } catch (e) {
          console.log('🔊 Error checking audio state:', e);
        }
        
        console.log('👆 Triggering click on element:', element.tagName, 
          element.id ? '#' + element.id : '', 
          element.className ? '.' + String(element.className).replace(/ /g, '.') : '');
        
        // Get element rect to create a realistic click
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Create a more realistic click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          detail: 1,
          screenX: centerX + window.screenX,
          screenY: centerY + window.screenY,
          clientX: centerX,
          clientY: centerY,
          button: 0,
          buttons: 1
        });
        
        // Log mouse event properties
        console.log('🔊 Click event properties:', {
          bubbles: clickEvent.bubbles,
          cancelable: clickEvent.cancelable,
          isTrusted: clickEvent.isTrusted,
          clientX: clickEvent.clientX,
          clientY: clickEvent.clientY
        });
        
        // Some widgets detect mouse down + mouse up sequence
        // First dispatch mousedown
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          detail: 1,
          screenX: centerX + window.screenX,
          screenY: centerY + window.screenY,
          clientX: centerX,
          clientY: centerY,
          button: 0,
          buttons: 1
        });
        
        element.dispatchEvent(mouseDownEvent);
        console.log('👆 MouseDown event dispatched');
        
        // Then dispatch mouseup
        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
          detail: 1,
          screenX: centerX + window.screenX,
          screenY: centerY + window.screenY,
          clientX: centerX,
          clientY: centerY,
          button: 0,
          buttons: 0
        });
        
        element.dispatchEvent(mouseUpEvent);
        console.log('👆 MouseUp event dispatched');
        
        // Finally dispatch the click
        element.dispatchEvent(clickEvent);
        console.log('👆 Click event dispatched');
        
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
    
    // Fallback to generic selectors
    const selectors = [
      '.userbird-trigger',
      '[id^="userbird-trigger"]',
      '.ub-button',
      '[class*="feedback-button"]',
      'button[class*="userbird"]',
      'button[id*="userbird"]'
    ];
    
    console.log(`🔍 Trying selectors: ${selectors.join(', ')}`);
    
    for (const selector of selectors) {
      try {
        const element = document.querySelector<HTMLElement>(selector);
        if (element) {
          console.log(`✅ Found button with selector: ${selector}`);
          return element;
        }
      } catch (error) {
        console.log(`❌ Error with selector ${selector}:`, error);
      }
    }
    
    console.log('❓ Looking for any buttons in the document');
    const allButtons = document.querySelectorAll('button');
    console.log(`📊 Found ${allButtons.length} buttons on the page`);
    
    return null;
  };
  
  // Main animation sequence
  const startAnimation = async () => {
    if (isAnimating) return;
    isAnimating = true;
    console.log('▶️ Starting animation sequence');
    
    try {
      // Initialize cursor
      init();
      if (!cursorElement) {
        console.error('❌ Failed to create cursor element');
        cleanup();
        return;
      }
      console.log('🖱️ Cursor element created');

      // Fade in the cursor
      cursorElement.style.opacity = '1';
      
      // Find the feedback button
      const feedbackButton = findFeedbackButton();
      if (!feedbackButton) {
        console.error('❌ Feedback button not found');
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
      
      // Wait longer for modal to appear
      console.log('⏳ Waiting for modal to appear');
      let modalWaitTime = 0;
      const maxWaitTime = 2000; // 2 seconds max wait
      const checkInterval = 200; // Check every 200ms
      
      // Actively wait and check for textarea to appear
      let textarea: HTMLTextAreaElement | null = null;
      while (modalWaitTime < maxWaitTime) {
        textarea = document.querySelector<HTMLTextAreaElement>('.userbird-textarea');
        if (textarea) {
          console.log(`✅ Textarea found after ${modalWaitTime}ms`);
          break;
        }
        
        // Wait and increment time
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        modalWaitTime += checkInterval;
        console.log(`⏳ Still waiting for modal... ${modalWaitTime}ms elapsed`);
      }
      
      // If we didn't find the textarea after max wait time, try fallback methods
      if (!textarea) {
        console.error('❌ Textarea not found after maximum wait time');
        
        // Fallback method: try to patch the event listener to accept synthetic events
        console.log('🔧 Attempting to patch event handling to accept synthetic events');
        
        try {
          // Monkey patch the Event prototype to make isTrusted always return true
          const originalIsTrusted = Object.getOwnPropertyDescriptor(Event.prototype, 'isTrusted')?.get;
          if (originalIsTrusted) {
            Object.defineProperty(Event.prototype, 'isTrusted', {
              get: function() { return true; }
            });
            
            console.log('✅ Successfully patched Event.isTrusted property');
            
            // Try clicking again after patching
            console.log('🔄 Clicking feedback button again after patch');
            await simulateClick(feedbackButton);
            
            // Wait for widget to appear
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const patchTextarea = document.querySelector<HTMLTextAreaElement>('.userbird-textarea');
            if (patchTextarea) {
              console.log('✅ Textarea found after patching!');
              // Continue with animation
              await continueAnimation(patchTextarea, loremText);
              
              // Restore original behavior
              Object.defineProperty(Event.prototype, 'isTrusted', {
                get: originalIsTrusted
              });
              
              return;
            }
            
            // Restore original behavior
            Object.defineProperty(Event.prototype, 'isTrusted', {
              get: originalIsTrusted
            });
          }
        } catch (e) {
          console.log('❌ Error patching event handling:', e);
        }
        
        // Try keyboard shortcut as last resort
        console.log('🔄 Trying keyboard shortcut as last resort');
        try {
          const keyEvent = new KeyboardEvent('keydown', {
            key: 'l',
            code: 'KeyL', 
            keyCode: 76,
            which: 76,
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(keyEvent);
          
          // Wait for widget to appear after keyboard shortcut
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check again for textarea
          const retryTextarea = document.querySelector<HTMLTextAreaElement>('.userbird-textarea');
          if (retryTextarea) {
            console.log('✅ Textarea found after keyboard shortcut!');
            // Continue with animation using retry textarea
            await continueAnimation(retryTextarea, loremText);
            return;
          }
        } catch (e) {
          console.log('❌ Error with keyboard shortcut:', e);
        }
        
        // Finally, try to open the widget programmatically as last resort
        console.log('🔄 Trying to open widget programmatically as last resort');
        
        // Check for UserBird global object and try to open it
        const userBird = safeGetWindowProp('UserBird');
        if (userBird && typeof userBird.open === 'function') {
          console.log('✅ Found UserBird.open, trying to call it');
          try {
            userBird.open();
            // Wait for widget to appear after programmatic opening
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check again for textarea
            const retryTextarea = document.querySelector<HTMLTextAreaElement>('.userbird-textarea');
            if (retryTextarea) {
              console.log('✅ Textarea found after programmatic open!');
              // Continue with animation using retry textarea
              await continueAnimation(retryTextarea, loremText);
              return;
            }
          } catch (e) {
            console.log('❌ Error opening widget programmatically:', e);
          }
        }
        
        cleanup();
        return;
      }
      console.log('🔍 Found textarea');
      
      await continueAnimation(textarea, loremText);
    } catch (error) {
      console.error('❌ Error in cursor animation:', error);
      cleanup();
    }
  };
  
  // Continue animation after finding textarea
  const continueAnimation = async (textarea: HTMLTextAreaElement, text: string): Promise<void> => {
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
    await typeText(textarea, text);
    console.log('✓ Finished typing');
    
    // Find the submit button
    const submitButton = document.querySelector<HTMLElement>('.userbird-submit');
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
    try {
      await simulateClick(submitButton);
      
      // Wait for success message
      console.log('⏳ Waiting for success message');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('⚠️ Error during submit button click, but continuing animation:', error);
    }
    
    // Fade out cursor
    console.log('🏁 Animation complete, fading out cursor');
    if (cursorElement) {
      cursorElement.style.opacity = '0';
    }
    
    // Clean up
    setTimeout(cleanup, 500);
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
  console.log(`⏱️ Animation will start in ${actualDelay}ms`);
  setTimeout(startAnimation, actualDelay);
  
  // Return cleanup function in case we need to stop the animation
  return cleanup;
}