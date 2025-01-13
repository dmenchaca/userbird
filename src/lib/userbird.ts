// Userbird initialization
export function initUserbird(formId: string) {
  return new Promise((resolve, reject) => {
    // Initialize Userbird
    window.UserBird = window.UserBird || {};
    window.UserBird.formId = formId;
    
    const script = document.createElement('script');
    script.src = 'https://userbird.netlify.app/widget.js';
    
    // Wait for script to load
    script.onload = () => {
      // Script has loaded and executed
      resolve(true);
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Userbird widget'));
    };
    
    document.head.appendChild(script);
  });
}