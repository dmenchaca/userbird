// Userbird initialization
export function initUserbird(formId: string) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://userbird.netlify.app/widget.js"]');
    const isInitialized = typeof window.UserBird?.open === 'function';
    
    // Check if widget is already initialized
    if (isInitialized) {
      console.log('Widget script already loaded, updating formId');
      if (window.UserBird) {
        window.UserBird.formId = formId;
      }
      resolve(true);
      return;
    }
    
    // If script exists but not initialized, wait for it
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.UserBird) {
          window.UserBird.formId = formId;
        }
        resolve(true);
      });
      return;
    }

    // Initialize Userbird
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = formId;
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    script.async = true;
    
    // Wait for script to load
    script.onload = () => {
      console.log('Widget script loaded successfully');
      // Script has loaded and executed
      resolve(true);
    };
    
    script.onerror = () => {
      console.error('Failed to load widget script');
      reject(new Error('Failed to load Userbird widget'));
    };
    
    document.head.appendChild(script);
  });
}