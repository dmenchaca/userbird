// Userbird Widget
(function() {
  // ... (previous code remains the same until init function)

  async function init() {
    // Get form settings including button color
    formId = window.UserBird?.formId;
    if (!formId) return;

    // Inject styles
    injectStyles();
    
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
        modal = createModal();
        setupModal(buttonColor, supportText);
        
        settingsLoaded = true;
        return settings;
      })
      .catch(error => {
        console.error('Error loading settings:', error);
        // Use defaults if settings fail to load
        injectStyles('#1f2937');
        modal = createModal();
        setupModal('#1f2937', null);
        settingsLoaded = true;
        // Ensure we resolve the promise even on error
        return { button_color: '#1f2937', support_text: null };
      });
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(defaultTrigger);
      });
    }
  }

  // ... (rest of the code remains the same)
})();