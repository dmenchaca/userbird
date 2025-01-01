// Userbird initialization
export function initUserbird(formId: string) {
  // Initialize Userbird
  window.UserBird = window.UserBird || {};
  window.UserBird.formId = formId;
  
  const script = document.createElement('script');
  // Add timestamp as cache buster
  script.src = `https://userbird.netlify.app/widget.js?_=${Date.now()}`;
  document.head.appendChild(script);
}