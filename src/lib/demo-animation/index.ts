interface Point {
  x: number;
  y: number;
}

interface AnimationOptions {
  delay?: number;
  demoText?: string;
  formId?: string;
}

// Default values
const DEFAULT_DELAY = 100;
const DEFAULT_FORM_ID = "";

// Realistic product feedback phrases
const FEEDBACK_PHRASES = [
  "Loving the insights so far, but I often get confused about which timezone the data is in. Could you let us set or view the timezone somewhere?",
  "I usually check the dashboard first thing in the morning—would be awesome if I could set a default view so I don't have to reconfigure filters every time.",
  "Sometimes I just want a quick summary of key metrics without diving into each chart. A high-level overview at the top would be super useful.",
  "When I click into a spike on the graph, I wish I could see what contributed to it—like a breakdown by source or campaign right there.",
  "We have multiple team members using the dashboard. Would be great if we could save and share specific views or reports across the team."
];

// Get a random product feedback phrase
const getRandomFeedback = (): string => {
  return getRandomItem(FEEDBACK_PHRASES);
};

// Names and colors for the cursor animation
const CURSOR_NAMES = [
  'Amina', 'Hiroshi', 'Santiago', 'Anya', 'Yara',
  'Kofi', 'Leila', 'Luca', 'Mei', 'Tenzin',
  'Sinead', 'Rajesh', 'Zuzanna', 'Fatou', 'Mikael',
  'Iskander', 'Soraya', 'Jalen', 'Óscar'
];

const CURSOR_COLORS = [
  '#204B12', '#BB0066', '#4327FF', '#008E35', '#971BCB'
];

// Safe way to access dynamic window properties
function safeGetWindowProp(key: string): any {
  return (window as any)[key];
}

