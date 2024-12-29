import { Logger } from './logger';

export function createModal() {
  // Create modal elements
  const modal = document.createElement('div');
  const backdrop = document.createElement('div');
  
  modal.className = 'ub-modal';
  backdrop.className = 'ub-backdrop';
  
  modal.innerHTML = `
    <div class="ub-modal-content">
      <h3 class="ub-title">Send Feedback</h3>
      <textarea class="ub-textarea" placeholder="What's on your mind?"></textarea>
      <div class="ub-error"></div>
      <div class="ub-buttons">
        <button class="ub-button ub-button-secondary ub-close">Cancel</button>
        <button class="ub-button ub-submit">Send Feedback</button>
      </div>
    </div>
  `;

  // Get elements
  const textarea = modal.querySelector('.ub-textarea') as HTMLTextAreaElement;
  const submitButton = modal.querySelector('.ub-submit') as HTMLButtonElement;
  const errorElement = modal.querySelector('.ub-error') as HTMLDivElement;
  const closeButton = modal.querySelector('.ub-close') as HTMLButtonElement;

  // Append to body
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  // Position modal relative to trigger
  function position(trigger: HTMLElement) {
    const triggerRect = trigger.getBoundingClientRect();
    const modalRect = modal.getBoundingClientRect();
    
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    
    if (spaceBelow >= modalRect.height + 8) {
      modal.style.top = `${triggerRect.bottom + 8}px`;
      modal.style.transform = 'none';
    } else if (spaceAbove >= modalRect.height + 8) {
      modal.style.top = `${triggerRect.top - modalRect.height - 8}px`;
      modal.style.transform = 'none';
    } else {
      modal.style.top = '50%';
      modal.style.transform = 'translateY(-50%)';
    }
    
    const left = Math.min(
      Math.max(8, triggerRect.left),
      window.innerWidth - modalRect.width - 8
    );
    modal.style.left = `${left}px`;
  }

  return {
    open(trigger: HTMLElement) {
      Logger.debug('Opening modal');
      backdrop.classList.add('ub-open');
      modal.classList.add('ub-open');
      position(trigger);
      textarea.focus();
    },

    close() {
      Logger.debug('Closing modal');
      backdrop.classList.remove('ub-open');
      modal.classList.remove('ub-open');
      textarea.value = '';
      submitButton.disabled = false;
      submitButton.textContent = 'Send Feedback';
      errorElement.style.display = 'none';
    },

    onSubmit(handler: (message: string) => void) {
      submitButton.addEventListener('click', () => {
        handler(textarea.value);
      });
    },

    onClose(handler: () => void) {
      backdrop.addEventListener('click', handler);
      closeButton.addEventListener('click', handler);
    },

    setSubmitting(isSubmitting: boolean) {
      submitButton.disabled = isSubmitting;
      submitButton.textContent = isSubmitting ? 'Sending...' : 'Send Feedback';
    },

    showError(message: string) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  };
}