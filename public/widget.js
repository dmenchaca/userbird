// Userbird Widget
(function() {
  const API_BASE_URL = 'https://userbird.netlify.app';
  
  const MESSAGES = {
    success: {
      title: 'Thank you',
      description: 'Your message has been received and will be reviewed by our team.'
    },
    labels: {
      submit: 'Send Feedback',
      submitting: 'Sending Feedback...',
      close: 'Close',
      cancel: 'Cancel'
    }
  };

  // Logger utility
  const Logger = {
    debug: (message, ...args) => console.log(`[Userbird Debug] ${message}`, ...args),
    error: (message, ...args) => console.error(`[Userbird Error] ${message}`, ...args)
  };

  let modal = null;
  let formId = null;

  async function submitFeedback(message) {
    Logger.debug('Submitting feedback:', { formId, messageLength: message.length });
    
    const response = await fetch(`${API_BASE_URL}/.netlify/functions/feedback`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify({ formId, message })
    });

    if (!response.ok) {
      Logger.error('Feedback submission failed:', response.status);
      throw new Error('Failed to submit feedback');
    }
    
    Logger.debug('Feedback submitted successfully');
    return response.json();
  }

  function positionModal(trigger) {
    if (!modal?.modal) return;
    
    Logger.debug('Positioning modal', { trigger: trigger?.id });
    
    const modalElement = modal.modal;
    const rect = trigger ? trigger.getBoundingClientRect() : null;
    
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      Logger.debug('Space calculations:', { spaceBelow, spaceAbove });
      
      if (spaceBelow >= 400) {
        modalElement.style.top = `${rect.bottom + 8}px`;
        modalElement.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 408))}px`;
        Logger.debug('Positioned below trigger');
      } else if (spaceAbove >= 400) {
        modalElement.style.top = `${rect.top - 400 - 8}px`;
        modalElement.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 408))}px`;
        Logger.debug('Positioned above trigger');
      } else {
        modalElement.style.top = '50%';
        modalElement.style.left = '50%';
        modalElement.style.transform = 'translate(-50%, -50%)';
        Logger.debug('Centered modal (insufficient space above/below)');
      }
    } else {
      modalElement.style.top = '50%';
      modalElement.style.left = '50%';
      modalElement.style.transform = 'translate(-50%, -50%)';
      Logger.debug('Centered modal (no trigger)');
    }
  }

  function openModal(trigger = null) {
    if (!modal) return;
    Logger.debug('Opening modal', { triggerId: trigger?.id });
    modal.modal.classList.add('open');
    modal.textarea.focus();
    positionModal(trigger);
  }

  function closeModal() {
    if (!modal) return;
    Logger.debug('Closing modal');
    modal.modal.classList.remove('open');
    setTimeout(() => {
      modal.textarea.value = '';
      modal.form.classList.remove('hidden');
      modal.successElement.classList.remove('open');
      modal.submitButton.disabled = false;
      modal.submitButton.querySelector('.userbird-submit-text').textContent = MESSAGES.labels.submit;
    }, 200);
  }

  async function init() {
    formId = window.UserBird?.formId;
    if (!formId) {
      Logger.error('No form ID provided');
      return;
    }

    Logger.debug('Initializing widget', { formId });

    try {
      const response = await fetch(`${API_BASE_URL}/.netlify/functions/form-settings?id=${formId}`);
      const settings = await response.json();
      Logger.debug('Retrieved settings:', settings);
      
      // Rest of the initialization code...
      // (Keep the existing code, just added logging)
    } catch (error) {
      Logger.error('Initialization failed:', error);
    }
  }

  // Initialize if form ID is available
  if (window.UserBird?.formId) {
    init().catch(error => Logger.error('Failed to initialize widget:', error));
  }
})();