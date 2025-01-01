// Userbird initialization
export function initUserbird(formId: string) {
  // Initialize Userbird
  window.UserBird = window.UserBird || {};
  window.UserBird.formId = formId;
  
  const script = document.createElement('script');
  script.src = 'https://userbird.netlify.app/widget.js';
  document.head.appendChild(script);
}