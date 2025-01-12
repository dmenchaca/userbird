// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  let settingsLoaded = false;
  let settingsPromise = null;
  
  // Add debug logging function
  const debug = {
    log: (...args) => console.log('[Userbird Debug]', ...args),
    group: (name) => console.group('[Userbird Debug] ' + name),
    groupEnd: () => console.groupEnd()
  };
  
  // Rest of the existing code...

  function openModal(trigger = null) {
    debug.group('Opening Modal');
    debug.log('Settings loaded:', settingsLoaded);
    debug.log('Modal object:', modal);
    
    if (!settingsLoaded) {
      debug.log('Settings not loaded, showing loading state');
      
      // Show loading state
      if (modal) {
        debug.log('Modal elements:', {
          loadingElement: modal.loadingElement,
          form: modal.form,
          modalElement: modal.modal
        });
        
        modal.loadingElement.style.display = 'flex';
        modal.form.style.visibility = 'hidden';
        modal.modal.classList.add('open');
        
        debug.log('Applied styles:', {
          loadingDisplay: modal.loadingElement.style.display,
          formVisibility: modal.form.style.visibility,
          modalClasses: modal.modal.className
        });
        
        positionModal(trigger);
      } else {
        debug.log('Modal not initialized yet');
      }
      
      // Wait for settings to load
      debug.log('Waiting for settings to load...');
      settingsPromise.then(() => {
        debug.log('Settings loaded, updating modal state');
        if (modal) {
          modal.loadingElement.style.display = 'none';
          modal.form.style.visibility = 'visible';
          debug.log('Updated styles:', {
            loadingDisplay: modal.loadingElement.style.display,
            formVisibility: modal.form.style.visibility
          });
        }
      }).catch(error => {
        debug.log('Error loading settings:', error);
      });
      
      debug.groupEnd();
      return;
    }

    // Rest of the existing openModal code...
  }

  async function init() {
    debug.group('Initializing Widget');
    
    // Get form settings including button color
    formId = window.UserBird?.formId;
    debug.log('Form ID:', formId);
    
    if (!formId) {
      debug.log('No form ID found, aborting initialization');
      debug.groupEnd();
      return;
    }

    // Inject styles
    injectStyles();
    debug.log('Initial styles injected');
    
    // Start loading settings
    debug.log('Starting settings load');
    settingsPromise = fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`)
      .then(async (response) => {
        debug.log('Settings response received:', response.status);
        const settings = await response.json();
        debug.log('Settings loaded:', settings);
        
        const buttonColor = settings.button_color || '#1f2937';
        const supportText = settings.support_text;
        
        // Update styles with actual button color
        injectStyles(buttonColor);
        debug.log('Styles updated with button color:', buttonColor);
        
        // Create modal with settings
        modal = createModal();
        debug.log('Modal created:', {
          hasLoadingElement: !!modal.loadingElement,
          hasForm: !!modal.form
        });
        
        setupModal(buttonColor, supportText);
        debug.log('Modal setup complete');
        
        settingsLoaded = true;
        debug.log('Settings loaded flag set to true');
        
        return settings;
      })
      .catch(error => {
        debug.log('Error loading settings:', error);
        // Use defaults if settings fail to load
        injectStyles('#1f2937');
        modal = createModal();
        setupModal('#1f2937', null);
        settingsLoaded = true;
        debug.log('Fallback initialization complete');
      });
    
    // Get default trigger button if it exists
    const defaultTrigger = document.getElementById(`userbird-trigger-${formId}`);
    debug.log('Default trigger found:', !!defaultTrigger);
    
    if (defaultTrigger) {
      defaultTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(defaultTrigger);
      });
    }
    
    debug.groupEnd();
  }

  // Rest of the existing code...

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(error => {
      debug.log('Initialization error:', error);
    });
  }
})();