// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  let settingsLoaded = false;
  let settingsPromise = null;
  let modal = null;
  let formId = null;
  let selectedImage = null;
  let currentTrigger = null;

  // ... (keep all existing functions)

  async function init() {
    // Get form settings including button color
    formId = window.UserBird?.formId;
    if (!formId) return;

    // Inject initial styles
    injectStyles();
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(defaultTrigger);
      });
    }
    
    // Start loading settings
    settingsPromise = fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to load settings');
        }
        const settings = await response.json();
        const buttonColor = settings.button_color || '#1f2937';
        const supportText = settings.support_text;
        
        // Update styles with actual button color
        injectStyles(buttonColor);
        
        // Create modal with settings
        if (!modal) {
          modal = createModal();
          setupModal(buttonColor, supportText);
        }
        
        settingsLoaded = true;
        return settings;
      })
      .catch(error => {
        console.error('Error loading settings:', error);
        // Use defaults if settings fail to load
        injectStyles('#1f2937');
        if (!modal) {
          modal = createModal();
          setupModal('#1f2937', null);
        }
        settingsLoaded = true;
        return { button_color: '#1f2937', support_text: null };
      });
  }

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(console.error);
  }
})();