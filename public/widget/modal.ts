// Modal component functionality
import { Logger } from './logger';
import { styles } from './styles';

export class Modal {
  private modal: HTMLElement;
  private backdrop: HTMLElement;
  private submitButton: HTMLButtonElement;
  private textarea: HTMLTextAreaElement;
  private errorElement: HTMLElement;

  constructor() {
    this.modal = this.createModal();
    this.backdrop = this.createBackdrop();
    this.submitButton = this.modal.querySelector('.usermonk-submit')!;
    this.textarea = this.modal.querySelector('.usermonk-textarea')!;
    this.errorElement = this.modal.querySelector('.usermonk-error')!;
  }

  mount() {
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.modal);
  }

  private createModal() {
    const modal = document.createElement('div');
    modal.className = 'usermonk-modal';
    modal.innerHTML = `
      <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Send Feedback</h3>
      <textarea class="usermonk-textarea" placeholder="What's on your mind?"></textarea>
      <div class="usermonk-error"></div>
      <div class="usermonk-buttons">
        <button class="usermonk-button usermonk-close">Cancel</button>
        <button class="usermonk-button usermonk-submit">Send Feedback</button>
      </div>
    `;
    return modal;
  }

  private createBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.className = 'usermonk-backdrop';
    return backdrop;
  }

  position(trigger: HTMLElement) {
    const triggerRect = trigger.getBoundingClientRect();
    const modalRect = this.modal.getBoundingClientRect();
    
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    
    if (spaceBelow >= modalRect.height + 8) {
      this.modal.style.top = `${triggerRect.bottom + 8}px`;
    } else if (spaceAbove >= modalRect.height + 8) {
      this.modal.style.top = `${triggerRect.top - modalRect.height - 8}px`;
    } else {
      this.modal.style.top = '50%';
      this.modal.style.transform = 'translateY(-50%)';
    }
    
    const left = Math.min(
      Math.max(8, triggerRect.left),
      window.innerWidth - modalRect.width - 8
    );
    this.modal.style.left = `${left}px`;
  }

  open(trigger: HTMLElement) {
    Logger.debug('Opening modal');
    this.backdrop.classList.add('open');
    this.modal.classList.add('open');
    this.position(trigger);
  }

  close() {
    Logger.debug('Closing modal');
    this.backdrop.classList.remove('open');
    this.modal.classList.remove('open');
    this.textarea.value = '';
    this.submitButton.disabled = false;
    this.submitButton.textContent = 'Send Feedback';
    this.hideError();
  }

  showError(message: string) {
    Logger.debug('Showing error:', message);
    this.errorElement.textContent = message;
    this.errorElement.style.display = 'block';
  }

  hideError() {
    Logger.debug('Hiding error');
    this.errorElement.style.display = 'none';
  }

  getMessage() {
    return this.textarea.value.trim();
  }

  setSubmitting(isSubmitting: boolean) {
    this.submitButton.disabled = isSubmitting;
    this.submitButton.textContent = isSubmitting ? 'Sending...' : 'Send Feedback';
  }

  onClose(handler: () => void) {
    this.backdrop.addEventListener('click', handler);
    this.modal.querySelector('.usermonk-close')?.addEventListener('click', handler);
  }

  onSubmit(handler: () => void) {
    this.submitButton.addEventListener('click', handler);
  }
}