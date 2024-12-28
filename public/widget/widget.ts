import { Logger } from './logger';
import { Modal } from './modal';
import { submitFeedback } from './api';
import { createTrigger } from './trigger';

export class UserBirdWidget {
  private formId: string;
  private trigger: HTMLElement | null = null;
  private modal: Modal;

  constructor(formId: string) {
    this.formId = formId;
    this.modal = new Modal();
  }

  async init() {
    Logger.debug('Initializing widget');
    
    this.trigger = createTrigger(this.formId);
    if (!this.trigger) {
      throw new Error('Trigger element not found');
    }

    this.setupEventListeners();
    this.modal.mount();
    
    Logger.debug('Widget initialized');
  }

  private setupEventListeners() {
    this.trigger?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Logger.debug('Trigger clicked');
      this.modal.open(this.trigger!);
    });

    this.modal.onClose(() => this.modal.close());
    this.modal.onSubmit(async (message) => {
      if (!message.trim()) return;

      this.modal.setSubmitting(true);
      
      try {
        await submitFeedback({ formId: this.formId, message });
        Logger.debug('Feedback submitted successfully');
        this.modal.close();
      } catch (error) {
        Logger.error('Failed to submit feedback:', error);
        this.modal.showError(error instanceof Error ? error.message : 'Failed to submit feedback');
      } finally {
        this.modal.setSubmitting(false);
      }
    });
  }
}