// Get a random item from an array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function initCursorDemo(options: AnimationOptions = {}) {
  const {
    delay = DEFAULT_DELAY,
    demoText = getRandomFeedback(),
    formId = DEFAULT_FORM_ID
  } = options;

  console.log('🎭 Demo animation initialized with options:', { delay, formId });
  
  // Check if the browser is Safari and skip animation if it is
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    console.log('🧭 Safari detected, skipping animation to prevent lag');
    return () => {}; // Return empty cleanup function
  }
  
  // Check if we should run the animation
  // The auth component now handles the refresh check, so we just ensure 
  // we respect that decision here without additional checks
  
  let cursorElement: HTMLDivElement | null = null;
  let isAnimating = false;
  
  // Wait for the widget to fully initialize before starting animation
  const actualDelay = Math.max(delay, 1500); // Ensure at least 1.5s for widget to fully load
  
  // Add click listener to stop animation if user interacts with the page
  const handleUserClick = () => {
    if (isAnimating) {
      console.log('👆 User clicked - stopping animation');
      cleanup();
    }
  };
  
  // Add the click listener to the document
  document.addEventListener('click', handleUserClick);
  
  // Initialize the animation
  const init = () => {
    console.log('🖌️ Creating cursor element');
    
    // Get random name and color for cursor
    const randomName = getRandomItem(CURSOR_NAMES);
    const randomColor = getRandomItem(CURSOR_COLORS);
    
    // Create cursor container element
    cursorElement = document.createElement('div');
    cursorElement.className = 'userbird-demo-cursor';
    cursorElement.style.cssText = `
      position: fixed;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      pointer-events: none;
      z-index: 100000;
      opacity: 0;
    `;
    
    // Create name bubble
    const nameBubble = document.createElement('div');
    nameBubble.style.cssText = `
      background-color: ${randomColor};
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      font-size: 16px;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 9999px;
      margin-left: 20px; /* Reduced gap between cursor and bubble */
      margin-top: 4px; /* Reduced space between arrow and bubble */
      line-height: 1.2;
      text-align: center;
      min-width: 80px;
      z-index: 1;
    `;
    nameBubble.textContent = randomName;
    
    // Create cursor arrow pointer 
    const cursorArrow = document.createElement('div');
    cursorArrow.style.cssText = `
      width: 30px;
      height: 31px;
      position: relative;
      left: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      transform: scale(0.8);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 2; /* Ensure arrow is above for clicking */
    `;
    
    // Add SVG arrow with dynamic color from the random color
    cursorArrow.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 30 31" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.34914 29.5725L0.548909 2.20921C0.146144 0.796309 1.61363 -0.423764 2.948 0.214593L28.7904 12.5775C30.1644 13.2348 30.0612 15.207 28.6261 15.7155L17.9978 19.4813C17.6118 19.6181 17.2881 19.8872 17.0851 20.2401L11.4966 29.9571C10.742 31.2691 8.76388 31.0274 8.34914 29.5725Z" fill="${randomColor}"/>
      </svg>
    `;
    
    // Add elements in correct order: arrow first, then bubble
    cursorElement.appendChild(cursorArrow);
    cursorElement.appendChild(nameBubble);
    document.body.appendChild(cursorElement);
    
    // Verify cursor element was created and is in the DOM
    const cursorInDOM = document.body.contains(cursorElement);
    console.log('🔍 Cursor element in DOM:', cursorInDOM);
  };
  
  // Improved easing function for smoother motion with ease-in-out
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
      
      // Duration based on distance (slower for better elegance)
      const duration = Math.min(Math.max(distance / 1.2, 800), 2000);
      const startTime = performance.now();
      
      const animate = (time: number) => {
        if (!cursorElement || !isAnimating) return resolve();
        
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Using ease-in-out cubic for smoother acceleration and deceleration
        const easing = easeInOutCubic(progress);
        
        // Position cursor so the arrow tip aligns with the target point
        // For this specific SVG, the tip is around 8px from the left and 6px from the top
        const currentX = startPoint.x + (point.x - startPoint.x - 8) * easing;
        const currentY = startPoint.y + (point.y - startPoint.y - 6) * easing;
        
        cursorElement.style.left = `${currentX}px`;
        cursorElement.style.top = `${currentY}px`;
        
        if (progress < 1 && isAnimating) {
          requestAnimationFrame(animate);
        } else {
          // Add small delay to make the animation feel more natural
          setTimeout(resolve, 200);
        }
      };
      
      requestAnimationFrame(animate);
    });
  };
  
  // Simulate clicking action with visual feedback
  const simulateClick = (element: Element): Promise<void> => {
    return new Promise((resolve) => {
      if (!cursorElement || !isAnimating) return resolve();
      
      // Get the cursorArrow element
      const cursorArrow = cursorElement.querySelector('div');
      
      // Check if this is the submit button
      const isSubmitButton = element.classList.contains('userbird-submit');
      
      setTimeout(() => {
        if (!cursorElement) return resolve();
        
        // Reset cursor arrow scale with smooth transition
        if (cursorArrow) {
          cursorArrow.style.transform = 'scale(0.8)';
          cursorArrow.style.transition = 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
        }
        
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
        
        // If this is the submit button, we can now allow normal widget behavior
        if (isSubmitButton) {
          const userBird = safeGetWindowProp('UserBird');
          if (userBird && typeof userBird.setAnimationRunning === 'function') {
            // Allow widget to be closed after we've clicked the submit button
            userBird.setAnimationRunning(false);
            console.log('🔓 Widget closing enabled after submit button click');
          }
        }
        
        // Add delay to make it feel more natural
        setTimeout(resolve, 300);
      }, 150);
    });
  };
  
  // Simulate typing in a textarea or input with accelerating speed
  const typeText = (element: HTMLTextAreaElement | HTMLInputElement, text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isAnimating) return resolve();
      
      let currentIndex = 0;
      element.focus();
      
      // Make the textarea non-interactive during typing to prevent user interaction
      const oldPointerEvents = element.style.pointerEvents;
      element.style.pointerEvents = 'none';
      
      const typeNextChar = () => {
        if (currentIndex >= text.length || !isAnimating) {
          // Restore interactivity
          element.style.pointerEvents = oldPointerEvents;
          return resolve();
        }
        
        // Calculate acceleration factor based on progress (0 to 1)
        // As progress increases, delay decreases (typing gets faster)
        const progress = currentIndex / text.length;
        const accelerationFactor = 1 - (progress * 0.8); // Start at 1x speed, end at 0.2x speed (5x faster)
        
        // Initial delay is higher, final delay is much lower
        const baseDelay = 40; // Starting speed
        const minDelay = 5;   // Minimum delay to prevent too fast typing
        const randomness = 20 * accelerationFactor; // Randomness decreases as we speed up
        
        // Calculate final delay with acceleration and randomness
        const delay = Math.max(
          minDelay, 
          baseDelay * accelerationFactor + (Math.random() * randomness)
        );
        
        setTimeout(() => {
          const currentText = element.value;
          const nextChar = text[currentIndex];
          element.value = currentText + nextChar;
          
          // Trigger input event for React controlled components
          const inputEvent = new Event('input', { bubbles: true });
          element.dispatchEvent(inputEvent);
          
          currentIndex++;
          typeNextChar();
        }, delay);
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
    
    // Set the animation flag in the widget
    const userBird = safeGetWindowProp('UserBird');
    if (userBird && typeof userBird.setAnimationRunning === 'function') {
      userBird.setAnimationRunning(true);
    }
    
    try {
      // Initialize cursor
      init();
      if (!cursorElement) {
        console.error('❌ Failed to create cursor element');
        cleanup();
        return;
      }
      console.log('🖱️ Cursor element created');

      // Start from off-screen
      cursorElement.style.left = `${window.innerWidth - 180}px`;
      cursorElement.style.top = `${window.innerHeight / 2 - 60}px`;
      
      // Wait a moment before starting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fade in the cursor with animation
      // Reset any existing animations
      cursorElement.style.animation = 'none';
      // Force reflow to ensure animation restart
      void cursorElement.offsetWidth;
      cursorElement.style.animation = 'cursorAppear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      
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
      
      // Move to feedback button
      console.log('🚶 Moving cursor to feedback button');
      await moveCursorTo(buttonCenter);
      
      // Click the feedback button
      console.log('👆 Clicking feedback button');
      await simulateClick(feedbackButton);
      
      // Store cursor position before hiding it
      const lastCursorX = cursorElement.style.left;
      const lastCursorY = cursorElement.style.top;
      
      // Immediately hide cursor with smooth shrink and dissolve effect
      console.log('🪄 Hiding cursor after clicking feedback button');
      if (cursorElement) {
        // Reset any existing animations
        cursorElement.style.animation = 'none';
        // Force reflow to ensure animation restart
        void cursorElement.offsetWidth;
        // Use animation for smooth dissolve effect
        cursorElement.style.animation = 'cursorShrink 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      }
      
      // Wait for shrink animation to complete before continuing
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Wait a moment to let the modal fully appear
      console.log('⏱️ Pausing to let modal fully appear');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
              await continueAnimation(patchTextarea, demoText, lastCursorX, lastCursorY);
              
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
            key: 'f',
            code: 'KeyF', 
            keyCode: 70,
            which: 70,
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
            await continueAnimation(retryTextarea, demoText, lastCursorX, lastCursorY);
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
              await continueAnimation(retryTextarea, demoText, lastCursorX, lastCursorY);
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
      
      await continueAnimation(textarea, demoText, lastCursorX, lastCursorY);
    } catch (error) {
      console.error('❌ Error in cursor animation:', error);
      cleanup();
    }
  };
  
  // Continue animation after finding textarea
  const continueAnimation = async (textarea: HTMLTextAreaElement, text: string, lastX?: string, lastY?: string): Promise<void> => {
    try {
      // Get textarea position (we won't move to it, but need it for calculations later)
      const textareaRect = textarea.getBoundingClientRect();
      const textareaPoint = {
        x: textareaRect.left + 20,
        y: textareaRect.top + 20
      };
      
      // The cursor is already hidden, so we just need to type directly
      console.log('⌨️ Typing text in textarea:', text);
      await typeText(textarea, text);
      console.log('✓ Finished typing');
      
      // Wait a moment after typing completes
      console.log('⏱️ Pausing after typing');
      await new Promise(resolve => setTimeout(resolve, 700));
      
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
      
      // Show cursor where it was last seen (where it dissolved after clicking the feedback button)
      console.log('✨ Making cursor reappear');
      if (cursorElement) {
        // Use the original position where the cursor disappeared
        cursorElement.style.left = lastX || `${textareaPoint.x}px`;
        cursorElement.style.top = lastY || `${textareaPoint.y}px`;
        
        // Ensure it starts invisible
        cursorElement.style.opacity = '0';
        
        // Reset any existing animations
        cursorElement.style.animation = 'none';
        // Force reflow to ensure animation restart
        void cursorElement.offsetWidth;
        // Use beautiful grow animation
        cursorElement.style.animation = 'cursorGrow 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        
        // Wait for grow animation to complete
        await new Promise(resolve => setTimeout(resolve, 700));
        
        // Move to submit button
        console.log('🚶 Moving cursor to submit button');
        await moveCursorTo(submitCenter);
        
        // Click the submit button
        console.log('👆 Clicking submit button');
        await simulateClick(submitButton);
        
        // Final elegant fade-out
        console.log('🏁 Animation complete, fading out cursor');
        // Reset any existing animations
        cursorElement.style.animation = 'none';
        // Force reflow to ensure animation restart
        void cursorElement.offsetWidth;
        cursorElement.style.animation = 'cursorDisappear 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
        
        // Clean up after fade completes
        setTimeout(cleanup, 800);
      } else {
        console.error('❌ Cursor element not found');
        cleanup();
      }
    } catch (error) {
      console.error('❌ Error in animation continuation:', error);
      cleanup();
    }
  };
  
  // Clean up function
  const cleanup = () => {
    isAnimating = false;
    console.log('🧹 Cleaning up animation');
    
    // Remove the click event listener
    document.removeEventListener('click', handleUserClick);
    
    // Reset the animation flag in the widget
    const userBird = safeGetWindowProp('UserBird');
    if (userBird && typeof userBird.setAnimationRunning === 'function') {
      userBird.setAnimationRunning(false);
    }
    
    if (cursorElement && cursorElement.parentElement) {
      cursorElement.parentElement.removeChild(cursorElement);
      cursorElement = null;
    }
  };
  
  // Start the animation after the specified delay
  console.log(`⏱️ Animation will start in ${actualDelay}ms`);
  setTimeout(startAnimation, actualDelay);
  
  // Return cleanup function in case we need to stop the animation
  return cleanup;
}