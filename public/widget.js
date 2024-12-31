// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  
  const Logger = {
    debug: (message, ...args) => console.log(`[Userbird Debug] ${message}`, ...args),
    error: (message, ...args) => console.error(`[Userbird Error] ${message}`, ...args)
  };

  async function getFormSettings(formId) {
    try {
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`);
      const data = await response.json();
      Logger.debug('Form settings:', data);
      return data;
    } catch (error) {
      Logger.error('Error fetching form settings:', error);
      return { button_color: '#1f2937' };
    }
  }

  async function submitFeedback(formId, message) {
    Logger.debug('Submitting feedback:', { formId, message });
    const response = await fetch(`${API_BASE_URL}/.netlify/functions/feedback`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify({ formId, message })
    });

    if (!response.ok) {
      throw new Error('Failed to submit feedback');
    }
    
    return response.json();
  }

  function injectStyles(buttonColor) {
    Logger.debug('Injecting styles with button color:', buttonColor);
    const style = document.createElement('style');
    style.textContent = `
      .userbird-button {
        background-color: ${buttonColor} !important;
        color: white !important;
        border: none !important;
        padding: 8px 16px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        font-family: inherit !important;
        font-size: 14px !important;
      }
      .userbird-button:hover {
        opacity: 0.9 !important;
      }
      /* Rest of the styles... */
    `;
    document.head.appendChild(style);
    Logger.debug('Styles injected, style element added:', document.head.contains(style));
  }

  const UserBirdWidget = {
    async init(config) {
      Logger.debug('Initializing widget with config:', config);
      const { formId } = config;
      
      // Get form settings including button color
      const settings = await getFormSettings(formId);
      Logger.debug('Retrieved settings:', settings);
      
      // Inject styles with the button color
      injectStyles(settings.button_color);
      
      // Get trigger button
      const trigger = document.getElementById(`userbird-trigger-${formId}`);
      if (!trigger) {
        Logger.error('Trigger button not found');
        return;
      }

      // Apply button styles
      trigger.className = 'userbird-button ' + trigger.className;
      
      // Log computed styles to verify color application
      const computedStyle = window.getComputedStyle(trigger);
      Logger.debug('Trigger button computed styles:', {
        background: computedStyle.backgroundColor,
        color: computedStyle.color
      });

      // Rest of the widget initialization...
    }
  };

  // Initialize widget
  const formId = window.UserBird?.formId;
  if (formId) {
    UserBirdWidget.init({ formId }).catch(error => {
      Logger.error('Failed to initialize widget:', error);
    });
  }
})();